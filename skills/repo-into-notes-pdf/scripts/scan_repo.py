#!/usr/bin/env python3
"""Clone (or open) one or more repos and write a structured map to <out>/scan.json.

usage: scan_repo.py <url-or-path> [<url-or-path> ...] [--out work/]

The map tells you WHAT to read (stack, layers, key files, env vars, red flags).
It does not replace reading the files.
"""
import argparse, json, os, re, subprocess, sys
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "out", "coverage", "vendor",
             "__pycache__", ".venv", "venv", "target", ".turbo", ".cache"}

# dependency -> (layer, label)
DEPS = {
    "express": ("backend", "Express"), "@nestjs/core": ("backend", "NestJS"), "fastify": ("backend", "Fastify"),
    "koa": ("backend", "Koa"), "hono": ("backend", "Hono"),
    "next": ("frontend", "Next.js"), "react": ("frontend", "React"), "vue": ("frontend", "Vue"),
    "@angular/core": ("frontend", "Angular"), "svelte": ("frontend", "Svelte"), "nuxt": ("frontend", "Nuxt"),
    "vite": ("frontend", "Vite"), "@tanstack/react-query": ("frontend", "TanStack Query"),
    "@reduxjs/toolkit": ("frontend", "Redux Toolkit"), "zustand": ("frontend", "Zustand"),
    "axios": ("tooling", "Axios"), "react-hook-form": ("frontend", "react-hook-form"),
    "tailwindcss": ("frontend", "Tailwind CSS"),
    "react-native": ("mobile", "React Native"), "expo": ("mobile", "Expo"),
    "mongoose": ("database", "Mongoose"), "prisma": ("database", "Prisma"), "@prisma/client": ("database", "Prisma"),
    "typeorm": ("database", "TypeORM"), "sequelize": ("database", "Sequelize"), "drizzle-orm": ("database", "Drizzle"),
    "pg": ("database", "PostgreSQL"), "mysql2": ("database", "MySQL"), "redis": ("database", "Redis"),
    "ioredis": ("database", "Redis"),
    "jsonwebtoken": ("security", "jsonwebtoken"), "passport": ("security", "Passport"), "bcrypt": ("security", "bcrypt"),
    "bcryptjs": ("security", "bcryptjs"), "argon2": ("security", "argon2"), "helmet": ("security", "helmet"),
    "express-rate-limit": ("security", "express-rate-limit"), "cors": ("security", "cors"),
    "next-auth": ("security", "NextAuth"), "zod": ("security", "Zod"), "joi": ("security", "Joi"),
    "express-validator": ("security", "express-validator"), "speakeasy": ("security", "speakeasy (2FA)"),
    "socket.io": ("realtime", "Socket.IO"), "ws": ("realtime", "ws"),
    "bullmq": ("jobs", "BullMQ"), "node-cron": ("jobs", "node-cron"),
    "nodemailer": ("integrations", "Nodemailer"), "resend": ("integrations", "Resend"), "stripe": ("integrations", "Stripe"),
    "@aws-sdk/client-s3": ("integrations", "AWS S3"), "cloudinary": ("integrations", "Cloudinary"),
    "multer": ("integrations", "Multer"), "swagger-ui-express": ("integrations", "Swagger UI"),
    "jest": ("testing", "Jest"), "vitest": ("testing", "Vitest"), "supertest": ("testing", "Supertest"),
    "@playwright/test": ("testing", "Playwright"), "cypress": ("testing", "Cypress"),
    "typescript": ("tooling", "TypeScript"), "winston": ("tooling", "winston"), "pino": ("tooling", "pino"),
}
PY_DEPS = {"django": ("backend", "Django"), "fastapi": ("backend", "FastAPI"), "flask": ("backend", "Flask"),
           "sqlalchemy": ("database", "SQLAlchemy"), "pytest": ("testing", "pytest"), "celery": ("jobs", "Celery")}

