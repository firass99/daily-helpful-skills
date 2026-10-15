// Helpers for writing guide Parts. Each part_*.mjs gets them as its argument:
//
//   export default ({ part, step, p, code, table, note, ul, diagram, c }) => { … };
//
// All helpers return HTML strings; part() and step() append to the document.
import { need } from "./deps.mjs";

const { default: hljs } = await need("highlight.js");

export const COLORS = {
  overview: "#64748b", backend: "#2563eb", frontend: "#7c3aed", mobile: "#0891b2",
  database: "#0d9488", security: "#059669", devops: "#d97706", testing: "#db2777",
  reference: "#475569",
};
const LABELS = { tip: "Tip", why: "Why", warn: "Watch out", repo: "vs. the repo", info: "Note" };
const ALIASES = { prisma: "graphql", toml: "ini", sh: "bash", shell: "bash", yml: "yaml", docker: "dockerfile" };

export const OUT = [];
export const TOC = [];
let n = 0;

export function reset() {
  OUT.length = 0; TOC.length = 0; n = 0;
}

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Strip the blank first/last lines and the common indentation (like Python's textwrap.dedent). */
export function dedent(src) {
  const lines = String(src).replace(/\t/g, "    ").replace(/^\s*\n|\n\s*$/g, "").split("\n");
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join("\n");
}

/** Inline code: c("req.user") */
export const c = (s) => `<code>${esc(s)}</code>`;

export function code(src, lang = "ts", file = null) {
  src = dedent(src);
  const language = ALIASES[lang] ?? lang;
  const body = hljs.getLanguage(language) ? hljs.highlight(src, { language, ignoreIllegals: true }).value : esc(src);
  return `<div class="code"><div class="file">${esc(file || lang)}</div><pre>${body}</pre></div>`;
}

export function diagram(src, title = "diagram") {
  return `<div class="code diagram"><div class="file">${esc(title)}</div><pre>${esc(dedent(src))}</pre></div>`;
}

export function table(rows, head = null, cls = "") {
  const h = head ? `<thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead>` : "";
  const b = rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("");
  return `<table class="${cls}">${h}<tbody>${b}</tbody></table>`;
}

export const note = (html, kind = "tip") => `<div class="note ${kind}"><b>${LABELS[kind]}</b>${html}</div>`;

export const ul = (items, check = false) =>
  `<ul${check ? ' class="check"' : ""}>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

export const p = (html) => `<p>${html}</p>`;

export function part(letter, title, sub, color = "overview") {
  color = COLORS[color] ?? color;
  TOC.push(["part", letter, title, color]);
  OUT.push(`<section class="part" style="--c:${color}"><div class="part-letter">Part ${letter}</div>` +
           `<h1>${title}</h1><p>${sub}</p></section>`);
}

export function step(title, ...blocks) {
  const num = String(++n).padStart(2, "0");
  TOC.push(["step", num, title, null]);
  const intro = blocks[0]?.startsWith("<p>") ? blocks.shift() : "";
  OUT.push(`<section class="step"><div class="head"><h2><span class="n">STEP ${num}</span>${title}</h2>${intro}</div>` +
           `${blocks.join("")}</section>`);
}

export const helpers = { part, step, p, code, table, note, ul, diagram, c, esc };
