#!/usr/bin/env node
"use strict";

const path = require("path");
const { Pool } = require("pg");
const { loadProjectEnv } = require("../lib/env");
const { ensureSchema } = require("../lib/db-schema");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  loadProjectEnv(projectRoot);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak ditemukan. Pastikan .env project tersedia.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureSchema(pool);
    console.log("[init-db] Schema PostgreSQL berhasil dipastikan (idempotent).");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[init-db] Gagal:", error.message);
  process.exit(1);
});
