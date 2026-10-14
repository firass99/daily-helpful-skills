# repo-into-notes-pdf

A [Claude skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) that turns a **GitHub repo URL**
(or several repos, a local project, or a plain topic) into a **step-by-step PDF study guide**:

- dark cover + **Sommaire** with real page numbers
- numbered steps grouped into colour-coded Parts (Overview, Backend, Frontend, Security, DevOps, Testing, Reference…)
- the project **rebuilt cleanly**, every code block headed by its file path
- **"vs. the repo"** callouts for each bug or security gap found, plus cheat tables (routes, env vars, lifecycle, OWASP mapping)

| Example | From |
|---|---|
| [Intern Management API — Backend notes (45 p.)](docs/examples/Intern-Management-API-Notes.pdf) | `firass99/express-intern-management` |
| [Auth with JWT & Sessions — Express → Next.js (35 p.)](docs/examples/Auth-JWT-Sessions-Express-to-Nextjs.pdf) | `TechWithEmmaYT/Advanced-MERN-Auths-2FA` |

## Install

**Claude Code** (all projects):
```bash
npx github:firass99/repo-into-notes-pdf
```
Once published to npm, `npx repo-into-notes-pdf` does the same.

| Command | Does |
|---|---|
| `npx github:firass99/repo-into-notes-pdf --project` | install in `./.claude/skills/` (commit it to share with your team) |
| `npx github:firass99/repo-into-notes-pdf --dir <path>` | install anywhere |
| `npx github:firass99/repo-into-notes-pdf --zip` | build `repo-into-notes-pdf.zip` to upload as a skill in Claude.ai |
| `npx github:firass99/repo-into-notes-pdf --check` | check Python / Chromium / poppler |
| `npx github:firass99/repo-into-notes-pdf uninstall` | remove it |

**Manual:** copy `skills/repo-into-notes-pdf/` into `~/.claude/skills/`.

### Requirements (where the skill runs)
```bash
pip install pygments pypdf playwright pillow
python3 -m playwright install chromium
apt install poppler-utils      # or: brew install poppler
```
Claude.ai's sandbox already has these.

## Use

Just ask Claude:

> Make step-by-step notes PDF from https://github.com/owner/repo
>
> Notes for https://github.com/a/api and https://github.com/a/web — skip the 2FA part, in French
>
> A cheat-sheet guide on Docker for a Node API (no repo)

Claude scans the repo, reads the real files, picks the Parts it needs, writes them, builds and checks the PDF, then
summarises what was covered and fixed.

## How it works

```
skills/repo-into-notes-pdf/
├── SKILL.md                      workflow Claude follows (scope → scan → analyse → outline → write → build → check)
├── references/                   loaded only when needed
│   ├── outline-catalogue.md      Parts & step order per layer, colours
│   ├── analysis-checklist.md     bugs / gaps to look for per layer
│   ├── content-rules.md          code, callouts, tables, tone
│   └── pdf-build.md              requirements, pagination, troubleshooting
├── scripts/
│   ├── scan_repo.py              clone + map: stack, layers, key files, env vars, red flags → scan.json
│   ├── lib.py                    part() step() code() table() note() diagram() …
│   ├── build.py                  HTML → Chromium PDF, page numbers from the PDF outline, Sommaire fit
│   └── check.py                  contact sheet + empty-page detection
└── assets/
    ├── style.css                 the look
    └── template/                 meta.json + example part_*.py to copy
```

Try the pipeline without Claude:
```bash
cd skills/repo-into-notes-pdf
python3 scripts/scan_repo.py https://github.com/firass99/express-intern-management --out work
python3 scripts/build.py assets/template --out work/demo.pdf
python3 scripts/check.py work/demo.pdf
```

## License
MIT
