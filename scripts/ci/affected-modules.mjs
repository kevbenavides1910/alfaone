#!/usr/bin/env node
/**
 * Lista módulos afectados por archivos cambiados (git diff).
 * Uso local: npm run ci:modules
 * En CI: node scripts/ci/affected-modules.mjs --github-output
 */
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(
  readFileSync(join(root, "scripts/ci/module-paths.json"), "utf8"),
);

// Convierte glob simple (con ** y *) a RegExp
function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${escaped}$`);
}

const patterns = [];
for (const p of config.shared) {
  patterns.push({ module: "shared", re: globToRegex(p) });
}
for (const [module, globs] of Object.entries(config.modules)) {
  for (const g of globs) {
    patterns.push({ module, re: globToRegex(g) });
  }
}

function matchFile(file) {
  const normalized = file.replace(/\\/g, "/");
  const hits = new Set();
  for (const { module, re } of patterns) {
    if (re.test(normalized)) hits.add(module);
  }
  return hits;
}

function gitChangedFiles() {
  const base = process.env.GITHUB_BASE_REF;
  const head = process.env.GITHUB_SHA ?? "HEAD";
  let range = "HEAD~1";
  if (process.env.GITHUB_EVENT_NAME === "pull_request" && base) {
    try {
      execSync(`git fetch origin ${base} --depth=1`, { cwd: root, stdio: "pipe" });
      range = `origin/${base}...${head}`;
    } catch {
      range = `${base}...${head}`;
    }
  } else if (base) {
    range = `${base}...${head}`;
  }

  try {
    const out = execSync(`git diff --name-only ${range}`, {
      cwd: root,
      encoding: "utf8",
    });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    const out = execSync("git diff --name-only HEAD~1", {
      cwd: root,
      encoding: "utf8",
    });
    return out.trim().split("\n").filter(Boolean);
  }
}

const files = process.argv.includes("--files")
  ? process.argv.slice(process.argv.indexOf("--files") + 1)
  : gitChangedFiles();

const affected = new Set();
for (const f of files) {
  for (const m of matchFile(f)) affected.add(m);
}

const modules = [...affected].filter((m) => m !== "shared").sort();
const shared = affected.has("shared");
const runCi = files.length === 0 || shared || modules.length > 0;

const labels = {
  core: "Núcleo",
  presupuestos: "Presupuestos",
  reportes: "Reportes",
  inventario: "Inventario",
  disciplinario: "Disciplinario",
  plataforma: "Plataforma",
};

console.log("Archivos analizados:", files.length);
if (files.length > 0 && files.length <= 30) {
  for (const f of files) console.log("  -", f);
} else if (files.length > 30) {
  console.log(`  (${files.length} archivos, lista omitida)`);
}
console.log("");
console.log("Infra compartida tocada:", shared ? "sí" : "no");
console.log(
  "Módulos afectados:",
  modules.length ? modules.map((m) => labels[m] ?? m).join(", ") : "(ninguno / solo docs)",
);
console.log("Ejecutar CI completo (lint + build):", runCi ? "sí" : "opcional (solo docs)");

if (process.argv.includes("--github-output") && process.env.GITHUB_OUTPUT) {
  const out = process.env.GITHUB_OUTPUT;
  appendFileSync(out, `shared=${shared}\n`);
  appendFileSync(out, `run-ci=${runCi}\n`);
  appendFileSync(out, `modules=${modules.join(",")}\n`);
  for (const id of Object.keys(config.modules)) {
    appendFileSync(out, `${id}=${modules.includes(id)}\n`);
  }
}
