#!/usr/bin/env node
// Build the notes PDF from a guide folder.
//
// usage: node build.mjs <guide_dir> [--out Notes.pdf] [--html]
//
// <guide_dir> contains meta.json and part_*.mjs files (run in name order).
// Pages are found from the PDF outline Chrome writes, the Sommaire is rebuilt with the
// real numbers, and the build repeats until the numbers are stable.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { SKILL_DIR, need } from "./deps.mjs";
import * as lib from "./lib.mjs";
import { launch } from "./browser.mjs";

const CSS = readFileSync(path.join(SKILL_DIR, "assets/style.css"), "utf8");
const LEGEND = [["tip", "#2563eb", "#eff6ff", "Tip"], ["why", "#7c3aed", "#f5f3ff", "Why"],
                ["warn", "#d97706", "#fffbeb", "Watch out"], ["repo", "#dc2626", "#fef2f2", "vs. the repo"],
                ["info", "#475569", "#f1f5f9", "Note"]];
const e = (s) => lib.esc(s ?? "").replace(/"/g, "&quot;");

async function runParts(guide) {
  lib.reset();
  const files = readdirSync(guide).filter((f) => /^part_.*\.mjs$/.test(f)).sort();
  if (!files.length) die(`no part_*.mjs files in ${guide}`);
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(guide, f)).href);
    if (typeof mod.default !== "function") die(`${f}: must \`export default ({ part, step, … }) => { … }\``);
    mod.default(lib.helpers);
  }
  return [[...lib.OUT], [...lib.TOC]];
}

function cover(meta, toc) {
  const chips = (meta.chips ?? []).map((c) => `<span>${e(c)}</span>`).join("");
  const blurbs = meta.part_blurbs ?? {};
  const parts = toc.filter(([kind]) => kind === "part").map(([, letter, title, color]) =>
    `<div style="--c:${color}"><b>${letter} · ${e(title.split(/ [—-] /)[0])}</b>${e(blurbs[letter])}</div>`).join("");
  return `<section class="cover">
  <div class="kicker">${e(meta.kicker ?? "Project notes · step-by-step guide")}</div>
  <div class="title">${e(meta.title)}</div>
  <div class="subtitle">${e(meta.subtitle)}</div>
  <div class="lead">${e(meta.lead)}</div>
  <div class="chips">${chips}</div>
  <div class="parts">${parts}</div>
  <div class="source"><span>${e(meta.source)}</span><span>${e(meta.date)}</span></div>
</section>`;
}

function sommaire(meta, toc, pages, size, twoCol) {
  const rows = toc.map(([kind, num, title, color]) => {
    const pg = pages[`${kind}:${num}`] ?? "";
    return kind === "part"
      ? `<li class="tp" style="--c:${color}"><span class="t"><span class="lab">PART ${num}</span>${title}</span>` +
        `<span class="dots"></span><span class="pg">${pg}</span></li>`
      : `<li class="ts"><span class="t"><span class="n">${num}</span>${title}</span>` +
        `<span class="dots"></span><span class="pg">${pg}</span></li>`;
  }).join("");
  const legend = LEGEND.map(([, c, b, t]) => `<span style="--nc:${c};--nb:${b}">${t}</span>`).join("");
  const pad = Math.max(0.15, 0.55 * (size / 9.2) ** 3);
  const style = `--toc-size:${size}pt;--toc-pad:${pad.toFixed(2)}mm;--toc-gap:${(2.4 * size / 9.2).toFixed(2)}mm`;
  return `<section class="toc${twoCol ? " two-col" : ""}" style="${style}"><h2>Sommaire</h2>` +
    `<div class="intro">${e(meta.toc_intro ?? "Follow the steps in order; each one builds on the previous.")}</div>` +
    `<ol>${rows}</ol><div class="legend">${legend}</div></section>`;
}

const documentHtml = (meta, body, toc, pages, size, twoCol) =>
  `<!doctype html><html lang="${meta.lang ?? "en"}"><head><meta charset="utf-8">` +
  `<title>${e(meta.title)}</title><style>${CSS}</style></head><body>` +
  `${cover(meta, toc)}${sommaire(meta, toc, pages, size, twoCol)}${body.join("")}</body></html>`;

