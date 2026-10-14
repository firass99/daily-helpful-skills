# repo-into-notes-pdf

Give Claude a GitHub repo URL (or several, a local project, or just a topic) and get back a **step-by-step A4 PDF
study guide**:

- dark cover + **Sommaire** with real page numbers
- numbered steps in colour-coded Parts (Overview, Backend, Frontend, Security, DevOps, Testing, Reference…)
- the project **rebuilt cleanly**, every code block headed by its file path
- **"vs. the repo"** callouts for each bug or security gap found, plus cheat tables (routes, env vars, OWASP…)

## Install

```bash
npx skills add firass99/daily-helpful-skills --skill repo-into-notes-pdf
```

Needs, where the skill runs (Claude.ai's sandbox already has them):

```bash
pip install -r requirements.txt && python3 -m playwright install chromium
apt install poppler-utils        # or: brew install poppler
```

## Use

> Make step-by-step notes PDF from https://github.com/owner/repo
>
> Notes for https://github.com/a/api and https://github.com/a/web — skip the 2FA part, in French
>
> A cheat-sheet guide on Docker for a Node API (no repo)

Claude scans the repo, reads the real files, picks the Parts it needs, writes them, builds and checks the PDF, then
sums up what it covered and fixed. Ask for changes ("drop Part X", "add DevOps") and it rebuilds the same file.

## Inside

| Path | Role |
|---|---|
| `SKILL.md` | the workflow: scope → scan → analyse → outline → write → build → check |
| `references/` | Part catalogue, analysis checklist, content rules, PDF build notes (loaded when needed) |
| `scripts/scan_repo.py` | clone + map the repo → `scan.json` (stack, layers, key files, env vars, red flags) |
| `scripts/lib.py` | helpers to write Parts: `part()` `step()` `code()` `table()` `note()` … |
| `scripts/build.py` | HTML → Chromium PDF, real page numbers in the Sommaire |
| `scripts/check.py` | contact sheet + empty-page check |
| `assets/` | stylesheet and a starter guide template |

Run the pipeline by hand:

```bash
python3 scripts/scan_repo.py https://github.com/firass99/express-intern-management --out work
python3 scripts/build.py assets/template --out work/demo.pdf
python3 scripts/check.py work/demo.pdf
```
