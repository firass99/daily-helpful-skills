# daily-helpful-skills

A collection of **[Claude skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)** for everyday
dev work. A skill is a folder with a `SKILL.md` (instructions) plus scripts and references, which Claude loads on its own
when your request matches what the skill does. You install it once, then just ask Claude in plain words.

Each skill sits in its own folder at the root of this repo, with its own README, installer and license.

## Available skills

| Skill | What it does |
|---|---|
| [repo-into-notes-pdf](repo-into-notes-pdf/) | Turns a GitHub repo URL (or several repos, a local project, or a plain topic) into a **step-by-step A4 PDF study guide**: dark cover, **Sommaire** with real page numbers, numbered steps grouped into colour-coded Parts, clean rebuilt code with file paths, cheat tables, and **"vs. the repo"** callouts for every bug or security gap found. |

More skills will be added here over time.

## repo-into-notes-pdf

### Install

```bash
git clone https://github.com/firass99/daily-helpful-skills.git
cd daily-helpful-skills/repo-into-notes-pdf
node bin/install.js              # Claude Code, all projects → ~/.claude/skills/repo-into-notes-pdf
```

| Command | Does |
|---|---|
| `node bin/install.js --project` | install in `./.claude/skills/` (commit it to share with your team) |
| `node bin/install.js --dir <path>` | install anywhere |
| `node bin/install.js --zip` | build `repo-into-notes-pdf.zip` to upload as a skill in Claude.ai |
| `node bin/install.js --check` | check Python / Chromium / poppler |
| `node bin/install.js uninstall` | remove it |

**Manual:** copy `repo-into-notes-pdf/skills/repo-into-notes-pdf/` into `~/.claude/skills/`.

**Requirements** (where the skill runs; Claude.ai's sandbox already has them):

```bash
pip install pygments pypdf playwright pillow
python3 -m playwright install chromium
apt install poppler-utils      # or: brew install poppler
```

### Usage

Just ask Claude:

> Make step-by-step notes PDF from https://github.com/owner/repo
>
> Notes for https://github.com/a/api and https://github.com/a/web — skip the 2FA part, in French
>
> A cheat-sheet guide on Docker for a Node API (no repo)

Claude scans the repo, reads the real files, picks the Parts it needs (Overview, Backend, Frontend, Security, DevOps,
Testing, Reference…), writes them, builds and checks the PDF, then summarises what was covered and fixed. For
follow-ups ("remove Part X", "add DevOps"), it edits and rebuilds the same file.

Try the pipeline without Claude:

```bash
cd repo-into-notes-pdf/skills/repo-into-notes-pdf
python3 scripts/scan_repo.py https://github.com/firass99/express-intern-management --out work
python3 scripts/build.py assets/template --out work/demo.pdf
python3 scripts/check.py work/demo.pdf
```

See [repo-into-notes-pdf/README.md](repo-into-notes-pdf/README.md) for how it works inside.

## License

MIT, see each skill's `LICENSE`.
