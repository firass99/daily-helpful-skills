#!/usr/bin/env node
// Visual check of a built PDF — pages are rendered by pdf.js inside the same headless Chrome/Edge.
//
// usage: node check.mjs Notes.pdf                       -> Notes-contact.png (all pages, small)
//        node check.mjs Notes.pdf --pages 3,10 --dpi 90  -> Notes-p3.png, Notes-p10.png (readable size)
//
// Look for: orphaned headings at page bottoms, code overflowing the page, near-empty pages,
// a Sommaire longer than page 2.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pkgDir } from "./deps.mjs";
import { launch } from "./browser.mjs";

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #e5e7eb; font: 11px Arial, sans-serif; }
  #sheet { display: grid; gap: 8px; padding: 8px; width: max-content; }
  #sheet div { color: #111827; } #sheet img { display: block; margin-top: 2px; outline: 1px solid #cbd5e1; }
  #sheet .empty img { outline: 3px solid #dc2626; }
</style></head><body><div id="sheet"></div><script type="module">
  import * as pdfjs from "/pdfjs/pdf.min.mjs";
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  // render pages (1-based, all if empty) -> [{ n, url, dark }]; dark = share of non-white pixels
  window.renderPages = async (scale, wanted) => {
    const doc = await pdfjs.getDocument("/doc.pdf").promise;
    const nums = wanted.length ? wanted : Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const out = [];
    for (const n of nums) {
      if (n < 1 || n > doc.numPages) continue;
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale });
      const canvas = Object.assign(document.createElement("canvas"), { width: vp.width, height: vp.height });
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 200) dark++;
      out.push({ n, url: canvas.toDataURL("image/png"), dark: dark / (canvas.width * canvas.height) });
    }
    return out;
  };
  window.ready = true;
</script></body></html>`;

function serve(pdfBytes) {
  const build = path.join(pkgDir("pdfjs-dist"), "build");
  const server = createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/") return res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    if (url === "/doc.pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end(pdfBytes);
    const m = url.match(/^\/pdfjs\/([\w.-]+\.mjs)$/);
    if (m) return res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(path.join(build, m[1])));
    res.writeHead(404).end();
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const png = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");

async function main() {
  const { values: a, positionals } = parseArgs({
    allowPositionals: true,
    options: { pages: { type: "string" }, dpi: { type: "string", default: "90" }, cols: { type: "string", default: "8" } },
  });
  if (positionals.length !== 1) {
    console.error("usage: node check.mjs Notes.pdf [--pages 3,10] [--dpi 90] [--cols 8]");
    process.exit(1);
  }
  const pdf = path.resolve(positionals[0]);
  const stem = pdf.replace(/\.pdf$/i, "");
  const server = await serve(readFileSync(pdf));
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.ready === true);

    if (a.pages) {
      const wanted = a.pages.split(",").map(Number);
      for (const r of await page.evaluate((s, w) => window.renderPages(s, w), Number(a.dpi) / 72, wanted)) {
        writeFileSync(`${stem}-p${r.n}.png`, png(r.url));
        console.log(`${stem}-p${r.n}.png`);
      }
      return;
    }

    const shots = await page.evaluate((s) => window.renderPages(s, []), 40 / 72);
    for (const r of shots)
      if (r.n > 2 && r.dark < 0.015) console.log(`! page ${r.n} looks almost empty`);
    await page.evaluate((shots, cols) => {
      const sheet = document.getElementById("sheet");
      sheet.style.gridTemplateColumns = `repeat(${Math.min(cols, shots.length)}, auto)`;
      for (const r of shots) {
        const cell = document.createElement("div");
        if (r.n > 2 && r.dark < 0.015) cell.className = "empty";
        cell.innerHTML = `p${r.n}<img src="${r.url}">`;
        sheet.append(cell);
      }
      return Promise.all([...sheet.querySelectorAll("img")].map((i) => i.decode()));
    }, shots, Number(a.cols));
    const dest = `${stem}-contact.png`;
    await (await page.$("#sheet")).screenshot({ path: dest });
    console.log(`${dest}  (${shots.length} pages)`);
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
