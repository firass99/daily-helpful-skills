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

Needs **Node 20+**, **git** and **Chrome or Edge** (already on almost every machine). That's it: no Python, no browser
download. The first run installs the skill's npm packages by itself.

The older Python version is kept at tag [`v0-py`](https://github.com/firass99/daily-helpful-skills/tree/v0-py).

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
| `scripts/scan.mjs` | clone + map the repo → `scan.json` (stack, layers, key files, env vars, red flags) |
| `scripts/lib.mjs` | helpers to write Parts: `part()` `step()` `code()` `table()` `note()` … |
| `scripts/build.mjs` | HTML → PDF with the installed Chrome/Edge, real page numbers in the Sommaire |
| `scripts/check.mjs` | contact sheet + empty-page check (pdf.js, no poppler) |
| `scripts/browser.mjs`, `deps.mjs` | find the local browser; install npm packages on first run |
| `assets/` | stylesheet and a starter guide template |

Run the pipeline by hand:

```bash
node scripts/scan.mjs https://github.com/firass99/express-intern-management --out work
node scripts/build.mjs assets/template --out work/demo.pdf
node scripts/check.mjs work/demo.pdf
```