# path pattern -> layer
PATH_RULES = [
    (r"(^|/)(routes?|controllers?|services?|middlewares?|handlers?)/", "backend"),
    (r"(^|/)(models?|schemas?|entities|migrations|prisma)/|schema\.prisma$", "database"),
    (r"(^|/)(app|pages|components|hooks|features|store|context)/.*\.(tsx|jsx|vue|svelte)$", "frontend"),
    (r"(^|/)(auth|jwt|passport|session)[^/]*\.(ts|js|py)$", "security"),
    (r"(^|/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|\.dockerignore)$", "devops"),
    (r"(^|/)\.github/workflows/|(^|/)(k8s|kubernetes|helm|terraform)/|nginx[^/]*\.conf$", "devops"),
    (r"(^|/)(tests?|__tests__|e2e|spec)/|\.(test|spec)\.(ts|tsx|js|py)$", "testing"),
    (r"(^|/)(socket|realtime|ws)[^/]*\.(ts|js)$", "realtime"),
    (r"(^|/)(mail|email|templates)/", "integrations"),
    (r"(^|/)(config|env)[^/]*\.(ts|js|py)$|(^|/)config/", "config"),
]
ENTRY = re.compile(r"(^|/)(app|server|index|main)\.(ts|js|mjs|cjs|py)$|(^|/)(next|vite|nest-cli)\.config\.|"
                   r"(^|/)(layout|middleware|proxy)\.(ts|tsx)$")
ENV_RE = re.compile(r"process\.env\.([A-Za-z_][A-Za-z0-9_]*)|process\.env\[['\"]([A-Za-z_][A-Za-z0-9_]*)|"
                    r"os\.environ(?:\.get)?\(?\[?['\"]([A-Za-z_][A-Za-z0-9_]*)")
SECRET_RE = re.compile(r"(mongodb(\+srv)?://[^\s'\"]*:[^\s'\"@]+@|sk_live_[0-9a-zA-Z]{10,}|re_[0-9A-Za-z]{16,}|"
                       r"AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[0-9A-Za-z]{30,})")
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".vue", ".svelte"}


def fetch(src: str, out: Path) -> Path:
    if os.path.isdir(src):
        return Path(src).resolve()
    m = re.search(r"github\.com[/:]([^/]+)/([^/#?]+?)(?:\.git)?(?:/tree/([^?#]+))?/?$", src)
    name = f"{m.group(1)}__{m.group(2)}" if m else re.sub(r"\W+", "_", src)[-60:]
    url = f"https://github.com/{m.group(1)}/{m.group(2)}.git" if m else src
    dest = out / "repos" / name
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["git", "clone", "--depth", "1", url, str(dest)]
        if m and m.group(3):
            cmd[4:4] = ["--branch", m.group(3).split("/")[0]]
        subprocess.run(cmd, check=True)
    return dest


def walk(root: Path):
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for f in fns:
            yield Path(dp, f)


