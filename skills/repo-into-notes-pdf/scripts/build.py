#!/usr/bin/env python3
"""Build the notes PDF from a guide folder.

usage: build.py <guide_dir> [--out Notes.pdf] [--html]

<guide_dir> contains meta.json and part_*.py files (run in name order).
Pages are found from the PDF outline Chromium writes, the Sommaire is rebuilt with the
real numbers, and the build repeats until the numbers are stable (max 4 passes).
"""
import argparse, glob, html, json, os, re, runpy, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import lib  # noqa: E402

CSS = (HERE.parent / "assets" / "style.css").read_text()
LEGEND = [("tip", "#2563eb", "#eff6ff", "Tip"), ("why", "#7c3aed", "#f5f3ff", "Why"),
          ("warn", "#d97706", "#fffbeb", "Watch out"), ("repo", "#dc2626", "#fef2f2", "vs. the repo"),
          ("info", "#475569", "#f1f5f9", "Note")]


def run_parts(guide: Path):
    lib.reset()
    files = sorted(glob.glob(str(guide / "part_*.py")))
    if not files:
        sys.exit(f"no part_*.py files in {guide}")
    for f in files:
        runpy.run_path(f, run_name="__guide__")
    return list(lib.OUT), list(lib.TOC)


def cover(meta: dict, toc) -> str:
    e = html.escape
    chips = "".join(f"<span>{e(c)}</span>" for c in meta.get("chips", []))
    blurbs = meta.get("part_blurbs", {})
    parts = "".join(
        f'<div style="--c:{color}"><b>{letter} · {e(re.split(r" [—-] ", title)[0])}</b>{e(blurbs.get(letter, ""))}</div>'
        for kind, letter, title, color in toc if kind == "part")
    return f"""<section class="cover">
  <div class="kicker">{e(meta.get("kicker", "Project notes · step-by-step guide"))}</div>
  <div class="title">{e(meta["title"])}</div>
  <div class="subtitle">{e(meta.get("subtitle", ""))}</div>
  <div class="lead">{e(meta.get("lead", ""))}</div>
  <div class="chips">{chips}</div>
  <div class="parts">{parts}</div>
  <div class="source"><span>{e(meta.get("source", ""))}</span><span>{e(meta.get("date", ""))}</span></div>
</section>"""


def sommaire(meta: dict, toc, pages: dict, size: float, two_col: bool) -> str:
    rows = []
    for kind, num, title, color in toc:
        pg = pages.get(f"{kind}:{num}", "")
        if kind == "part":
            rows.append(f'<li class="tp" style="--c:{color}"><span class="t"><span class="lab">PART {num}</span>'
                        f'{title}</span><span class="dots"></span><span class="pg">{pg}</span></li>')
        else:
            rows.append(f'<li class="ts"><span class="t"><span class="n">{num}</span>{title}</span>'
                        f'<span class="dots"></span><span class="pg">{pg}</span></li>')
    legend = "".join(f'<span style="--nc:{c};--nb:{b}">{t}</span>' for _, c, b, t in LEGEND)
    pad = max(0.15, 0.55 * (size / 9.2) ** 3)
    style = f"--toc-size:{size}pt;--toc-pad:{pad:.2f}mm;--toc-gap:{2.4 * size / 9.2:.2f}mm"
    return (f'<section class="toc{" two-col" if two_col else ""}" style="{style}"><h2>Sommaire</h2>'
            f'<div class="intro">{html.escape(meta.get("toc_intro", "Follow the steps in order; each one builds on the previous."))}</div>'
            f'<ol>{"".join(rows)}</ol><div class="legend">{legend}</div></section>')


def document(meta, body, toc, pages, size, two_col) -> str:
    return (f'<!doctype html><html lang="{meta.get("lang", "en")}"><head><meta charset="utf-8">'
            f'<title>{html.escape(meta["title"])}</title><style>{CSS}</style></head><body>'
            f'{cover(meta, toc)}{sommaire(meta, toc, pages, size, two_col)}{"".join(body)}</body></html>')


