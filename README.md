# daily-helpful-skills

Small [Claude skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) I use in my daily dev work.
Install once, then just ask Claude in plain words; it picks the right skill on its own.

## Install

```bash
npx skills add firass99/daily-helpful-skills                              # pick from the list
npx skills add firass99/daily-helpful-skills --skill repo-into-notes-pdf  # one skill directly
```

No clone, no npm package: the [`skills`](https://github.com/vercel-labs/skills) CLI reads `skills/<name>/SKILL.md`
straight from this repo and asks where to install it (Claude Code, Cursor, Codex…).

**Manual:** copy a folder from `skills/` into `~/.claude/skills/`.
**Claude.ai:** zip a skill folder and upload it under *Settings → Capabilities → Skills*.

## Skills

| Skill | What it does |
|---|---|
| [repo-into-notes-pdf](skills/repo-into-notes-pdf/) | GitHub repo (or a topic) → step-by-step PDF study guide with clean code, a Sommaire and cheat tables. |

## Layout

```
skills/<name>/          one folder per skill (SKILL.md + scripts, references, assets)
.github/workflows/      one smoke test per skill
```

## License

MIT
