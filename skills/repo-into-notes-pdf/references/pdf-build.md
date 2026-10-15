# PDF build — requirements & troubleshooting

## Requirements
- **Node 20+** and **git**.
- **Chrome, Edge or Chromium** already on the machine (every Windows has Edge). Nothing is downloaded.
- npm packages (`puppeteer-core`, `pdf-lib`, `highlight.js`, `pdfjs-dist`) install themselves on the first run of any
  script (`npm ci` in the skill folder). To do it by hand: `npm ci --omit=dev --omit=optional`.

`scripts/browser.mjs` looks for a browser in this order:
`CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` → Chrome, Edge, Chromium in the usual install folders
(Windows `Program Files` / `LocalAppData`, macOS `/Applications`, Linux `PATH`) → `/opt/pw-browsers/chromium-*`,
`~/.cache/ms-playwright`, `~/.cache/puppeteer`.

No browser at all (bare Linux server / CI):
```bash
npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/puppeteer
```

## How pagination works
1. Parts are `<h1>`, steps are `<h2>` starting with `STEP NN`. Chrome writes them into the PDF outline (`outline: true, tagged: true`).
2. pdf-lib reads the outline → page of each Part/Step → `pages` map.
3. The Sommaire is rebuilt with those numbers and the PDF re-rendered until two passes agree.
4. If the body starts after page 3 (Sommaire overflowed), the Sommaire font shrinks 0.4pt per pass down to 7.4pt,
   then switches to two columns.

`check.mjs` renders pages with pdf.js inside the same headless browser, so it needs no poppler / ImageMagick.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `no page found for: …` | A step's first block isn't rendered, or a custom `<h1>/<h2>` was added inside a step — use `<h3>` for sub-headings. |
| `SyntaxError` in a Part file | An unescaped `` ` `` or `${` inside a `code()` template literal — write `` \` `` and `\${`. |
| Blank page after the cover | Cover taller than the printable area — keep `.cover` height ≤ 256mm. |
| Heading alone at the bottom of a page | Already guarded by `.head::after`; if it persists, split the step's first code block. |
| Long lines overflow | Code wraps (`pre-wrap`); for tables, shorten cell text or use `table(rows, head, "small")`. |
| Fonts look different | Install Inter + DejaVu Sans Mono, or accept the fallbacks (Segoe UI/Roboto, Menlo/Consolas). |
| `npm ci` fails offline | Run it once with network access, or copy a `node_modules/` from another install of the skill. |

## HTML copy
`build.mjs --html` also writes the final HTML next to the PDF (Sommaire numbers included) — handy to inspect the
layout in a normal browser or print it again by hand (A4, background graphics on).
