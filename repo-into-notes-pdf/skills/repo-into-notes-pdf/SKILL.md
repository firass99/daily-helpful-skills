---
name: repo-into-notes-pdf
description: Turn a GitHub repo URL (or several repos, a local project, or a plain topic like "Docker" or "JWT auth") into a step-by-step A4 PDF study guide — cover, Sommaire with page numbers, numbered steps grouped into Parts, clean rebuilt code with file paths, cheat tables, and "vs. the repo" callouts for every bug or security gap found. Use when the user shares a repo link and asks for notes, a guide, a cheat sheet, documentation, a course, or "explain how this project is built".
---

# Repo → Notes PDF

Produce ONE single-column A4 PDF: dark cover → **Sommaire** (page 2, with page numbers) → Parts (A, B, C…) →
numbered steps (01, 02… continuous across Parts). Each step = short intro + clean code/config with its file path +
tables + callouts. The guide explains how the project is built **and how to rebuild it cleanly**, fixing what is wrong.

Works for: a repo URL, several repos (front + back), a monorepo, an uploaded archive, or a topic with no repo
(build a small realistic example project from reliable knowledge + web research).

## Workflow

Track these as tasks; the user may not be watching.

1. **Scope.** Read the request for: things to skip ("no 2FA"), a focus ("security only"), page budget, language
   (English default; French if asked). Ask at most ONE question, only if the scope is truly unclear. Otherwise start.
2. **Fetch + scan.** `python3 scripts/scan_repo.py <url-or-path> --out work/` clones (`--depth 1`) each repo into its own
   folder and writes `work/scan.json`: stack, versions, detected layers, key files per layer, env vars read by the code,
   committed secrets / node_modules, lockfiles, test setup. It is a map, not an analysis.
3. **Analyse — read the real files, never guess.** For every layer the scan found, read the files it lists.
   Note architecture, data flow, every model, every route, and **bugs + security gaps (file + reason)**.
   See `references/analysis-checklist.md` for what to look for per layer.
4. **Outline.** Pick Parts from `references/outline-catalogue.md` — only those the project needs, in build order.
   Always start with **Overview**, end with **Reference**.
5. **Write the Parts.** Copy `assets/template/` to `work/guide/`, edit `meta.json`, then write one file per Part
   (`part_a_overview.py`, `part_b_backend.py`, …) using the helpers in `scripts/lib.py`. Follow
   `references/content-rules.md` (code quality, callouts, tone). Check version-sensitive facts with a quick web search.
6. **Build.** `python3 scripts/build.py work/guide --out work/<Name>-Notes.pdf`. It renders HTML → Chromium PDF, finds the
   page of every Part/Step with pypdf, rebuilds the Sommaire with real numbers and repeats until stable.
   It warns if the Sommaire spills past page 2 (it auto-shrinks, then switches to two columns).
7. **Check.** `python3 scripts/check.py work/<Name>-Notes.pdf` writes a contact sheet PNG — view it and fix orphaned
   headings, overflow, empty pages. View 2–3 pages at higher resolution (`--pages 3,10 --dpi 90`).
   Validate what you can (`tsc --noEmit` on extracted TS, `docker compose config`, `yamllint`). If code was not run, say so.
8. **Deliver.** Send the PDF, then a short summary: Parts/steps covered, bugs/gaps fixed, assumptions, what was validated.
   For follow-ups ("remove Part X", "add DevOps"), edit the Part files, rebuild, resend the same file name.

## Helpers (scripts/lib.py)

```python
from lib import part, step, p, code, table, note, ul, diagram

part("A", "Overview — what the project is", "One-line subtitle.", "overview")   # colour key or hex
step("Architecture & data flow",
     p("Two channels share one Node process…"),          # first <p> becomes the step intro
     diagram("""Browser ──► API ──► MongoDB""", "big picture"),
     table([["Auth", "JWT in cookie", "src/core/jwt.ts"]], head=["Concept", "How", "Where"]),
     code("""export const x = 1;""", "ts", "src/x.ts"),
     note("The repo does X; fixed by Y.", "repo"))        # tip | why | warn | repo | info
```

Part colour keys: `overview backend frontend mobile database security devops testing reference`.

## Hard rules

- Rebuild code CLEAN (typed, small functions, one error shape, comments only for "why"). Never paste the repo's bugs.
- Every fix gets a **vs. the repo** callout naming the original problem.
- Never put real secrets from the repo in the guide — show `<placeholder>` and add a clean-up step instead.
- Cover only what the project really has. No filler sections.
- Never run `playwright install`; use the preinstalled Chromium (build.py finds it). If none exists, see
  `references/pdf-build.md` for the fallback.