async function render(page, doc, footerTitle) {
  await page.setContent(doc, { waitUntil: "load" });
  const footer = `<div style="width:100%;font:7.5pt Inter,Arial,sans-serif;color:#94a3b8;padding:0 15mm;` +
    `display:flex;justify-content:space-between"><span>${e(footerTitle)}</span>` +
    `<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  return page.pdf({
    format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<div></div>",
    footerTemplate: footer, outline: true, tagged: true,
    margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
  });
}

/** Map "part:A" / "step:01" -> page number, using the PDF outline. */
async function locate(pdfBytes, toc) {
  const { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef, PDFString, PDFHexString } = await need("pdf-lib");
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const ctx = pdf.context;
  const pageIndex = new Map(pdf.getPages().map((pg, i) => [pg.ref.toString(), i + 1]));
  const look = (obj) => (obj instanceof PDFRef ? ctx.lookup(obj) : obj);
  const text = (obj) => (obj instanceof PDFString || obj instanceof PDFHexString ? obj.decodeText() : String(obj ?? ""));

  // named destinations: /Dests dict (old) or /Names /Dests name tree
  const named = new Map();
  const oldDests = look(pdf.catalog.get(PDFName.of("Dests")));
  if (oldDests instanceof PDFDict) for (const [k, v] of oldDests.entries()) named.set(k.decodeText?.() ?? k.toString().slice(1), v);
  const walkNames = (node) => {
    node = look(node);
    if (!(node instanceof PDFDict)) return;
    const names = look(node.get(PDFName.of("Names")));
    if (names instanceof PDFArray) for (let i = 0; i + 1 < names.size(); i += 2) named.set(text(look(names.get(i))), names.get(i + 1));
    const kids = look(node.get(PDFName.of("Kids")));
    if (kids instanceof PDFArray) for (let i = 0; i < kids.size(); i++) walkNames(kids.get(i));
  };
  const nameRoot = look(pdf.catalog.get(PDFName.of("Names")));
  if (nameRoot instanceof PDFDict) walkNames(nameRoot.get(PDFName.of("Dests")));

  const destPage = (item) => {
    let d = look(item.get(PDFName.of("Dest")));
    if (!d) {
      const act = look(item.get(PDFName.of("A")));
      if (act instanceof PDFDict) d = look(act.get(PDFName.of("D")));
    }
    if (d && !(d instanceof PDFArray)) {
      const key = d instanceof PDFName ? d.decodeText() : text(d);
      d = look(named.get(key));
      if (d instanceof PDFDict) d = look(d.get(PDFName.of("D")));
    }
    return d instanceof PDFArray ? pageIndex.get(d.get(0).toString()) : undefined;
  };

  const flat = [];
  const walk = (first, depth) => {
    for (let ref = first; ref; ) {
      const item = look(ref);
      if (!(item instanceof PDFDict)) break;
      flat.push([text(look(item.get(PDFName.of("Title")))).trim(), destPage(item), depth]);
      walk(item.get(PDFName.of("First")), depth + 1);
      ref = item.get(PDFName.of("Next"));
    }
  };
  const outlines = look(pdf.catalog.get(PDFName.of("Outlines")));
  if (outlines instanceof PDFDict) walk(outlines.get(PDFName.of("First")), 0);

  const isStep = (t) => /^STEP\s*\d+/.test(t);
  const parts = flat.filter(([t, pg, d]) => d === 0 && t !== "Sommaire" && !isStep(t) && pg).map(([, pg]) => pg);
  const steps = flat.filter(([t, pg]) => isStep(t) && pg).map(([, pg]) => pg);
  const pages = {};
  let pi = 0, si = 0;
  for (const [kind, num] of toc) {
    if (kind === "part" && pi < parts.length) pages[`part:${num}`] = parts[pi++];
    else if (kind === "step" && si < steps.length) pages[`step:${num}`] = steps[si++];
  }
  const vals = Object.values(pages);
  return { pages, firstBody: vals.length ? Math.min(...vals) : 3, total: pdf.getPageCount() };
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const { values: a, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: "string" }, html: { type: "boolean", default: false } },
  });
  if (positionals.length !== 1) die("usage: node build.mjs <guide_dir> [--out Notes.pdf] [--html]");
  const guide = path.resolve(positionals[0]);
  if (!existsSync(path.join(guide, "meta.json"))) die(`no meta.json in ${guide}`);
  const meta = JSON.parse(readFileSync(path.join(guide, "meta.json"), "utf8"));
  const out = path.resolve(a.out ?? `${meta.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-Notes.pdf`);
  const [body, toc] = await runParts(guide);
  const nSteps = toc.filter(([k]) => k === "step").length;
  let twoCol = nSteps > 40, size = 9.2;

  const browser = await launch();
  let pages = {}, prev = null, total = 0, doc = "", bytes;
  try {
    const page = await browser.newPage();
    for (let i = 0; i < 6; i++) {
      doc = documentHtml(meta, body, toc, pages, size, twoCol);
      bytes = await render(page, doc, meta.footer ?? meta.title);
      let firstBody;
      ({ pages, firstBody, total } = await locate(bytes, toc));
      // the Sommaire must fit on page 2: the body must start on page 3
      if (firstBody > 3) {
        if (size > 7.4) { size = Math.round((size - 0.4) * 10) / 10; prev = null; continue; }
        if (!twoCol) { twoCol = true; size = 9.0; prev = null; continue; }
        console.log("! Sommaire still longer than one page — shorten step titles.");
      }
      if (JSON.stringify(pages) === JSON.stringify(prev)) break;
      prev = pages;
    }
  } finally {
    await browser.close();
  }
  writeFileSync(out, bytes);
  if (a.html) writeFileSync(out.replace(/\.pdf$/i, "") + ".html", doc);
  const missing = toc.map(([k, n]) => `${k}:${n}`).filter((k) => !(k in pages));
  console.log(`wrote ${out}  (${total} pages, ${toc.length - nSteps} parts, ${nSteps} steps,` +
              ` sommaire ${size}pt${twoCol ? " 2-col" : ""})`);
  if (missing.length) console.log(`! no page found for: ${missing.join(", ")}`);
}

await main();
