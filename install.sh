#!/usr/bin/env bash
set -euo pipefail

SKILL_ID="skill-issue"
REPO_RAW_BASE_DEFAULT="https://raw.githubusercontent.com/vignesh07/skill-issue/main"

usage() {
  cat <<'EOF'
install.sh — install the "skill-issue" Agent Skill into common agent skill directories.

Usage:
  curl -fsSL https://raw.githubusercontent.com/vignesh07/skill-issue/main/install.sh | bash

Options:
  --tool <claude|codex|cursor|gemini|openclaw|all>   Where to install (default: all)
  --dir <path>                                      Install into a specific directory (advanced)
  --raw-base <url>                                  Override raw base URL for SKILL.md
  -h, --help                                        Show help

Notes:
  - This installer only places SKILL.md into the target skill directory.
  - Many agents (Claude Code, Codex) treat skills as "rules"; they don't execute TypeScript.
EOF
}

TOOL="all"
CUSTOM_DIR=""
RAW_BASE="$REPO_RAW_BASE_DEFAULT"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool) TOOL="${2:-}"; shift 2;;
    --dir) CUSTOM_DIR="${2:-}"; shift 2;;
    --raw-base) RAW_BASE="${2:-}"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 2;;
  esac
done

fetch_skill_md() {
  # Prefer curl; fall back to wget
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$RAW_BASE/SKILL.md"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$RAW_BASE/SKILL.md"
  else
    echo "Need curl or wget" >&2
    exit 1
  fi
}

install_to_dir() {
  local target_dir="$1"
  mkdir -p "$target_dir"
  fetch_skill_md > "$target_dir/SKILL.md"
  echo "Installed to: $target_dir"
}

# If user gave a custom dir, just do that.
if [[ -n "$CUSTOM_DIR" ]]; then
  install_to_dir "$CUSTOM_DIR"
  exit 0
fi

# Common discovery locations
CLAUDE_DIR="$HOME/.claude/skills/$SKILL_ID"
# Codex locations vary by version; support both.
CODEX_DIR1="$HOME/.codex/skills/$SKILL_ID"
CODEX_DIR2="$HOME/.agents/skills/$SKILL_ID"
GEMINI_DIR="$HOME/.gemini/skills/$SKILL_ID"
# Cursor varies a lot; this is a common convention when using agent-skills locally.
CURSOR_DIR="$HOME/.cursor/skills/$SKILL_ID"
OPENCLAW_DIR="$HOME/.openclaw/skills/$SKILL_ID"

case "$TOOL" in
  claude) install_to_dir "$CLAUDE_DIR";;
  codex)
    install_to_dir "$CODEX_DIR1"
    install_to_dir "$CODEX_DIR2"
    ;;
  gemini) install_to_dir "$GEMINI_DIR";;
  cursor) install_to_dir "$CURSOR_DIR";;
  openclaw) install_to_dir "$OPENCLAW_DIR";;
  all)
    install_to_dir "$CLAUDE_DIR"
    install_to_dir "$CODEX_DIR1"
    install_to_dir "$CODEX_DIR2"
    install_to_dir "$GEMINI_DIR"
    install_to_dir "$CURSOR_DIR"
    install_to_dir "$OPENCLAW_DIR"
    ;;
  *)
    echo "Unknown --tool: $TOOL" >&2
    usage
    exit 2
    ;;
esac
