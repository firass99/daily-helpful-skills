#!/usr/bin/env python3
"""Visual check of a built PDF.

usage: check.py Notes.pdf                      -> Notes-contact.png (all pages, small)
       check.py Notes.pdf --pages 3,10 --dpi 90 -> Notes-p3.png, Notes-p10.png (readable size)

Look for: orphaned headings at page bottoms, code overflowing the page, near-empty pages,
a Sommaire longer than page 2.
"""
import argparse, subprocess, tempfile
from pathlib import Path

from PIL import Image, ImageDraw


def rasterise(pdf: Path, dpi: int, first=None, last=None) -> list[Path]:
    tmp = Path(tempfile.mkdtemp())
    cmd = ["pdftoppm", "-png", "-r", str(dpi)]
    if first:
        cmd += ["-f", str(first), "-l", str(last or first)]
    subprocess.run(cmd + [str(pdf), str(tmp / "p")], check=True)
    return sorted(tmp.glob("p-*.png"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--pages", help="comma-separated page numbers to export at --dpi")
    ap.add_argument("--dpi", type=int, default=90)
    ap.add_argument("--cols", type=int, default=8)
    a = ap.parse_args()
    pdf = Path(a.pdf).resolve()

    if a.pages:
        for n in [int(x) for x in a.pages.split(",")]:
            img = rasterise(pdf, a.dpi, n)[0]
            dest = pdf.with_name(f"{pdf.stem}-p{n}.png")
            img.replace(dest)
            print(dest)
        return

    imgs = [Image.open(p) for p in rasterise(pdf, 40)]
    w, h = imgs[0].size
    rows = -(-len(imgs) // a.cols)
    sheet = Image.new("RGB", (a.cols * (w + 8) + 8, rows * (h + 22) + 8), "#e5e7eb")
    d = ImageDraw.Draw(sheet)
    for i, im in enumerate(imgs):
        x, y = 8 + (i % a.cols) * (w + 8), 8 + (i // a.cols) * (h + 22)
        sheet.paste(im, (x, y + 14))
        d.text((x, y), f"p{i + 1}", fill="#111827")
        # flag near-empty pages (mostly white)
        gray = im.convert("L")
        dark = sum(gray.histogram()[:200]) / (w * h)
        if dark < 0.015 and i > 1:
            d.rectangle([x - 2, y + 12, x + w + 2, y + h + 16], outline="#dc2626", width=3)
            print(f"! page {i + 1} looks almost empty")
    dest = pdf.with_name(f"{pdf.stem}-contact.png")
    sheet.save(dest)
    print(f"{dest}  ({len(imgs)} pages)")


if __name__ == "__main__":
    main()
