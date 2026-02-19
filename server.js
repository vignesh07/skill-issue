import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import express from "express";
import pg from "pg";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

// Admin page protection.
// Uses Basic auth to trigger the browser's password popup.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim();

// Railway Postgres provides DATABASE_URL.
const DATABASE_URL = process.env.DATABASE_URL?.trim();

const { Pool } = pg;
const visitsPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : undefined,
    })
  : null;

let visitsReady = false;
let visitsInitError = null;

function parseCookies(header) {
  const out = {};
  const s = String(header || "");
  for (const part of s.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res
      .status(500)
      .type("text/plain")
      .send("ADMIN_TOKEN is not set. Set it in Railway Variables before using /admin.");
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (password !== ADMIN_TOKEN) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Invalid password");
  }
  return next();
}

async function ensureVisitsTable() {
  if (!visitsPool) return { ok: false, reason: "no DATABASE_URL" };
  if (visitsReady) return { ok: true };
  if (visitsInitError) return { ok: false, reason: visitsInitError };

  try {
    await visitsPool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        visitor_id TEXT NOT NULL,
        path TEXT
      );
      CREATE INDEX IF NOT EXISTS visits_ts_idx ON visits (ts);
      CREATE INDEX IF NOT EXISTS visits_visitor_ts_idx ON visits (visitor_id, ts);
    `);
    visitsReady = true;
    return { ok: true };
  } catch (err) {
    visitsInitError = String(err);
    return { ok: false, reason: visitsInitError };
  }
}

function shouldTrack(req) {
  if (req.method !== "GET") return false;

  const p = req.path || "/";
  if (p === "/healthz") return false;
  if (p.startsWith("/admin")) return false;

  // Skip obvious static assets.
  if (/\.(js|css|map|png|jpg|jpeg|gif|webp|svg|ico|txt|xml)$/i.test(p)) return false;

  return true;
}

async function getVisitStats() {
  if (!visitsPool) return null;
  await ensureVisitsTable();

  const q = async (sql) => {
    const r = await visitsPool.query(sql);
    return {
      pageViews: Number(r.rows?.[0]?.page_views || 0),
      uniqueVisitors: Number(r.rows?.[0]?.unique_visitors || 0),
    };
  };

  const today = await q(`
    SELECT COUNT(*)::bigint AS page_views,
           COUNT(DISTINCT visitor_id)::bigint AS unique_visitors
    FROM visits
    WHERE ts >= date_trunc('day', now());
  `);

  const d7 = await q(`
    SELECT COUNT(*)::bigint AS page_views,
           COUNT(DISTINCT visitor_id)::bigint AS unique_visitors
    FROM visits
    WHERE ts >= now() - interval '7 days';
  `);

  const d30 = await q(`
    SELECT COUNT(*)::bigint AS page_views,
           COUNT(DISTINCT visitor_id)::bigint AS unique_visitors
    FROM visits
    WHERE ts >= now() - interval '30 days';
  `);

  const all = await q(`
    SELECT COUNT(*)::bigint AS page_views,
           COUNT(DISTINCT visitor_id)::bigint AS unique_visitors
    FROM visits;
  `);

  return { today, d7, d30, all };
}

const app = express();
app.disable("x-powered-by");

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    visits: {
      enabled: Boolean(visitsPool),
      ready: visitsReady,
      initError: visitsInitError,
    },
  });
});

// Tracking middleware
app.use(async (req, res, next) => {
  if (!visitsPool) return next();
  if (!shouldTrack(req)) return next();

  await ensureVisitsTable();

  const cookies = parseCookies(req.headers.cookie);
  let vid = cookies.vid;

  if (!vid || vid.length < 16) {
    vid = crypto.randomBytes(16).toString("hex");
    setCookie(res, "vid", vid, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  const visitPath = (req.path || "/").slice(0, 512);
  visitsPool.query("INSERT INTO visits (visitor_id, path) VALUES ($1, $2)", [vid, visitPath]).catch(() => {});

  next();
});

// Admin routes
app.get("/admin/api/visits", requireAdminAuth, async (_req, res) => {
  try {
    const stats = await getVisitStats();
    if (!stats) return res.status(400).json({ ok: false, error: "DATABASE_URL not set" });
    return res.json({ ok: true, stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/admin/visits", requireAdminAuth, async (_req, res) => {
  try {
    const stats = await getVisitStats();
    if (!stats) return res.status(400).type("text/plain").send("DATABASE_URL not set\n");

    res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Visits</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 2rem; max-width: 900px; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 1.25rem; margin: 1rem 0; }
    .muted { color: #555; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.6rem; border-bottom: 1px solid #eee; }
    th { background: #fafafa; }
    code { background: #f6f6f6; padding: 0.1rem 0.3rem; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Visit analytics</h1>
  <div class="muted">Page views + unique visitors (cookie-based). Updated at ${new Date().toISOString()}.</div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Window</th>
          <th>Page views</th>
          <th>Unique visitors</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Today</td><td>${stats.today.pageViews}</td><td>${stats.today.uniqueVisitors}</td></tr>
        <tr><td>Last 7 days</td><td>${stats.d7.pageViews}</td><td>${stats.d7.uniqueVisitors}</td></tr>
        <tr><td>Last 30 days</td><td>${stats.d30.pageViews}</td><td>${stats.d30.uniqueVisitors}</td></tr>
        <tr><td>All time</td><td>${stats.all.pageViews}</td><td>${stats.all.uniqueVisitors}</td></tr>
      </tbody>
    </table>
    <div class="muted" style="margin-top:0.75rem">JSON: <a href="/admin/api/visits">/admin/api/visits</a></div>
  </div>

  <div class="card">
    <div><strong>Notes</strong></div>
    <ul class="muted">
      <li>"Unique visitors" = distinct <code>vid</code> cookies in the time window.</li>
      <li>Counts GETs; excludes <code>/admin</code>, <code>/healthz</code>, and common asset extensions.</li>
    </ul>
  </div>
</body>
</html>`);
  } catch (err) {
    res.status(500).type("text/plain").send(String(err));
  }
});

// Serve the existing static site files
const rootDir = process.cwd();
app.get("/", (_req, res) => {
  res.type("html").send(fs.readFileSync(path.join(rootDir, "index.html"), "utf8"));
});
app.use(express.static(rootDir, { extensions: ["html"] }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on :${PORT}`);
  console.log(`[server] visits enabled: ${Boolean(visitsPool)}`);
});
