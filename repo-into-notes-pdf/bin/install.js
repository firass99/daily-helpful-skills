#!/usr/bin/env node
// Installer for the repo-into-notes-pdf Claude skill. Zero dependencies.
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");

const NAME = "repo-into-notes-pdf";
const SRC = path.join(__dirname, "..", "skills", NAME);
const HELP = `
${NAME} — Claude skill: GitHub repo → step-by-step PDF notes

Usage
  npx ${NAME}                    install for Claude Code, all projects   (~/.claude/skills/${NAME})
  npx ${NAME} --project          install for this project only           (./.claude/skills/${NAME})
  npx ${NAME} --dir <path>       install into <path>/${NAME}
  npx ${NAME} --zip [file]       build a .zip to upload as a skill in Claude.ai
  npx ${NAME} uninstall [--project | --dir <path>]
  npx ${NAME} --check            check Python / Chromium / poppler requirements

Options
  --force   overwrite an existing install
  --help    show this help
`;

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

function target() {
  if (val("--dir")) return path.resolve(val("--dir"), NAME);
  if (has("--project")) return path.resolve(".claude", "skills", NAME);
  return path.join(os.homedir(), ".claude", "skills", NAME);
}

function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.name === "__pycache__" || e.name === ".DS_Store") return [];
    return e.isDirectory() ? files(p, base) : [path.relative(base, p)];
  });
}

function install() {
  const dest = target();
  if (fs.existsSync(dest)) {
    if (!has("--force")) {
      console.error(`✗ ${dest} already exists. Re-run with --force to overwrite.`);
      process.exit(1);
    }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(SRC, dest, { recursive: true, filter: (s) => !s.includes("__pycache__") });
  for (const f of files(path.join(dest, "scripts"))) fs.chmodSync(path.join(dest, "scripts", f), 0o755);
  console.log(`✓ Installed ${NAME} → ${dest}`);
  console.log(`\nIn Claude Code, try:\n  "Make step-by-step notes PDF from https://github.com/owner/repo"\n`);
  check(true);
}

function uninstall() {
  const dest = target();
  if (!fs.existsSync(dest)) return console.log(`Nothing at ${dest}`);
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`✓ Removed ${dest}`);
}

function check(quiet = false) {
  const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
  const rows = [];
  rows.push(["python3", !!py]);
  if (py) {
    for (const mod of ["pygments", "pypdf", "playwright", "PIL"]) {
      rows.push([`python: ${mod}`, spawnSync(py, ["-c", `import ${mod}`]).status === 0]);
    }
  }
  rows.push(["git", spawnSync("git", ["--version"]).status === 0]);
  rows.push(["pdftoppm (poppler)", spawnSync("pdftoppm", ["-v"]).status === 0 || spawnSync("pdftoppm", ["-v"]).stderr?.length > 0]);
  const missing = rows.filter(([, ok]) => !ok);
  if (quiet && !missing.length) return;
  console.log("Requirements (needed where the skill runs):");
  for (const [n, ok] of rows) console.log(`  ${ok ? "✓" : "✗"} ${n}`);
  if (missing.length) {
    console.log(`\nInstall the missing pieces:
  pip install pygments pypdf playwright pillow
  python3 -m playwright install chromium
  apt install poppler-utils   # or: brew install poppler`);
  }
}

// --- tiny zip writer (deflate) so --zip works without the `zip` binary ---
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(out) {
  const entries = files(SRC).map((rel) => {
    const name = `${NAME}/${rel.split(path.sep).join("/")}`;
    const raw = fs.readFileSync(path.join(SRC, rel));
    return { name: Buffer.from(name), raw, data: zlib.deflateRawSync(raw), crc: crc32(raw) };
  });
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(0x00210000, 10); // DOS time/date: 1980-01-01
    h.writeUInt32LE(e.crc, 14); h.writeUInt32LE(e.data.length, 18); h.writeUInt32LE(e.raw.length, 22);
    h.writeUInt16LE(e.name.length, 26);
    chunks.push(h, e.name, e.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10); c.writeUInt32LE(0x00210000, 12); c.writeUInt32LE(e.crc, 16);
    c.writeUInt32LE(e.data.length, 20); c.writeUInt32LE(e.raw.length, 24); c.writeUInt16LE(e.name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, e.name);
    offset += 30 + e.name.length + e.data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(out, Buffer.concat([...chunks, cd, end]));
  console.log(`✓ Wrote ${out} (${entries.length} files)\n  Upload it in Claude.ai under your Skills settings (upload a skill).`);
}

if (has("--help") || has("-h")) console.log(HELP);
else if (args[0] === "uninstall") uninstall();
else if (has("--check")) check();
else if (has("--zip")) zip(path.resolve(val("--zip") || `${NAME}.zip`));
else install();
