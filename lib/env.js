"use strict";

const fs = require("fs");
const path = require("path");

function parseEnvLine(line) {
  const trimmed = String(line || "").trim();
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

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (typeof process.env[parsed.key] === "undefined") {
      process.env[parsed.key] = parsed.value;
    }
  }
  return true;
}

function loadProjectEnv(projectRoot) {
  const root = projectRoot || path.resolve(__dirname, "..");
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile("/var/www/rasyid-puteraa/shared/.env");
}

module.exports = {
  loadEnvFile,
  loadProjectEnv,
  parseEnvLine
};
