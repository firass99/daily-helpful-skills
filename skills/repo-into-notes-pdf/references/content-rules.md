# Content rules

## Each step
- Title: short noun phrase ("Model — User", "Refresh rotation & reuse detection").
- Intro: 1–2 sentences — what the step builds and why. It is the first `p()` of the step.
- Then full code/config blocks with the **file path** as header, tables, ASCII diagrams, callouts.
- End a group of steps with a cheat table when a lifecycle emerges (stage / what happens / where).

## Code
- Rebuild clean: typed, small functions, clear names, one error shape (`{ message, code }`), comments only for "why".
- Show complete files for anything the reader will copy; trim only obvious boilerplate.
- Identity always comes from the verified token (`req.user`), never from `req.body.userId`.
- Whitelist inputs (`.strict()` schemas), never `$set: req.body`.
- Secrets: placeholders (`<openssl rand -hex 32>`), never values from the repo.
- Languages for `code(src, lang, file)`: `ts tsx js jsx json yaml dockerfile bash nginx sql python go java prisma graphql ini toml`.

## Callouts — `note(html, kind)`
| kind | Label | Use for |
|---|---|---|
| `tip` | Tip | shortcut, convention, better habit |
| `why` | Why | the reason behind a design choice |
| `warn` | Watch out | trap, gotcha, irreversible action |
| `repo` | vs. the repo | what the original did wrong and what changed (always name the file/behaviour) |
| `info` | Note | version or environment detail |

## Tables
- Concept maps, route tables (method / route / access / does), role matrices (action / who / how),
  do/don't tables, OWASP mappings, env vars, commands, "bugs fixed" (problem / severity / fix).
- Severity words: Critical, High, Medium, Low.

## Tone
- Short sentences. No filler, no marketing, no emojis.
- Explain the concept once, then show the code.
- Cover only what the project really has. A guide of 25–45 pages is typical; shorter is fine for small repos.

## Language
English by default. If French is asked, translate prose and table text; keep code, identifiers and file paths in English.
