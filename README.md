# skill issue

A tiny Agent Skill (SKILL.md) that playfully replies “skill issue” when the user expresses being stuck.

## Install

### One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/vignesh07/skill-issue/main/install.sh | bash
```

### Manual install

Copy `SKILL.md` into a skill folder for your tool.

- Claude Code:
  - `~/.claude/skills/skill-issue/SKILL.md` (personal)
  - `.claude/skills/skill-issue/SKILL.md` (project)

- Codex (varies by build):
  - `~/.codex/skills/skill-issue/SKILL.md`
  - sometimes also: `~/.agents/skills/skill-issue/SKILL.md`

- Cursor:
  - best-effort: `.cursor/skills/skill-issue/SKILL.md` (project)

## What it does

- Triggers on phrases like “i’m stuck”, “i don’t know how to…”, “can you help me…”, etc.
- Responds with “skill issue”

## License

MIT
