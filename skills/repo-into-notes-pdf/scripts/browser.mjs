// Find a Chrome / Edge / Chromium already on the machine and launch it headless with puppeteer-core.
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { need } from "./deps.mjs";

const HOME = os.homedir();

// <dir>/<prefix>*/<sub> for each matching folder, newest name first
function globDir(dir, prefix, sub) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => d.startsWith(prefix)).sort().reverse().map((d) => path.join(dir, d, sub));
}

function which(cmd) {
  try {
    const out = execSync(`${process.platform === "win32" ? "where" : "command -v"} ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] });
    return out.toString().split(/\r?\n/)[0].trim();
  } catch {
    return null;
  }
}

export function candidates() {
  const list = [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH];
  if (process.platform === "win32") {
    for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      list.push(path.join(base, "Google/Chrome/Application/chrome.exe"),
                path.join(base, "Microsoft/Edge/Application/msedge.exe"),
                path.join(base, "Chromium/Application/chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    for (const app of ["Google Chrome", "Microsoft Edge", "Chromium", "Brave Browser"])
      list.push(`/Applications/${app}.app/Contents/MacOS/${app}`, `${HOME}/Applications/${app}.app/Contents/MacOS/${app}`);
  } else {
    for (const cmd of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome"])
      list.push(which(cmd));
  }
  // browsers left by Playwright / Puppeteer installs (e.g. Claude.ai's sandbox)
  list.push(...globDir("/opt/pw-browsers", "chromium", "chrome-linux/chrome"),
            ...globDir("/opt/pw-browsers", "chromium", "chrome-linux64/chrome"),
            ...globDir(`${HOME}/.cache/ms-playwright`, "chromium", "chrome-linux/chrome"),
            ...globDir(`${HOME}/.cache/ms-playwright`, "chromium", "chrome-win/chrome.exe"));
  for (const kind of ["chrome", "chrome-headless-shell"])
    for (const v of globDir(`${HOME}/.cache/puppeteer/${kind}`, "", ""))
      if (existsSync(v)) for (const d of readdirSync(v))
        list.push(path.join(v, d, kind === "chrome" ? (process.platform === "win32" ? "chrome.exe" : "chrome") :
          (process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell")));
  return [...new Set(list.filter(Boolean))].filter((p) => existsSync(p));
}

export async function launch() {
  const { default: puppeteer } = await need("puppeteer-core");
  const errors = [];
  for (const exe of candidates()) {
    try {
      return await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    } catch (e) {
      errors.push(`${exe}: ${e.message.split("\n")[0]}`);
    }
  }
  console.error("No usable Chrome / Edge / Chromium found." + (errors.length ? "\n  " + errors.join("\n  ") : ""));
  console.error("Install Chrome or Edge, set CHROME_PATH=/path/to/chrome, or run:\n" +
                "  npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/puppeteer\n" +
                "See references/pdf-build.md.");
  process.exit(1);
}
