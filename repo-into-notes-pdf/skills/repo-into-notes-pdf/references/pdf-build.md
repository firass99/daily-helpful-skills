# PDF build — requirements & troubleshooting

## Requirements
```bash
pip install -r requirements.txt     # pygments, pypdf, playwright, pillow
python3 -m playwright install chromium   # ONLY on your own machine, never inside a sandbox that already has Chromium
# poppler-utils (pdftoppm) for check.py:  apt install poppler-utils  |  brew install poppler
```
`build.py` tries, in order: Playwright's default Chromium → `/opt/pw-browsers/chromium-*` →
`~/.cache/ms-playwright` → installed Chrome / Edge.

## How pagination works
1. Parts are `<h1>`, steps are `<h2>` starting with `STEP NN`. Chromium writes them into the PDF outline (`outline=True, tagged=True`).
2. pypdf reads the outline → page of each Part/Step → `pages` dict.
3. The Sommaire is rebuilt with those numbers and the PDF re-rendered until two passes agree.
4. If the body starts after page 3 (Sommaire overflowed), the Sommaire font shrinks 0.4pt per pass down to 7.4pt,
   then switches to two columns.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `no page found for: …` | A step's first block isn't rendered, or a custom `<h1>/<h2>` was added inside a step — use `<h3>` for sub-headings. |
| Blank page after the cover | Cover taller than the printable area — keep `.cover` height ≤ 256mm. |
| Heading alone at the bottom of a page | Already guarded by `.head::after`; if it persists, split the step's first code block. |
| Long lines overflow | Code wraps (`pre-wrap`); for tables, shorten cell text or use `table(..., cls="small")`. |
| Fonts look different | Install Inter + DejaVu Sans Mono, or accept the fallbacks (Segoe UI/Roboto, Menlo/Consolas). |

## Without Chromium
Write the HTML with `build.py --html`, open it in any browser and print to PDF (A4, background graphics on).
Page numbers in the Sommaire will then be blank — say so in the summary.
