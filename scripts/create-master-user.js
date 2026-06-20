#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { Client } = require("pg");

const MASTER_USERNAME = process.env.MASTER_USERNAME || "KingOfMaster";
const MASTER_PASSWORD = process.env.MASTER_PASSWORD;
const MASTER_ROLE = process.env.MASTER_ROLE || "master";
const BCRYPT_ROUNDS = 12;

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const index = trimmed.indexOf("=");
  if (index <= 0) return null;

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const body = fs.readFileSync(filePath, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (typeof process.env[parsed.key] === "undefined") {
      process.env[parsed.key] = parsed.value;
    }
  }
  return true;
}

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;

  const candidates = [
    path.resolve(__dirname, "..", ".env"),
    "/var/www/rasyid-puteraa/shared/.env"
  ];

  for (const candidate of candidates) {
    loadEnvFromFile(candidate);
    if (process.env.DATABASE_URL) return;
  }

  throw new Error("DATABASE_URL tidak ditemukan di environment maupun file .env");
}

async function main() {
  ensureDatabaseUrl();
  if (!MASTER_PASSWORD) {
    throw new Error("MASTER_PASSWORD wajib diisi melalui environment variable");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        role TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const passwordHash = await bcrypt.hash(MASTER_PASSWORD, BCRYPT_ROUNDS);

    const insertResult = await client.query(
      `
        INSERT INTO users (username, password_hash, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username, role, created_at
      `,
      [MASTER_USERNAME, passwordHash, MASTER_ROLE]
    );

    if (insertResult.rowCount === 0) {
      console.log(`User ${MASTER_USERNAME} sudah ada, insert dilewati.`);
    } else {
      console.log(`User ${MASTER_USERNAME} berhasil dibuat.`);
    }

    const verifyResult = await client.query(
      `
        SELECT
          id,
          username,
          role,
          created_at,
          password_hash LIKE '$2%' AS is_bcrypt_hash,
          LENGTH(password_hash) AS hash_length
        FROM users
        WHERE username = $1
      `,
      [MASTER_USERNAME]
    );

    if (verifyResult.rowCount === 0) {
      throw new Error("Verifikasi gagal: user tidak ditemukan setelah proses seed.");
    }

    const row = verifyResult.rows[0];
    console.log(
      JSON.stringify(
        {
          id: row.id,
          username: row.username,
          role: row.role,
          created_at: row.created_at,
          is_bcrypt_hash: row.is_bcrypt_hash,
          hash_length: row.hash_length
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Gagal membuat master user:", error.message);
  process.exit(1);
});
