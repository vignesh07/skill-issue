# @vignesh/skill-issue

A playful Clawdbot skill that responds "skill issue" when users express inability or frustration.

## Install

### Agent-skill install (Claude Code / Codex / Cursor / Gemini CLI)

```bash
curl -fsSL https://raw.githubusercontent.com/vignesh07/skill-issue/main/install.sh | bash
```

(Or pick one target: add `--tool claude|codex|cursor|gemini|openclaw`.)

### npm install (Clawdbot plugin)

```bash
npm install @vignesh/skill-issue
```

Or install via Clawdbot CLI:

```bash
clawdbot plugins install @vignesh/skill-issue
```

## Configure

Add to your `clawdbot.json`:

```json
{
  "skills": {
    "entries": {
      "skill-issue": {
        "enabled": true,
        "config": {
          "chance": 0.3,
          "cooldownMinutes": 5
        }
      }
    }
  }
}
```

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chance` | number | 0.3 | Probability of triggering (0.0-1.0) |
| `cooldownMinutes` | number | 5 | Minutes before can trigger again |
| `enabled` | boolean | true | Enable/disable the skill |

## Triggers

Responds when user expresses:
- "I don't know how to..."
- "I'm stuck..."
- "This is too hard..."
- "I can't figure this out..."
- And more...

## License

MIT
