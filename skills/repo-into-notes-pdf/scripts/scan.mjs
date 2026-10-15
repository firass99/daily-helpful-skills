#!/usr/bin/env node
// Clone (or open) one or more repos and write a structured map to <out>/scan.json.
//
// usage: node scan.mjs <url-or-path> [<url-or-path> ...] [--out work/]
//
// The map tells you WHAT to read (stack, layers, key files, env vars, red flags).
// It does not replace reading the files.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "out", "coverage", "vendor",
  "__pycache__", ".venv", "venv", "target", ".turbo", ".cache"]);

// dependency -> [layer, label]
const DEPS = {
  express: ["backend", "Express"], "@nestjs/core": ["backend", "NestJS"], fastify: ["backend", "Fastify"],
  koa: ["backend", "Koa"], hono: ["backend", "Hono"],
  next: ["frontend", "Next.js"], react: ["frontend", "React"], vue: ["frontend", "Vue"],
  "@angular/core": ["frontend", "Angular"], svelte: ["frontend", "Svelte"], nuxt: ["frontend", "Nuxt"],
  vite: ["frontend", "Vite"], "@tanstack/react-query": ["frontend", "TanStack Query"],
  "@reduxjs/toolkit": ["frontend", "Redux Toolkit"], zustand: ["frontend", "Zustand"],
  axios: ["tooling", "Axios"], "react-hook-form": ["frontend", "react-hook-form"],
  tailwindcss: ["frontend", "Tailwind CSS"],
  "react-native": ["mobile", "React Native"], expo: ["mobile", "Expo"],
  mongoose: ["database", "Mongoose"], prisma: ["database", "Prisma"], "@prisma/client": ["database", "Prisma"],
  typeorm: ["database", "TypeORM"], sequelize: ["database", "Sequelize"], "drizzle-orm": ["database", "Drizzle"],
  pg: ["database", "PostgreSQL"], mysql2: ["database", "MySQL"], redis: ["database", "Redis"],
  ioredis: ["database", "Redis"],
  jsonwebtoken: ["security", "jsonwebtoken"], passport: ["security", "Passport"], bcrypt: ["security", "bcrypt"],
  bcryptjs: ["security", "bcryptjs"], argon2: ["security", "argon2"], helmet: ["security", "helmet"],
  "express-rate-limit": ["security", "express-rate-limit"], cors: ["security", "cors"],
  "next-auth": ["security", "NextAuth"], zod: ["security", "Zod"], joi: ["security", "Joi"],
  "express-validator": ["security", "express-validator"], speakeasy: ["security", "speakeasy (2FA)"],
  "socket.io": ["realtime", "Socket.IO"], ws: ["realtime", "ws"],
  bullmq: ["jobs", "BullMQ"], "node-cron": ["jobs", "node-cron"],
  nodemailer: ["integrations", "Nodemailer"], resend: ["integrations", "Resend"], stripe: ["integrations", "Stripe"],
  "@aws-sdk/client-s3": ["integrations", "AWS S3"], cloudinary: ["integrations", "Cloudinary"],
  multer: ["integrations", "Multer"], "swagger-ui-express": ["integrations", "Swagger UI"],
  jest: ["testing", "Jest"], vitest: ["testing", "Vitest"], supertest: ["testing", "Supertest"],
  "@playwright/test": ["testing", "Playwright"], cypress: ["testing", "Cypress"],
  typescript: ["tooling", "TypeScript"], winston: ["tooling", "winston"], pino: ["tooling", "pino"],
};
const PY_DEPS = { django: ["backend", "Django"], fastapi: ["backend", "FastAPI"], flask: ["backend", "Flask"],
  sqlalchemy: ["database", "SQLAlchemy"], pytest: ["testing", "pytest"], celery: ["jobs", "Celery"] };

