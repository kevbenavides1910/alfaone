#!/usr/bin/env node
/**
 * Arranque local: .env, Postgres (Docker), migraciones y seed.
 * Uso: npm run setup:local
 * Flags: --skip-docker  --skip-seed  --no-migrate (solo generate + push)
 */
import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const skipDocker = args.has("--skip-docker");
const skipSeed = args.has("--skip-seed");
const usePush = args.has("--no-migrate");

const ENV_TEMPLATE = `# Generado por npm run setup:local — desarrollo local
# Postgres en Docker (docker-compose.yml mapea 5433:5432)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/security_contracts?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production-min32chars!!"
SYNTRA_DEVICE_SECRET="syntra-device-dev-secret-not-for-production!!"

# Logo / firma (disciplinario). Carpeta creada en uploads/branding
# BRANDING_UPLOAD_DIR="./uploads/branding"

# SMTP opcional (importación marcas disciplinario)
# SMTP_HOST="smtp.ejemplo.com"
# SMTP_PORT="587"
# SMTP_SECURE="false"
# SMTP_USER=""
# SMTP_PASS=""
# SMTP_FROM="Disciplinario <no-reply@ejemplo.com>"
`;

function log(msg) {
  console.log(`\n▶ ${msg}`);
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...opts.env },
  });
}

function ensureEnvFiles() {
  const envLocal = join(root, ".env.local");
  const env = join(root, ".env");
  if (!existsSync(envLocal)) {
    writeFileSync(envLocal, ENV_TEMPLATE, "utf8");
    log("Creado .env.local");
  } else {
    log(".env.local ya existe (no se sobrescribe)");
  }
  if (!existsSync(env)) {
    if (existsSync(envLocal)) copyFileSync(envLocal, env);
    else writeFileSync(env, ENV_TEMPLATE, "utf8");
    log("Creado .env (Prisma CLI lee este archivo)");
  }
  loadEnvIntoProcess(join(root, ".env"));
}

function loadEnvIntoProcess(envPath) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function ensureUploadDirs() {
  const dir = join(root, "uploads", "branding");
  mkdirSync(dir, { recursive: true });
  log(`Carpeta ${dir.replace(/\\/g, "/")} lista`);
}

async function startPostgres() {
  log("Levantando Postgres (docker compose)…");
  run("docker compose up postgres -d");
  log("Esperando Postgres en localhost:5433…");
  for (let i = 0; i < 30; i++) {
    const probe = spawnSync(
      "docker",
      ["exec", "security_contracts_db", "pg_isready", "-U", "postgres"],
      { cwd: root, shell: true, encoding: "utf8" },
    );
    if (probe.status === 0) {
      log("Postgres listo");
      return;
    }
    await sleep(2000);
  }
  console.warn(
    "  Aviso: no se confirmó pg_isready; si falla migrate, revise: docker compose ps",
  );
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== Alfa One — setup local ===\n");
  ensureUploadDirs();
  ensureEnvFiles();

  if (!skipDocker) {
    try {
      await startPostgres();
    } catch (e) {
      console.error(
        "\nNo se pudo iniciar Docker. Use --skip-docker si Postgres ya corre en 5433.\n",
      );
      throw e;
    }
  } else {
    log("Omitido Docker (--skip-docker)");
  }

  log("Dependencias (postinstall incluye prisma generate)…");
  if (!existsSync(join(root, "node_modules"))) {
    run("npm install");
  } else {
    run("npm run db:generate");
  }

  if (usePush) {
    log("Aplicando esquema (db:push)…");
    run("npm run db:push");
  } else {
    log("Aplicando migraciones (migrate deploy)…");
    run("npx prisma migrate deploy");
  }

  if (!skipSeed) {
    log("Cargando datos de prueba (seed)…");
    run("npm run db:seed");
  }

  console.log(`
=== Listo ===

  npm run dev          → http://localhost:3000
  npm run db:studio    → explorar BD
  npm run ci:modules   → módulos tocados en git

  Login dev: admin@seguridadgrupocr.com / admin123

  Guía: docs/LOCAL-DEV.md
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