def tree(root: Path, depth=3, max_entries=200) -> str:
    lines = []
    def rec(d: Path, prefix: str, lvl: int):
        if lvl > depth or len(lines) > max_entries:
            return
        try:
            items = sorted(d.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        except OSError:
            return
        items = [i for i in items if i.name not in SKIP_DIRS and i.name != ".DS_Store"]
        for i in items:
            lines.append(f"{prefix}{i.name}{'/' if i.is_dir() else ''}")
            if i.is_dir():
                rec(i, prefix + "  ", lvl + 1)
    rec(root, "", 1)
    return "\n".join(lines[:max_entries]) + ("\n…" if len(lines) > max_entries else "")


def scan(root: Path) -> dict:
    rel = lambda p: p.relative_to(root).as_posix()
    res = {"root": str(root), "packages": [], "stack": {}, "layers": {}, "entry_points": [],
           "env_vars_read": [], "env_files": [], "red_flags": [], "stats": {}}
    env_vars, files = set(), list(walk(root))
    lockfiles = [rel(f) for f in files if f.name in ("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb")]

    for f in files:
        r = rel(f)
        if f.name == "package.json":
            try:
                pkg = json.loads(f.read_text(errors="ignore"))
            except Exception:
                continue
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            res["packages"].append({"path": r, "name": pkg.get("name"), "scripts": pkg.get("scripts", {}),
                                    "type": pkg.get("type", "commonjs"), "deps": deps})
            for d, v in deps.items():
                if d in DEPS:
                    layer, label = DEPS[d]
                    res["stack"].setdefault(layer, {})[label] = v
            for fake in ("crypto", "fs", "path", "http", "events"):
                if fake in deps:
                    res["red_flags"].append(f"{r}: '{fake}' listed as an npm dependency (Node built-in)")
            if pkg.get("scripts", {}).get("test", "").startswith("echo"):
                res["red_flags"].append(f"{r}: no test script")
        if f.name in ("requirements.txt", "pyproject.toml"):
            txt = f.read_text(errors="ignore").lower()
            for d, (layer, label) in PY_DEPS.items():
                if re.search(rf"\b{d}\b", txt):
                    res["stack"].setdefault(layer, {})[label] = "?"
        if re.match(r"\.env($|\.)", f.name):
            res["env_files"].append(r)
            if not f.name.endswith(("example", "sample", "template")):
                res["red_flags"].append(f"{r}: env file committed to git — treat its values as leaked")
        for pat, layer in PATH_RULES:
            if re.search(pat, r, re.I):
                res["layers"].setdefault(layer, []).append(r)
                break
        if ENTRY.search(r) and r.count("/") <= 3:
            res["entry_points"].append(r)
        if f.suffix in CODE_EXT or f.name.startswith(("docker-compose", "compose")):
            try:
                txt = f.read_text(errors="ignore")
            except OSError:
                continue
            if len(txt) > 400_000:
                continue
            for m in ENV_RE.finditer(txt):
                env_vars.add(next(g for g in m.groups() if g))
            if SECRET_RE.search(txt):
                res["red_flags"].append(f"{r}: looks like a hard-coded secret / credential")
            if re.search(r"\$set:\s*\{?\s*(\.\.\.)?req\.body|\.create\(\s*req\.body\s*\)|Update\w*\([^)]*,\s*req\.body\s*[,)]|\{\s*\.\.\.req\.body", txt, re.I):
                res["red_flags"].append(f"{r}: mass assignment (req.body written straight to the DB)")
            if re.search(r"req\.body\.(userId|user_id|sender|hrId)", txt):
                res["red_flags"].append(f"{r}: identity taken from the request body")
            if re.search(r"err(or)?\.stack", txt) and re.search(r"res\.(status|json|send)", txt):
                res["red_flags"].append(f"{r}: may send stack traces to the client")
            if re.search(r"localStorage\.(set|get)Item\(['\"][^'\"]*token", txt, re.I):
                res["red_flags"].append(f"{r}: token stored in localStorage")

    if (root / "node_modules").is_dir() and _tracked(root, "node_modules"):
        res["red_flags"].append("node_modules/ is committed")
    if len(lockfiles) > 1:
        res["red_flags"].append(f"several lockfiles: {', '.join(lockfiles)}")

    res["env_vars_read"] = sorted(env_vars)
    res["layers"] = {k: sorted(v)[:80] for k, v in sorted(res["layers"].items())}
    res["stats"] = {"files": len(files), "code_files": sum(f.suffix in CODE_EXT for f in files),
                    "lockfiles": lockfiles}
    res["tree"] = tree(root)
    for doc in ("README.md", "readme.md", "README"):
        if (root / doc).exists():
            res["readme_excerpt"] = (root / doc).read_text(errors="ignore")[:3000]
            break
    return res


def _tracked(root: Path, path: str) -> bool:
    try:
        out = subprocess.run(["git", "-C", str(root), "ls-files", path], capture_output=True, text=True)
        return bool(out.stdout.strip())
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources", nargs="+", help="GitHub URL(s) or local path(s)")
    ap.add_argument("--out", default="work", help="output folder (default: work/)")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    results = [{"source": s, **scan(fetch(s, out))} for s in a.sources]
    (out / "scan.json").write_text(json.dumps(results, indent=2))
    for r in results:
        print(f"\n== {r['source']}  ({r['stats']['files']} files)")
        for layer, libs in r["stack"].items():
            print(f"  {layer:13} {', '.join(f'{k} {v}' for k, v in libs.items())}")
        print(f"  layers found: {', '.join(f'{k}({len(v)})' for k, v in r['layers'].items())}")
        print(f"  env vars read: {', '.join(r['env_vars_read']) or '-'}")
        for flag in r["red_flags"][:25]:
            print(f"  ! {flag}")
    print(f"\nwrote {out / 'scan.json'}")


if __name__ == "__main__":
    sys.exit(main())
