// Load the skill's npm packages; on first run install them (no browser download).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let installed = false;

function install() {
  if (installed) return false;
  installed = true;
  const cmd = existsSync(path.join(SKILL_DIR, "package-lock.json")) ? "ci" : "install";
  console.error(`installing skill dependencies (npm ${cmd})…`);
  execSync(`npm ${cmd} --omit=dev --omit=optional --no-audit --no-fund --loglevel=error`,
           { cwd: SKILL_DIR, stdio: "inherit" });
  return true;
}

/** import() a dependency, installing the skill's packages first if they are missing. */
export async function need(name) {
  try {
    return await import(name);
  } catch (err) {
    if (err.code !== "ERR_MODULE_NOT_FOUND" || !install()) throw err;
    return await import(name);
  }
}

/** Folder of a dependency that is used as files (not imported), e.g. pdfjs-dist served to the browser. */
export function pkgDir(name) {
  const dir = path.join(SKILL_DIR, "node_modules", name);
  if (!existsSync(dir)) install();
  return dir;
}