def launch(pw):
    try:
        return pw.chromium.launch()
    except Exception as first:
        candidates = glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome") + \
                     glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-*/chrome"))
        for exe in candidates:
            try:
                return pw.chromium.launch(executable_path=exe)
            except Exception:
                pass
        for ch in ("chrome", "msedge"):
            try:
                return pw.chromium.launch(channel=ch)
            except Exception:
                pass
        sys.exit(f"No Chromium found ({first}). See references/pdf-build.md.")


def render(page, doc: str, out: Path, footer_title: str):
    page.set_content(doc, wait_until="networkidle")
    footer = (f'<div style="width:100%;font:7.5pt Inter,Arial,sans-serif;color:#94a3b8;padding:0 15mm;'
              f'display:flex;justify-content:space-between"><span>{html.escape(footer_title)}</span>'
              f'<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')
    page.pdf(path=str(out), format="A4", print_background=True, display_header_footer=True,
             header_template="<div></div>", footer_template=footer, outline=True, tagged=True,
             margin={"top": "16mm", "bottom": "18mm", "left": "15mm", "right": "15mm"})


def locate(pdf: Path, toc) -> tuple[dict, int, int]:
    """Map 'part:A' / 'step:01' -> page number, using the PDF outline. Also return Sommaire end page."""
    from pypdf import PdfReader
    r = PdfReader(str(pdf))
    flat = []
    def walk(items, depth=0):
        for it in items:
            if isinstance(it, list):
                walk(it, depth + 1)
            else:
                flat.append((it.title.strip(), r.get_destination_page_number(it) + 1, depth))
    walk(r.outline)
    parts = [pg for t, pg, d in flat if d == 0 and t != "Sommaire" and not re.match(r"STEP\s*\d+", t)]
    steps = [pg for t, pg, d in flat if re.match(r"STEP\s*\d+", t)]
    toc_page = next((pg for t, pg, _ in flat if t == "Sommaire"), 2)
    pages, pi, si = {}, 0, 0
    for kind, num, *_ in toc:
        if kind == "part" and pi < len(parts):
            pages[f"part:{num}"] = parts[pi]; pi += 1
        elif kind == "step" and si < len(steps):
            pages[f"step:{num}"] = steps[si]; si += 1
    first_body = min(pages.values()) if pages else 3
    return pages, toc_page, first_body, len(r.pages)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("guide")
    ap.add_argument("--out", default=None)
    ap.add_argument("--html", action="store_true", help="also write the final HTML next to the PDF")
    a = ap.parse_args()
    guide = Path(a.guide).resolve()
    meta = json.loads((guide / "meta.json").read_text())
    out = Path(a.out or f"{re.sub(r'[^A-Za-z0-9]+', '-', meta['title']).strip('-')}-Notes.pdf").resolve()
    body, toc = run_parts(guide)
    n_steps = sum(k == "step" for k, *_ in toc)
    two_col, size = n_steps > 40, 9.2

    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = launch(pw)
        page = browser.new_page()
        pages, prev = {}, None
        for i in range(6):
            doc = document(meta, body, toc, pages, size, two_col)
            render(page, doc, out, meta.get("footer", meta["title"]))
            pages, toc_page, first_body, total = locate(out, toc)
            # Sommaire must fit on page 2: body must start on page 3
            if first_body > 3:
                if size > 7.4:
                    size = round(size - 0.4, 1); prev = None; continue
                if not two_col:
                    two_col, size = True, 9.0; prev = None; continue
                print("! Sommaire still longer than one page — shorten step titles.")
            if pages == prev:
                break
            prev = pages
        browser.close()
    if a.html:
        out.with_suffix(".html").write_text(doc)
    missing = [f"{k}:{n}" for k, n, *_ in toc if f"{k}:{n}" not in pages]
    print(f"wrote {out}  ({total} pages, {sum(k == 'part' for k, *_ in toc)} parts, {n_steps} steps,"
          f" sommaire {size}pt{' 2-col' if two_col else ''})")
    if missing:
        print(f"! no page found for: {', '.join(missing)}")


if __name__ == "__main__":
    main()