// path pattern -> layer
const PATH_RULES = [
  [/(^|\/)(routes?|controllers?|services?|middlewares?|handlers?)\//i, "backend"],
  [/(^|\/)(models?|schemas?|entities|migrations|prisma)\/|schema\.prisma$/i, "database"],
  [/(^|\/)(app|pages|components|hooks|features|store|context)\/.*\.(tsx|jsx|vue|svelte)$/i, "frontend"],
  [/(^|\/)(auth|jwt|passport|session)[^/]*\.(ts|js|py)$/i, "security"],
  [/(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|\.dockerignore)$/i, "devops"],
  [/(^|\/)\.github\/workflows\/|(^|\/)(k8s|kubernetes|helm|terraform)\/|nginx[^/]*\.conf$/i, "devops"],
  [/(^|\/)(tests?|__tests__|e2e|spec)\/|\.(test|spec)\.(ts|tsx|js|py)$/i, "testing"],
  [/(^|\/)(socket|realtime|ws)[^/]*\.(ts|js)$/i, "realtime"],
  [/(^|\/)(mail|email|templates)\//i, "integrations"],
  [/(^|\/)(config|env)[^/]*\.(ts|js|py)$|(^|\/)config\//i, "config"],
];
const ENTRY = /(^|\/)(app|server|index|main)\.(ts|js|mjs|cjs|py)$|(^|\/)(next|vite|nest-cli)\.config\.|(^|\/)(layout|middleware|proxy)\.(ts|tsx)$/;
const ENV_RE = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)|process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)|os\.environ(?:\.get)?\(?\[?['"]([A-Za-z_][A-Za-z0-9_]*)/g;
const SECRET_RE = /(mongodb(\+srv)?:\/\/[^\s'"]*:[^\s'"@]+@|sk_live_[0-9a-zA-Z]{10,}|re_[0-9A-Za-z]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[0-9A-Za-z]{30,})/;
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".vue", ".svelte"]);

const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return null; } };
const git = (...args) => execFileSync("git", args, { stdio: ["ignore", "pipe", "inherit"] }).toString();

function fetch(src, out) {
  if (existsSync(src) && statSync(src).isDirectory()) return path.resolve(src);
  const m = src.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:\/tree\/([^?#]+))?\/?$/);
  const name = m ? `${m[1]}__${m[2]}` : src.replace(/\W+/g, "_").slice(-60);
  const url = m ? `https://github.com/${m[1]}/${m[2]}.git` : src;
  const dest = path.join(out, "repos", name);
  if (!existsSync(dest)) {
    mkdirSync(path.dirname(dest), { recursive: true });
    const branch = m?.[3] ? ["--branch", m[3].split("/")[0]] : [];
    // committed node_modules are never read and break checkouts (long paths on Windows): leave them out
    execFileSync("git", ["clone", "--depth", "1", "--no-checkout", ...branch, url, dest], { stdio: "inherit" });
    git("-C", dest, "sparse-checkout", "set", "--no-cone", "/*", "!node_modules/");
    git("-C", dest, "-c", "core.longpaths=true", "checkout");
  }
  return dest;
}

function* walk(dir) {
  const ents = readdirSync(dir, { withFileTypes: true });
  for (const ent of ents) if (ent.isFile()) yield path.join(dir, ent.name);
  for (const ent of ents) if (ent.isDirectory() && !SKIP_DIRS.has(ent.name)) yield* walk(path.join(dir, ent.name));
}

function tree(root, depth = 3, maxEntries = 200) {
  const lines = [];
  const rec = (d, prefix, lvl) => {
    if (lvl > depth || lines.length > maxEntries) return;
    let items;
    try { items = readdirSync(d, { withFileTypes: true }); } catch { return; }
    items = items.filter((i) => !SKIP_DIRS.has(i.name) && i.name !== ".DS_Store")
      .sort((x, y) => (x.isFile() - y.isFile()) || x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
    for (const i of items) {
      lines.push(`${prefix}${i.name}${i.isDirectory() ? "/" : ""}`);
      if (i.isDirectory()) rec(path.join(d, i.name), prefix + "  ", lvl + 1);
    }
  };
  rec(root, "", 1);
  return lines.slice(0, maxEntries).join("\n") + (lines.length > maxEntries ? "\n…" : "");
}

function tracked(root, pathspec) {
  try {
    return execFileSync("git", ["-C", root, "ls-files", "--", pathspec], { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 })
      .toString().trim() !== "";
  } catch { return false; }
}

function scan(root) {
  const rel = (f) => path.relative(root, f).split(path.sep).join("/");
  const res = { root, packages: [], stack: {}, layers: {}, entry_points: [], env_vars_read: [], env_files: [],
                red_flags: [], stats: {} };
  const envVars = new Set(), files = [...walk(root)];
  const lockfiles = files.filter((f) => ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"]
    .includes(path.basename(f))).map(rel);
  const flag = (s) => res.red_flags.push(s);

  for (const f of files) {
    const r = rel(f), base = path.basename(f), ext = path.extname(f);
    if (base === "package.json") {
      let pkg;
      try { pkg = JSON.parse(read(f)); } catch { pkg = null; }
      if (pkg) {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        res.packages.push({ path: r, name: pkg.name ?? null, scripts: pkg.scripts ?? {}, type: pkg.type ?? "commonjs", deps });
        for (const [d, v] of Object.entries(deps))
          if (DEPS[d]) (res.stack[DEPS[d][0]] ??= {})[DEPS[d][1]] = v;
        for (const fake of ["crypto", "fs", "path", "http", "events"])
          if (fake in deps) flag(`${r}: '${fake}' listed as an npm dependency (Node built-in)`);
        if ((pkg.scripts?.test ?? "").startsWith("echo")) flag(`${r}: no test script`);
      }
    }
    if (base === "requirements.txt" || base === "pyproject.toml") {
      const txt = (read(f) ?? "").toLowerCase();
      for (const [d, [layer, label]] of Object.entries(PY_DEPS))
        if (new RegExp(`\\b${d}\\b`).test(txt)) (res.stack[layer] ??= {})[label] = "?";
    }
    if (/^\.env($|\.)/.test(base)) {
      res.env_files.push(r);
      if (!/(example|sample|template)$/.test(base)) flag(`${r}: env file committed to git — treat its values as leaked`);
    }
    const rule = PATH_RULES.find(([pat]) => pat.test(r));
    if (rule) (res.layers[rule[1]] ??= []).push(r);
    if (ENTRY.test(r) && r.split("/").length - 1 <= 3) res.entry_points.push(r);
    if (CODE_EXT.has(ext) || base.startsWith("docker-compose") || base.startsWith("compose")) {
      const txt = read(f);
      if (txt === null || txt.length > 400_000) continue;
      for (const m of txt.matchAll(ENV_RE)) envVars.add(m[1] ?? m[2] ?? m[3]);
      if (SECRET_RE.test(txt)) flag(`${r}: looks like a hard-coded secret / credential`);
      if (/\$set:\s*\{?\s*(\.\.\.)?req\.body|\.create\(\s*req\.body\s*\)|Update\w*\([^)]*,\s*req\.body\s*[,)]|\{\s*\.\.\.req\.body/i.test(txt))
        flag(`${r}: mass assignment (req.body written straight to the DB)`);
      if (/req\.body\.(userId|user_id|sender|hrId)/.test(txt)) flag(`${r}: identity taken from the request body`);
      if (/err(or)?\.stack/.test(txt) && /res\.(status|json|send)/.test(txt)) flag(`${r}: may send stack traces to the client`);
      if (/localStorage\.(set|get)Item\(['"][^'"]*token/i.test(txt)) flag(`${r}: token stored in localStorage`);
    }
  }

  if (tracked(root, ":(glob)**/node_modules/**")) flag("node_modules/ is committed");
  if (lockfiles.length > 1) flag(`several lockfiles: ${lockfiles.join(", ")}`);

  res.env_vars_read = [...envVars].sort();
  res.layers = Object.fromEntries(Object.keys(res.layers).sort().map((k) => [k, res.layers[k].sort().slice(0, 80)]));
  res.stats = { files: files.length, code_files: files.filter((f) => CODE_EXT.has(path.extname(f))).length, lockfiles };
  res.tree = tree(root);
  for (const doc of ["README.md", "readme.md", "README"]) {
    const txt = read(path.join(root, doc));
    if (txt !== null) { res.readme_excerpt = txt.slice(0, 3000); break; }
  }
  return res;
}

const { values: a, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string", default: "work" } } });
if (!positionals.length) {
  console.error("usage: node scan.mjs <url-or-path> [<url-or-path> ...] [--out work/]");
  process.exit(1);
}
mkdirSync(a.out, { recursive: true });
const results = positionals.map((s) => ({ source: s, ...scan(fetch(s, a.out)) }));
writeFileSync(path.join(a.out, "scan.json"), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`\n== ${r.source}  (${r.stats.files} files)`);
  for (const [layer, libs] of Object.entries(r.stack))
    console.log(`  ${layer.padEnd(13)} ${Object.entries(libs).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  layers found: ${Object.entries(r.layers).map(([k, v]) => `${k}(${v.length})`).join(", ")}`);
  console.log(`  env vars read: ${r.env_vars_read.join(", ") || "-"}`);
  for (const f of r.red_flags.slice(0, 25)) console.log(`  ! ${f}`);
}
console.log(`\nwrote ${path.join(a.out, "scan.json")}`);
