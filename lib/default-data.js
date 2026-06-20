"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE_FILE_MAP = Object.freeze({
  profile: "profile.json",
  homepage: "homepage.json",
  projects: "projects.json",
  knowledge: "knowledge.json",
  articles: "knowledge.json",
  ventures: "ventures.json",
  timeline: "timeline.json",
  experiences: "timeline.json",
  notes: "notes.json",
  reviews: "reviews.json",
  contact: "contact.json",
  "kom-config": "kom-config.json",
  kom_config: "kom-config.json"
});

function resolveDataPath(projectRoot, source) {
  const fileName = SOURCE_FILE_MAP[source];
  if (!fileName) return null;
  return path.join(projectRoot, "app", "data", fileName);
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function loadDefaultSource(projectRoot, source) {
  const filePath = resolveDataPath(projectRoot, source);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return readJsonFile(filePath);
}

function loadAllDefaults(projectRoot) {
  const result = {};
  for (const source of Object.keys(SOURCE_FILE_MAP)) {
    if (Object.prototype.hasOwnProperty.call(result, source)) continue;
    const value = loadDefaultSource(projectRoot, source);
    if (value != null) {
      result[source] = value;
    }
  }
  return result;
}

module.exports = {
  SOURCE_FILE_MAP,
  loadAllDefaults,
  loadDefaultSource,
  readJsonFile,
  resolveDataPath
};
