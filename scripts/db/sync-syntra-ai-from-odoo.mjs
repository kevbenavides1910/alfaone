#!/usr/bin/env node
/**
 * Copia configuración Syntra IA desde Odoo (ir_config_parameter) a Alfa One (syntra_ai_settings).
 * Uso: node scripts/db/sync-syntra-ai-from-odoo.mjs
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const ODOO_CONTAINER = process.env.ODOO_DB_CONTAINER || "odoo18_db";
const ODOO_DB = process.env.ODOO_DB_NAME || "syntradata";
const ODOO_USER = process.env.ODOO_DB_USER || "odoo";

function odooParam(key) {
  const sql = `SELECT value FROM ir_config_parameter WHERE key='${key.replace(/'/g, "''")}' LIMIT 1;`;
  const out = execSync(
    `docker exec ${ODOO_CONTAINER} psql -U ${ODOO_USER} -d ${ODOO_DB} -t -A -c ${JSON.stringify(sql)}`,
    { encoding: "utf-8" },
  ).trim();
  return out || "";
}

const prisma = new PrismaClient();

try {
  const enabled = odooParam("syntra_ai.enabled") === "True";
  const provider = odooParam("syntra_ai.provider") || "opencode_go";
  const baseUrl = odooParam("syntra_ai.base_url") || null;
  const apiKey = odooParam("syntra_ai.api_key");
  const model = odooParam("syntra_ai.model") || "kimi-k2.7-code";

  if (!apiKey) {
    console.error("Odoo no tiene syntra_ai.api_key configurada.");
    process.exit(1);
  }

  await prisma.syntraAiSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabled, provider, baseUrl, apiKey, model },
    update: { enabled, provider, baseUrl, apiKey, model },
  });

  console.log(
    `OK: syntra_ai_settings sincronizado (enabled=${enabled}, provider=${provider}, model=${model}, key=${apiKey.length} chars)`,
  );
} finally {
  await prisma.$disconnect();
}
