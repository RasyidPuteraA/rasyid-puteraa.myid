"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const { loadProjectEnv } = require("./lib/env");
const { ensureSchema } = require("./lib/db-schema");
const { loadDefaultSource } = require("./lib/default-data");
const { getSheetData } = require("./lib/sheets");
const {
  articleRowToPublic,
  asArray,
  asObject,
  cleanString,
  experienceRowToPublic,
  normalizeArticleInput,
  normalizeExperienceInput,
  normalizeProfileInput,
  normalizeProjectInput,
  normalizeSkillInput,
  normalizeSocialLinkInput,
  normalizeVentureInput,
  projectRowToPublic,
  skillRowToPublic,
  slugify,
  socialLinkRowToPublic,
  ventureRowToPublic
} = require("./lib/model-utils");

const projectRoot = __dirname;
loadProjectEnv(projectRoot);

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4100);
const appRoot = path.join(projectRoot, "app");
const sessionTtlMs = Number(process.env.ADMIN_SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const sessionMaxAgeSeconds = Math.floor(sessionTtlMs / 1000);
const sessionCookieName = "rasyid_admin_sid";
const forceSecureCookie =
  String(process.env.ADMIN_COOKIE_SECURE || "").toLowerCase() === "true" ||
  String(process.env.NODE_ENV || "").toLowerCase() === "production";

const sessions = new Map();
const dbPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
let schemaReadyPromise = null;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const defaultSettingsKeys = ["homepage", "contact", "kom-config", "notes", "reviews"];
const spotifyOauthStateStore = new Map();
const spotifyOauthStateTtlMs = Number(process.env.SPOTIFY_STATE_TTL_MS || 10 * 60 * 1000);
const siteContentCacheTtlMs = Math.max(0, Number(process.env.SITE_CONTENT_CACHE_TTL_MS ?? 0) || 0);
let siteContentCache = {
  value: null,
  expiresAt: 0
};
const spotifyRequiredScopes = [
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-read-private",
  "user-read-email"
];

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveStaticPath(pathname) {
  let requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (requested.endsWith("/")) requested += "index.html";

  const normalized = path.normalize(requested);
  if (
    normalized.startsWith("..") ||
    path.isAbsolute(normalized) ||
    normalized.includes(`..${path.sep}`)
  ) {
    return null;
  }
  return path.join(appRoot, normalized);
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  res.end(message);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function sendFile(res, filePath) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      sendText(res, 404, "Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "x-content-type-options": "nosniff"
    });

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      sendText(res, 500, "Internal Server Error");
    });
    stream.pipe(res);
  });
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};

  const result = {};
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    result[key] = decodeURIComponent(value);
  }
  return result;
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.httpOnly) segments.push("HttpOnly");
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  if (options.maxAge != null) segments.push(`Max-Age=${String(options.maxAge)}`);
  if (options.secure) segments.push("Secure");
  return segments.join("; ");
}

function isSecureRequest(req) {
  const header = req.headers["x-forwarded-proto"];
  if (typeof header !== "string") return false;
  return header.split(",")[0].trim().toLowerCase() === "https";
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
}

function cleanupSessions() {
  const now = Date.now();
  for (const [sid, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) {
      sessions.delete(sid);
    }
  }
}

function createSession(user) {
  const sid = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + sessionTtlMs;
  sessions.set(sid, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt
  });
  return { sid, expiresAt };
}

function getSession(req) {
  cleanupSessions();
  const cookies = parseCookies(req);
  const sid = cookies[sessionCookieName];
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return { sid, ...session };
}

function clearSession(sid) {
  if (sid) sessions.delete(sid);
}

function parseUrlEncoded(rawBody) {
  const params = new URLSearchParams(rawBody);
  const payload = {};
  for (const [key, value] of params.entries()) {
    payload[key] = value;
  }
  return payload;
}

function readRequestBody(req, limitBytes = 1024 * 1024 * 5) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("Payload terlalu besar"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (error) => reject(error));
  });
}

function parseBodyByContentType(rawBody, req) {
  const normalizedRaw = String(rawBody || "").replace(/^\uFEFF/, "");
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!normalizedRaw) return {};
  if (contentType.includes("application/json")) {
    return JSON.parse(normalizedRaw);
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return parseUrlEncoded(normalizedRaw);
  }

  try {
    return JSON.parse(normalizedRaw);
  } catch {
    return parseUrlEncoded(normalizedRaw);
  }
}

async function readJsonBody(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    return parseBodyByContentType(rawBody, req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "Payload tidak valid" });
    return null;
  }
}

async function ensureDatabaseReady() {
  if (!dbPool) {
    throw new Error("DATABASE_URL tidak tersedia");
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema(dbPool).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
}

function loadFallback(source) {
  return loadDefaultSource(projectRoot, source);
}

async function queryRows(queryText, params = []) {
  await ensureDatabaseReady();
  const result = await dbPool.query(queryText, params);
  return result.rows;
}

async function queryOne(queryText, params = []) {
  const rows = await queryRows(queryText, params);
  return rows.length ? rows[0] : null;
}

async function logActivity(req, options = {}) {
  if (!dbPool) return;
  try {
    await ensureDatabaseReady();
    await dbPool.query(
      `
        INSERT INTO activity_logs (
          user_id, username, action, entity_type, entity_id,
          status, message, ip_address, user_agent, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      `,
      [
        options.userId || null,
        options.username || null,
        options.action || "unknown_action",
        options.entityType || null,
        options.entityId || null,
        options.status || "success",
        options.message || null,
        getClientIp(req),
        String(req.headers["user-agent"] || ""),
        JSON.stringify(asObject(options.metadata))
      ]
    );
  } catch (error) {
    console.error("Activity log insert failed:", error.message);
  }
}

function parsePathParam(raw) {
  return safeDecode(String(raw || "")).trim();
}

function lower(value) {
  return cleanString(value).toLowerCase();
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstForwardedHeaderValue(value) {
  if (typeof value !== "string") return "";
  return value.split(",")[0].trim();
}

function requestProto(req) {
  const forwarded = firstForwardedHeaderValue(req.headers["x-forwarded-proto"]);
  if (forwarded) return forwarded.toLowerCase();
  return forceSecureCookie ? "https" : "http";
}

function requestHost(req) {
  const forwardedHost = firstForwardedHeaderValue(req.headers["x-forwarded-host"]);
  if (forwardedHost) return forwardedHost;
  return cleanString(req.headers.host || "127.0.0.1:4100");
}

function requestOrigin(req) {
  return `${requestProto(req)}://${requestHost(req)}`;
}

function resolveAdminReturnPath(nextParam) {
  const fallback = "/admin.html#module-spotify";
  const raw = cleanString(nextParam);
  if (!raw) return fallback;
  if (raw.startsWith("//")) return fallback;

  try {
    const parsed = new URL(raw, "http://local-callback");
    if (parsed.origin !== "http://local-callback") {
      return fallback;
    }
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!normalized.startsWith("/")) return fallback;
    return normalized;
  } catch {
    return fallback;
  }
}

function appendQueryParamToPath(pathValue, key, value) {
  const base = resolveAdminReturnPath(pathValue);
  try {
    const url = new URL(base, "http://local-callback");
    url.searchParams.set(String(key || "k"), String(value || ""));
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return base;
  }
}

function normalizeSpotifyRedirectUri(value) {
  const raw = cleanString(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function buildSpotifyConfig(req) {
  const requiredRedirects = [
    "https://rasyid-puteraa.my.id/api/spotify/callback",
    "https://www.rasyid-puteraa.my.id/api/spotify/callback",
    "http://127.0.0.1:4100/api/spotify/callback"
  ];
  const configuredRedirect = normalizeSpotifyRedirectUri(process.env.SPOTIFY_REDIRECT_URI || "")
    || requiredRedirects[0];
  const staticCandidates = [
    configuredRedirect,
    ...requiredRedirects
  ];
  const envCandidates = parseCsv(process.env.SPOTIFY_ALLOWED_REDIRECT_URIS || "")
    .map(normalizeSpotifyRedirectUri)
    .filter(Boolean);
  const inferredRedirect = normalizeSpotifyRedirectUri(`${requestOrigin(req)}/api/spotify/callback`);
  const allRedirects = Array.from(
    new Set(
      [...staticCandidates, ...envCandidates]
        .map(normalizeSpotifyRedirectUri)
        .filter(Boolean)
    )
  );

  let redirectUri = configuredRedirect;
  if (!allRedirects.includes(redirectUri)) {
    redirectUri = allRedirects[0] || requiredRedirects[0];
  }
  if (inferredRedirect && allRedirects.includes(inferredRedirect)) {
    redirectUri = inferredRedirect;
  }

  return {
    clientId: cleanString(process.env.SPOTIFY_CLIENT_ID || ""),
    clientSecret: cleanString(process.env.SPOTIFY_CLIENT_SECRET || ""),
    redirectUri: cleanString(redirectUri),
    redirectAllowList: allRedirects,
    allowedUserId: cleanString(process.env.SPOTIFY_ALLOWED_USER_ID || ""),
    allowedEmail: lower(process.env.SPOTIFY_ALLOWED_EMAIL || ""),
    scopes: spotifyRequiredScopes.slice(),
    authBaseUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    apiBaseUrl: "https://api.spotify.com/v1"
  };
}

function spotifyConfigured(config) {
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function spotifyError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  if (status) error.status = status;
  return error;
}

function cleanupSpotifyOauthStates() {
  const now = Date.now();
  for (const [state, entry] of spotifyOauthStateStore.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      spotifyOauthStateStore.delete(state);
    }
  }
}

function createSpotifyOauthState(session, options = {}) {
  cleanupSpotifyOauthStates();
  const state = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + spotifyOauthStateTtlMs;
  spotifyOauthStateStore.set(state, {
    state,
    sessionSid: session.sid,
    sessionUserId: session.userId || null,
    redirectUri: cleanString(options.redirectUri),
    nextPath: resolveAdminReturnPath(options.nextPath),
    expiresAt
  });
  return state;
}

function consumeSpotifyOauthState(state) {
  cleanupSpotifyOauthStates();
  const key = cleanString(state);
  if (!key) return null;
  const entry = spotifyOauthStateStore.get(key);
  if (!entry) return null;
  spotifyOauthStateStore.delete(key);
  if (Number(entry.expiresAt || 0) <= Date.now()) {
    return null;
  }
  return entry;
}

async function upsertSpotifySettingsFromEnv(config) {
  const userId = cleanString(config.allowedUserId);
  const email = lower(config.allowedEmail);
  if (!userId && !email) return;
  await ensureDatabaseReady();
  await dbPool.query(
    `
      INSERT INTO spotify_settings (
        id, allowed_spotify_user_id, allowed_email, created_at, updated_at
      ) VALUES (
        1, $1, $2, NOW(), NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        allowed_spotify_user_id = EXCLUDED.allowed_spotify_user_id,
        allowed_email = EXCLUDED.allowed_email,
        updated_at = NOW()
    `,
    [userId || null, email || null]
  );
}

async function spotifyAllowedPolicy(config) {
  await ensureDatabaseReady();
  const row = await queryOne(
    `
      SELECT allowed_spotify_user_id, allowed_email
      FROM spotify_settings
      ORDER BY id ASC
      LIMIT 1
    `
  );
  return {
    allowedUserId: cleanString(config.allowedUserId || (row && row.allowed_spotify_user_id) || ""),
    allowedEmail: lower(config.allowedEmail || (row && row.allowed_email) || "")
  };
}

async function spotifyTokenRequest(config, params) {
  const payload = new URLSearchParams(params);
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: payload.toString()
  });

  const responseText = await response.text();
  let body = {};
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorMessage = body.error_description || body.error || responseText || "Spotify token request failed";
    throw spotifyError("SPOTIFY_TOKEN_REQUEST_FAILED", errorMessage, response.status);
  }

  return body;
}

async function spotifyApiGet(accessToken, apiPath, queryParams = {}) {
  const url = new URL(`https://api.spotify.com/v1${apiPath}`);
  Object.keys(queryParams).forEach((key) => {
    if (queryParams[key] == null) return;
    url.searchParams.set(key, String(queryParams[key]));
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload.error && payload.error.message
      ? payload.error.message
      : (raw || "Spotify API request failed");
    throw spotifyError("SPOTIFY_API_REQUEST_FAILED", message, response.status);
  }

  return payload;
}

function validateSpotifyOwnerProfile(profile, policy) {
  const spotifyUserId = cleanString(profile && profile.id);
  const spotifyEmail = lower(profile && profile.email);
  if (!spotifyUserId) {
    throw spotifyError("SPOTIFY_PROFILE_INVALID", "Spotify profile id tidak ditemukan", 400);
  }

  if (policy.allowedUserId && spotifyUserId !== policy.allowedUserId) {
    throw spotifyError("SPOTIFY_OWNER_MISMATCH", "Akun Spotify ini tidak diizinkan", 403);
  }

  if (policy.allowedEmail && spotifyEmail !== policy.allowedEmail) {
    throw spotifyError("SPOTIFY_OWNER_EMAIL_MISMATCH", "Email Spotify tidak diizinkan", 403);
  }

  return {
    spotifyUserId,
    spotifyEmail,
    spotifyDisplayName: cleanString(profile && profile.display_name)
  };
}

function normalizeSpotifyTrack(track, options = {}) {
  if (!track || typeof track !== "object") return null;
  const album = track.album && typeof track.album === "object" ? track.album : {};
  const images = Array.isArray(album.images) ? album.images : [];
  const artists = Array.isArray(track.artists)
    ? track.artists.map((item) => cleanString(item && item.name)).filter(Boolean)
    : [];
  return {
    id: cleanString(track.id),
    title: cleanString(track.name),
    artists,
    album: cleanString(album.name),
    albumImage: cleanString(images[0] && images[0].url),
    spotifyUrl: cleanString(track.external_urls && track.external_urls.spotify),
    playedAt: cleanString(options.playedAt || ""),
    isPlaying: Boolean(options.isPlaying),
    source: cleanString(options.source || "")
  };
}

async function activeSpotifyTokenRow(db) {
  const result = await db.query(
    `
      SELECT *
      FROM spotify_tokens
      WHERE is_active = TRUE
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `
  );
  return result.rowCount ? result.rows[0] : null;
}

async function saveSpotifyToken(db, tokenPayload, ownerProfile) {
  const accessToken = cleanString(tokenPayload.access_token);
  const refreshToken = cleanString(tokenPayload.refresh_token);
  const tokenType = cleanString(tokenPayload.token_type || "Bearer");
  const scope = cleanString(tokenPayload.scope || spotifyRequiredScopes.join(" "));
  const expiresInSeconds = Number.parseInt(tokenPayload.expires_in, 10);
  const expiresAt = new Date(Date.now() + (Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600) * 1000);

  if (!accessToken || !refreshToken) {
    throw spotifyError("SPOTIFY_TOKEN_INVALID", "Spotify token response tidak lengkap", 500);
  }

  await db.query(
    `
      UPDATE spotify_tokens
      SET is_active = FALSE, updated_at = NOW()
      WHERE is_active = TRUE
        AND spotify_user_id <> $1
    `,
    [ownerProfile.spotifyUserId]
  );

  await db.query(
    `
      INSERT INTO spotify_tokens (
        spotify_user_id, spotify_email, spotify_display_name,
        access_token, refresh_token, token_type, scope,
        expires_at, is_active, created_at, updated_at
      ) VALUES (
        $1,$2,$3,
        $4,$5,$6,$7,
        $8,TRUE,NOW(),NOW()
      )
      ON CONFLICT (spotify_user_id)
      DO UPDATE SET
        spotify_email = EXCLUDED.spotify_email,
        spotify_display_name = EXCLUDED.spotify_display_name,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expires_at = EXCLUDED.expires_at,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [
      ownerProfile.spotifyUserId,
      ownerProfile.spotifyEmail || null,
      ownerProfile.spotifyDisplayName || null,
      accessToken,
      refreshToken,
      tokenType || "Bearer",
      scope,
      expiresAt.toISOString()
    ]
  );
}

async function refreshSpotifyToken(db, config, tokenRow) {
  const refreshToken = cleanString(tokenRow.refresh_token);
  if (!refreshToken) {
    throw spotifyError("SPOTIFY_REFRESH_TOKEN_MISSING", "Refresh token Spotify tidak tersedia", 401);
  }

  let payload;
  try {
    payload = await spotifyTokenRequest(config, {
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
  } catch (error) {
    await db.query(
      `
        UPDATE spotify_tokens
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [tokenRow.id]
    );
    throw error;
  }

  const nextAccessToken = cleanString(payload.access_token);
  const nextRefreshToken = cleanString(payload.refresh_token || tokenRow.refresh_token);
  const nextTokenType = cleanString(payload.token_type || tokenRow.token_type || "Bearer");
  const nextScope = cleanString(payload.scope || tokenRow.scope || spotifyRequiredScopes.join(" "));
  const expiresInSeconds = Number.parseInt(payload.expires_in, 10);
  const nextExpiresAt = new Date(Date.now() + (Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600) * 1000);

  if (!nextAccessToken || !nextRefreshToken) {
    await db.query(
      `
        UPDATE spotify_tokens
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [tokenRow.id]
    );
    throw spotifyError("SPOTIFY_REFRESH_INVALID", "Hasil refresh token Spotify tidak valid", 401);
  }

  const updated = await db.query(
    `
      UPDATE spotify_tokens
      SET access_token = $1,
          refresh_token = $2,
          token_type = $3,
          scope = $4,
          expires_at = $5,
          is_active = TRUE,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `,
    [
      nextAccessToken,
      nextRefreshToken,
      nextTokenType,
      nextScope,
      nextExpiresAt.toISOString(),
      tokenRow.id
    ]
  );

  return updated.rowCount ? updated.rows[0] : null;
}

async function ensureValidSpotifyToken(db, config, tokenRow, forceRefresh = false) {
  if (!tokenRow) return null;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const shouldRefresh = forceRefresh || !Number.isFinite(expiresAt) || expiresAt <= (Date.now() + 60 * 1000);
  if (!shouldRefresh) return tokenRow;
  return refreshSpotifyToken(db, config, tokenRow);
}

async function spotifyStatusPayload(req, options = {}) {
  const config = buildSpotifyConfig(req);
  const configured = spotifyConfigured(config);
  const session = getSession(req);
  const canManage = Boolean(session && String(session.role || "").toLowerCase() === "master");

  if (!configured) {
    return {
      ok: true,
      configured: false,
      connected: false,
      canManage,
      redirectUri: config.redirectUri,
      redirectAllowList: config.redirectAllowList,
      owner: null,
      currentlyPlaying: null,
      recentlyPlayed: null,
      fetchedAt: new Date().toISOString(),
      error: "Spotify credentials are not configured on backend"
    };
  }

  await ensureDatabaseReady();
  let tokenRow = await activeSpotifyTokenRow(dbPool);
  if (!tokenRow) {
    return {
      ok: true,
      configured: true,
      connected: false,
      canManage,
      redirectUri: config.redirectUri,
      redirectAllowList: config.redirectAllowList,
      owner: null,
      currentlyPlaying: null,
      recentlyPlayed: null,
      fetchedAt: new Date().toISOString()
    };
  }

  try {
    tokenRow = await ensureValidSpotifyToken(dbPool, config, tokenRow, Boolean(options.forceRefresh));
    if (!tokenRow) {
      throw spotifyError("SPOTIFY_TOKEN_NOT_AVAILABLE", "Spotify token not available", 404);
    }
  } catch (error) {
    return {
      ok: true,
      configured: true,
      connected: false,
      canManage,
      redirectUri: config.redirectUri,
      redirectAllowList: config.redirectAllowList,
      owner: null,
      currentlyPlaying: null,
      recentlyPlayed: null,
      fetchedAt: new Date().toISOString(),
      error: error.message || "Failed to refresh Spotify token"
    };
  }

  const fetchPlaybackSafely = async(accessToken) => {
    const [currentPlaybackResult, recentPlaybackResult] = await Promise.allSettled([
      spotifyApiGet(accessToken, "/me/player/currently-playing"),
      spotifyApiGet(accessToken, "/me/player/recently-played", { limit: 1 })
    ]);

    let currentPlayback = null;
    let recentPlayback = null;

    if (currentPlaybackResult.status === "fulfilled") {
      currentPlayback = currentPlaybackResult.value;
    } else if (Number(currentPlaybackResult.reason && currentPlaybackResult.reason.status) === 401) {
      throw currentPlaybackResult.reason;
    }

    if (recentPlaybackResult.status === "fulfilled") {
      recentPlayback = recentPlaybackResult.value;
    } else if (Number(recentPlaybackResult.reason && recentPlaybackResult.reason.status) === 401) {
      throw recentPlaybackResult.reason;
    }

    return { currentPlayback, recentPlayback };
  };

  const fetchAllWithToken = async(accessToken) => {
    const profile = await spotifyApiGet(accessToken, "/me");
    const playback = await fetchPlaybackSafely(accessToken);
    return {
      profile,
      currentPlayback: playback.currentPlayback,
      recentPlayback: playback.recentPlayback
    };
  };

  let aggregate;
  try {
    aggregate = await fetchAllWithToken(tokenRow.access_token);
  } catch (error) {
    if (Number(error.status) === 401) {
      tokenRow = await refreshSpotifyToken(dbPool, config, tokenRow);
      aggregate = await fetchAllWithToken(tokenRow.access_token);
    } else {
      throw error;
    }
  }

  const ownerProfile = aggregate.profile && typeof aggregate.profile === "object"
    ? aggregate.profile
    : {};
  const currentTrack = aggregate.currentPlayback && aggregate.currentPlayback.item
    ? normalizeSpotifyTrack(aggregate.currentPlayback.item, {
      playedAt: aggregate.currentPlayback.timestamp
        ? new Date(Number(aggregate.currentPlayback.timestamp)).toISOString()
        : "",
      isPlaying: Boolean(aggregate.currentPlayback.is_playing),
      source: "currently-playing"
    })
    : null;
  const recentItem = aggregate.recentPlayback
    && Array.isArray(aggregate.recentPlayback.items)
    && aggregate.recentPlayback.items.length
    ? aggregate.recentPlayback.items[0]
    : null;
  const recentTrack = recentItem && recentItem.track
    ? normalizeSpotifyTrack(recentItem.track, {
      playedAt: cleanString(recentItem.played_at),
      isPlaying: false,
      source: "recently-played"
    })
    : null;

  await dbPool.query(
    `
      UPDATE spotify_tokens
      SET spotify_email = $1,
          spotify_display_name = $2,
          updated_at = NOW()
      WHERE id = $3
    `,
    [
      cleanString(ownerProfile.email) || tokenRow.spotify_email || null,
      cleanString(ownerProfile.display_name) || tokenRow.spotify_display_name || null,
      tokenRow.id
    ]
  );

  return {
    ok: true,
    configured: true,
    connected: true,
    canManage,
    redirectUri: config.redirectUri,
    redirectAllowList: config.redirectAllowList,
    owner: {
      spotifyUserId: cleanString(ownerProfile.id || tokenRow.spotify_user_id),
      spotifyEmail: canManage ? cleanString(ownerProfile.email || tokenRow.spotify_email) : "",
      spotifyDisplayName: cleanString(ownerProfile.display_name || tokenRow.spotify_display_name)
    },
    currentlyPlaying: currentTrack,
    recentlyPlayed: recentTrack,
    tokenExpiresAt: tokenRow.expires_at,
    fetchedAt: new Date().toISOString()
  };
}

function toPublicProfile(row, socialLinks = [], skills = []) {
  if (!row) {
    return asObject(loadFallback("profile")) || {};
  }

  const content = asObject(row.content_json);
  const profile = {
    ...content,
    id: row.external_id || content.id || "profile-main",
    name: row.name || content.name || "",
    role: content.role || row.headline || "",
    headline: row.headline || content.headline || content.role || "",
    summary: content.summary || row.description || "",
    bio: row.description || content.bio || content.summary || "",
    profile_image: row.avatar_url || content.profile_image || "",
    updated_at: row.updated_at
  };

  if ((!profile.skills || !profile.skills.length) && Array.isArray(skills)) {
    profile.skills = skills.map((item) => item.name).filter(Boolean);
  }

  if ((!profile.social_links || !profile.social_links.length) && Array.isArray(socialLinks)) {
    profile.social_links = socialLinks.map((item) => ({
      platform: item.platform,
      url: item.url,
      label: item.label
    }));
  }

  if (!profile.focus_areas || !profile.focus_areas.length) {
    profile.focus_areas = asArray(profile.skills).slice(0, 4);
  }

  return profile;
}

async function getProfileData() {
  const row = await queryOne(
    `
      SELECT *
      FROM profile
      WHERE is_published = TRUE
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `
  );

  if (!row) {
    return asObject(loadFallback("profile")) || {};
  }

  const [socialLinks, skills] = await Promise.all([
    getSocialLinksData(),
    getSkillsData()
  ]);

  return toPublicProfile(row, socialLinks, skills);
}

async function getProjectsData(includeUnpublished = false) {
  const rows = await queryRows(
    `
      SELECT *
      FROM projects
      ${includeUnpublished ? "" : "WHERE is_published = TRUE"}
      ORDER BY sort_order ASC, created_at DESC
    `
  );

  if (!rows.length) {
    return asArray(loadFallback("projects"));
  }

  return rows.map(projectRowToPublic);
}

async function getArticlesData(includeUnpublished = false) {
  const rows = await queryRows(
    `
      SELECT *
      FROM articles
      ${includeUnpublished ? "" : "WHERE is_published = TRUE"}
      ORDER BY sort_order ASC, created_at DESC
    `
  );

  if (!rows.length) {
    return asArray(loadFallback("knowledge"));
  }

  return rows.map(articleRowToPublic);
}

async function getExperiencesData(includeUnpublished = false) {
  const rows = await queryRows(
    `
      SELECT *
      FROM experiences
      ${includeUnpublished ? "" : "WHERE is_published = TRUE"}
      ORDER BY sort_order ASC, created_at ASC
    `
  );

  if (!rows.length) {
    return asArray(loadFallback("timeline"));
  }

  return rows.map(experienceRowToPublic);
}

async function getSkillsData(includeUnpublished = false) {
  const rows = await queryRows(
    `
      SELECT *
      FROM skills
      ${includeUnpublished ? "" : "WHERE is_published = TRUE"}
      ORDER BY sort_order ASC, name ASC
    `
  );

  if (!rows.length) {
    const profile = asObject(loadFallback("profile"));
    return asArray(profile.skills).map((name, index) => ({
      id: slugify(name || `skill-${index + 1}`),
      name,
      slug: slugify(name || `skill-${index + 1}`),
      category: "skill",
      level: "",
      description: "",
      source: "fallback",
      status: "active",
      sort_order: index,
      is_published: true
    }));
  }

  return rows.map(skillRowToPublic);
}

async function getSocialLinksData(includeUnpublished = false) {
  const rows = await queryRows(
    `
      SELECT *
      FROM social_links
      ${includeUnpublished ? "" : "WHERE is_published = TRUE"}
      ORDER BY sort_order ASC, id ASC
    `
  );

  if (!rows.length) {
    const profile = asObject(loadFallback("profile"));
    const contact = asObject(loadFallback("contact"));
    const links = [];
    asArray(profile.social_links).forEach((item) => links.push(item));
    asArray(contact.social_links).forEach((item) => links.push(item));

    return links.map((item, index) => ({
      id: `${item.platform || "link"}-${index + 1}`,
      platform: cleanString(item.platform || item.name).toLowerCase(),
      label: cleanString(item.label || item.platform || item.name),
      url: cleanString(item.url),
      icon: cleanString(item.icon),
      status: "active",
      sort_order: index,
      is_published: true
    })).filter((item) => item.platform && item.url);
  }

  return rows.map(socialLinkRowToPublic);
}

async function getVenturesData(includeUnpublished = false) {
  const rows = await queryRows(
    `
      SELECT *
      FROM ventures
      ${includeUnpublished ? "" : "WHERE is_published = TRUE"}
      ORDER BY sort_order ASC, created_at DESC
    `
  );

  if (!rows.length) {
    return asArray(loadFallback("ventures"));
  }

  return rows.map(ventureRowToPublic);
}

async function getSettingsData() {
  const rows = await queryRows(
    `
      SELECT key, value_json
      FROM site_settings
      WHERE is_published = TRUE
      ORDER BY sort_order ASC, key ASC
    `
  );

  if (!rows.length) {
    return {
      homepage: asObject(loadFallback("homepage")),
      contact: asObject(loadFallback("contact")),
      "kom-config": asObject(loadFallback("kom-config")),
      notes: asArray(loadFallback("notes")),
      reviews: asArray(loadFallback("reviews"))
    };
  }

  const map = {};
  for (const row of rows) {
    map[row.key] = row.value_json;
  }

  for (const key of defaultSettingsKeys) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] = loadFallback(key);
    }
  }

  return map;
}

async function getSettingByKey(key) {
  const normalized = cleanString(key);
  if (!normalized) return null;
  const row = await queryOne(
    `
      SELECT key, value_json
      FROM site_settings
      WHERE key = $1
      LIMIT 1
    `,
    [normalized]
  );
  if (!row) {
    return loadFallback(normalized);
  }
  return row.value_json;
}

function firstSheetObject(rows) {
  if (!Array.isArray(rows) || !rows.length) return {};
  return asObject(rows[0]);
}

async function getSheetRowsSafe(sheetName) {
  try {
    const rows = await getSheetData(sheetName);
    return asArray(rows);
  } catch (error) {
    console.error(`Failed to read sheet "${sheetName}":`, error.message);
    return [];
  }
}

async function buildUnifiedSiteContent() {
  const [
    homepageRows,
    profileRows,
    timelineRows,
    notesRows,
    skillsRows,
    socialLinksRows,
    venturesRows
  ] = await Promise.all([
    getSheetRowsSafe("homepage"),
    getSheetRowsSafe("profile"),
    getSheetRowsSafe("timeline"),
    getSheetRowsSafe("notes"),
    getSheetRowsSafe("skills"),
    getSheetRowsSafe("social_links"),
    getSheetRowsSafe("ventures")
  ]);

  return {
    homepage: firstSheetObject(homepageRows),
    profile: firstSheetObject(profileRows),
    timeline: timelineRows,
    notes: notesRows,
    skills: skillsRows,
    social_links: socialLinksRows,
    ventures: venturesRows
  };
}

async function getUnifiedSiteContent() {
  if (siteContentCacheTtlMs <= 0) {
    return buildUnifiedSiteContent();
  }

  const now = Date.now();
  if (siteContentCache.value && siteContentCache.expiresAt > now) {
    return siteContentCache.value;
  }

  const payload = await buildUnifiedSiteContent();
  siteContentCache = {
    value: payload,
    expiresAt: now + siteContentCacheTtlMs
  };

  return payload;
}

async function upsertProfile(db, payload) {
  const normalized = normalizeProfileInput(payload);
  if (!normalized.id) throw new Error("Profile id wajib diisi");

  await db.query(
    `
      INSERT INTO profile (
        external_id, name, slug, headline, description, avatar_url,
        content_json, status, sort_order, is_published, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'active',0,TRUE,NOW())
      ON CONFLICT (external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        headline = EXCLUDED.headline,
        description = EXCLUDED.description,
        avatar_url = EXCLUDED.avatar_url,
        content_json = EXCLUDED.content_json,
        updated_at = NOW()
    `,
    [
      normalized.id,
      normalized.name,
      slugify(normalized.name || normalized.id, normalized.id),
      normalized.headline,
      normalized.description,
      normalized.avatarUrl,
      JSON.stringify(normalized.contentJson)
    ]
  );

  return {
    ...asObject(normalized.contentJson),
    id: normalized.id,
    name: normalized.name,
    headline: normalized.headline,
    bio: normalized.description,
    summary: normalized.description,
    profile_image: normalized.avatarUrl
  };
}

async function upsertProject(db, payload, fallbackId = "") {
  const normalized = normalizeProjectInput(payload, fallbackId);
  if (!normalized.id || !normalized.title) {
    throw new Error("Project id dan title wajib diisi");
  }

  await db.query(
    `
      INSERT INTO projects (
        external_id, title, slug, project_type, category,
        description, content, status, cover_image, url,
        tags, related_ids, likes, sort_order,
        is_published, published_at, meta_json, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11::jsonb,$12::jsonb,$13,$14,
        $15,$16,$17::jsonb,NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        project_type = EXCLUDED.project_type,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        cover_image = EXCLUDED.cover_image,
        url = EXCLUDED.url,
        tags = EXCLUDED.tags,
        related_ids = EXCLUDED.related_ids,
        likes = EXCLUDED.likes,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        published_at = EXCLUDED.published_at,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      normalized.id,
      normalized.title,
      normalized.slug,
      normalized.projectType,
      normalized.category,
      normalized.description,
      normalized.content,
      normalized.status,
      normalized.coverImage,
      normalized.url,
      JSON.stringify(normalized.tags),
      JSON.stringify(normalized.relatedIds),
      normalized.likes,
      normalized.sortOrder,
      normalized.isPublished,
      normalized.publishedAt,
      JSON.stringify(normalized.metaJson)
    ]
  );

  const row = await db.query(
    `SELECT * FROM projects WHERE external_id = $1 LIMIT 1`,
    [normalized.id]
  );
  return row.rows.length ? projectRowToPublic(row.rows[0]) : null;
}

async function upsertArticle(db, payload, fallbackId = "") {
  const normalized = normalizeArticleInput(payload, fallbackId);
  if (!normalized.id || !normalized.title) {
    throw new Error("Article id dan title wajib diisi");
  }

  await db.query(
    `
      INSERT INTO articles (
        external_id, title, slug, article_type, category,
        description, content, status, cover_image, url,
        tags, related_ids, likes, sort_order,
        is_published, published_at, meta_json, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11::jsonb,$12::jsonb,$13,$14,
        $15,$16,$17::jsonb,NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        article_type = EXCLUDED.article_type,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        cover_image = EXCLUDED.cover_image,
        url = EXCLUDED.url,
        tags = EXCLUDED.tags,
        related_ids = EXCLUDED.related_ids,
        likes = EXCLUDED.likes,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        published_at = EXCLUDED.published_at,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      normalized.id,
      normalized.title,
      normalized.slug,
      normalized.articleType,
      normalized.category,
      normalized.description,
      normalized.content,
      normalized.status,
      normalized.coverImage,
      normalized.url,
      JSON.stringify(normalized.tags),
      JSON.stringify(normalized.relatedIds),
      normalized.likes,
      normalized.sortOrder,
      normalized.isPublished,
      normalized.publishedAt,
      JSON.stringify(normalized.metaJson)
    ]
  );

  const row = await db.query(
    `SELECT * FROM articles WHERE external_id = $1 LIMIT 1`,
    [normalized.id]
  );
  return row.rows.length ? articleRowToPublic(row.rows[0]) : null;
}

async function upsertExperience(db, payload, fallbackId = "", fallbackSort = 0) {
  const normalized = normalizeExperienceInput(payload, fallbackId, fallbackSort);
  if (!normalized.id || !normalized.title) {
    throw new Error("Experience id dan title wajib diisi");
  }

  await db.query(
    `
      INSERT INTO experiences (
        external_id, title, slug, organization, experience_type,
        location, period, description, status, tags,
        sort_order, is_published, meta_json, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10::jsonb,
        $11,$12,$13::jsonb,NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        organization = EXCLUDED.organization,
        experience_type = EXCLUDED.experience_type,
        location = EXCLUDED.location,
        period = EXCLUDED.period,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        tags = EXCLUDED.tags,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      normalized.id,
      normalized.title,
      normalized.slug,
      normalized.organization,
      normalized.experienceType,
      normalized.location,
      normalized.period,
      normalized.description,
      normalized.status,
      JSON.stringify(normalized.tags),
      normalized.sortOrder,
      normalized.isPublished,
      JSON.stringify(normalized.metaJson)
    ]
  );

  const row = await db.query(
    `SELECT * FROM experiences WHERE external_id = $1 LIMIT 1`,
    [normalized.id]
  );
  return row.rows.length ? experienceRowToPublic(row.rows[0]) : null;
}

async function upsertSkill(db, payload, fallbackSort = 0) {
  const normalized = normalizeSkillInput(payload, fallbackSort);
  if (!normalized.name) {
    throw new Error("Skill name wajib diisi");
  }

  await db.query(
    `
      INSERT INTO skills (
        external_id, name, slug, category, level,
        description, source, status, sort_order,
        is_published, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,NOW()
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        external_id = EXCLUDED.external_id,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        level = EXCLUDED.level,
        description = EXCLUDED.description,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        updated_at = NOW()
    `,
    [
      normalized.externalId,
      normalized.name,
      normalized.slug,
      normalized.category,
      normalized.level,
      normalized.description,
      normalized.source,
      normalized.status,
      normalized.sortOrder,
      normalized.isPublished
    ]
  );

  const row = await db.query(`SELECT * FROM skills WHERE slug = $1 LIMIT 1`, [normalized.slug]);
  return row.rows.length ? skillRowToPublic(row.rows[0]) : null;
}

async function upsertSocialLink(db, payload, fallbackSort = 0) {
  const normalized = normalizeSocialLinkInput(payload, fallbackSort);
  if (!normalized.platform || !normalized.url) {
    throw new Error("Social link platform dan url wajib diisi");
  }

  await db.query(
    `
      INSERT INTO social_links (
        external_id, platform, label, url, icon,
        status, sort_order, is_published, meta_json,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9::jsonb,
        NOW()
      )
      ON CONFLICT (platform, url)
      DO UPDATE SET
        external_id = EXCLUDED.external_id,
        label = EXCLUDED.label,
        icon = EXCLUDED.icon,
        status = EXCLUDED.status,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      normalized.externalId,
      normalized.platform,
      normalized.label,
      normalized.url,
      normalized.icon,
      normalized.status,
      normalized.sortOrder,
      normalized.isPublished,
      JSON.stringify(normalized.metaJson)
    ]
  );

  const row = await db.query(
    `SELECT * FROM social_links WHERE platform = $1 AND url = $2 LIMIT 1`,
    [normalized.platform, normalized.url]
  );
  return row.rows.length ? socialLinkRowToPublic(row.rows[0]) : null;
}

async function upsertVenture(db, payload, fallbackId = "", fallbackSort = 0) {
  const normalized = normalizeVentureInput(payload, fallbackId, fallbackSort);
  if (!normalized.id || !normalized.title) {
    throw new Error("Venture id dan title wajib diisi");
  }

  await db.query(
    `
      INSERT INTO ventures (
        external_id, title, slug, role, description,
        status, image, url, tags, related_ids,
        sort_order, is_published, meta_json,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9::jsonb,$10::jsonb,
        $11,$12,$13::jsonb,
        NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        role = EXCLUDED.role,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        image = EXCLUDED.image,
        url = EXCLUDED.url,
        tags = EXCLUDED.tags,
        related_ids = EXCLUDED.related_ids,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      normalized.id,
      normalized.title,
      normalized.slug,
      normalized.role,
      normalized.description,
      normalized.status,
      normalized.image,
      normalized.url,
      JSON.stringify(normalized.tags),
      JSON.stringify(normalized.relatedIds),
      normalized.sortOrder,
      normalized.isPublished,
      JSON.stringify(normalized.metaJson)
    ]
  );

  const row = await db.query(
    `SELECT * FROM ventures WHERE external_id = $1 LIMIT 1`,
    [normalized.id]
  );
  return row.rows.length ? ventureRowToPublic(row.rows[0]) : null;
}

async function upsertSetting(db, key, value, sortOrder = 0) {
  const normalizedKey = cleanString(key);
  if (!normalizedKey) {
    throw new Error("Setting key wajib diisi");
  }

  const title = normalizedKey.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  await db.query(
    `
      INSERT INTO site_settings (
        key, title, slug, description, value_json,
        status, sort_order, is_published, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5::jsonb,
        'active',$6,TRUE,NOW()
      )
      ON CONFLICT (key)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        value_json = EXCLUDED.value_json,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `,
    [
      normalizedKey,
      title,
      slugify(normalizedKey, normalizedKey),
      `${title} setting`,
      JSON.stringify(value),
      sortOrder
    ]
  );

  return value;
}

async function deleteByExternalId(db, tableName, externalId) {
  const id = cleanString(externalId);
  if (!id) return false;
  const result = await db.query(`DELETE FROM ${tableName} WHERE external_id = $1`, [id]);
  return result.rowCount > 0;
}

async function deleteSkill(db, idOrSlug) {
  const token = cleanString(idOrSlug);
  if (!token) return false;

  const result = await db.query(
    `
      DELETE FROM skills
      WHERE external_id = $1 OR slug = $1
    `,
    [token]
  );
  return result.rowCount > 0;
}

async function deleteSocialLink(db, idOrExternalId) {
  const token = cleanString(idOrExternalId);
  if (!token) return false;

  const asNumber = Number(token);
  let result;
  if (Number.isInteger(asNumber)) {
    result = await db.query(
      `DELETE FROM social_links WHERE id = $1 OR external_id = $2`,
      [asNumber, token]
    );
  } else {
    result = await db.query(
      `DELETE FROM social_links WHERE external_id = $1`,
      [token]
    );
  }
  return result.rowCount > 0;
}

async function syncProjects(db, list) {
  const items = asArray(list);
  const ids = [];
  for (let i = 0; i < items.length; i += 1) {
    const normalized = normalizeProjectInput(items[i], items[i] && items[i].id ? items[i].id : `project-${i + 1}`);
    if (!normalized.id || !normalized.title) continue;
    const sourceItem = asObject(items[i]);
    const withSortOrder = Object.prototype.hasOwnProperty.call(sourceItem, "sort_order")
      ? sourceItem
      : { ...sourceItem, sort_order: i };
    await upsertProject(db, { ...withSortOrder, id: normalized.id }, normalized.id);
    ids.push(normalized.id);
  }

  if (!items.length) {
    await db.query(`DELETE FROM projects`);
  } else {
    await db.query(`DELETE FROM projects WHERE external_id <> ALL($1::text[])`, [ids]);
  }

  const rows = await db.query(
    `
      SELECT *
      FROM projects
      ORDER BY sort_order ASC, created_at DESC
    `
  );
  return rows.rows.map(projectRowToPublic);
}

async function syncArticles(db, list) {
  const items = asArray(list);
  const ids = [];
  for (let i = 0; i < items.length; i += 1) {
    const normalized = normalizeArticleInput(items[i], items[i] && items[i].id ? items[i].id : `article-${i + 1}`);
    if (!normalized.id || !normalized.title) continue;
    const sourceItem = asObject(items[i]);
    const withSortOrder = Object.prototype.hasOwnProperty.call(sourceItem, "sort_order")
      ? sourceItem
      : { ...sourceItem, sort_order: i };
    await upsertArticle(db, { ...withSortOrder, id: normalized.id }, normalized.id);
    ids.push(normalized.id);
  }

  if (!items.length) {
    await db.query(`DELETE FROM articles`);
  } else {
    await db.query(`DELETE FROM articles WHERE external_id <> ALL($1::text[])`, [ids]);
  }

  const rows = await db.query(
    `
      SELECT *
      FROM articles
      ORDER BY sort_order ASC, created_at DESC
    `
  );
  return rows.rows.map(articleRowToPublic);
}

async function syncVentures(db, list) {
  const items = asArray(list);
  const ids = [];
  for (let i = 0; i < items.length; i += 1) {
    const normalized = normalizeVentureInput(items[i], items[i] && items[i].id ? items[i].id : `venture-${i + 1}`, i);
    if (!normalized.id || !normalized.title) continue;
    const sourceItem = asObject(items[i]);
    const withSortOrder = Object.prototype.hasOwnProperty.call(sourceItem, "sort_order")
      ? sourceItem
      : { ...sourceItem, sort_order: i };
    await upsertVenture(db, { ...withSortOrder, id: normalized.id }, normalized.id, i);
    ids.push(normalized.id);
  }

  if (!items.length) {
    await db.query(`DELETE FROM ventures`);
  } else {
    await db.query(`DELETE FROM ventures WHERE external_id <> ALL($1::text[])`, [ids]);
  }

  const rows = await db.query(
    `
      SELECT *
      FROM ventures
      ORDER BY sort_order ASC, created_at DESC
    `
  );
  return rows.rows.map(ventureRowToPublic);
}

async function incrementProjectLike(id) {
  await ensureDatabaseReady();
  const result = await dbPool.query(
    `
      UPDATE projects
      SET likes = COALESCE(likes, 0) + 1,
          updated_at = NOW()
      WHERE external_id = $1
      RETURNING likes
    `,
    [id]
  );

  if (!result.rowCount) {
    return null;
  }

  return Number(result.rows[0].likes || 0);
}

async function incrementArticleLike(id) {
  await ensureDatabaseReady();
  const result = await dbPool.query(
    `
      UPDATE articles
      SET likes = COALESCE(likes, 0) + 1,
          updated_at = NOW()
      WHERE external_id = $1
      RETURNING likes
    `,
    [id]
  );

  if (!result.rowCount) {
    return null;
  }

  return Number(result.rows[0].likes || 0);
}

async function incrementVisitorCounter(pathname) {
  const safePath = cleanString(pathname) || "/";
  await ensureDatabaseReady();

  const perPageResult = await dbPool.query(
    `
      INSERT INTO page_views (path, view_count, updated_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (path)
      DO UPDATE SET
        view_count = page_views.view_count + 1,
        updated_at = NOW()
      RETURNING view_count
    `,
    [safePath]
  );

  const totalResult = await dbPool.query(
    `SELECT COALESCE(SUM(view_count), 0) AS total FROM page_views`
  );

  return {
    path: safePath,
    pageViews: Number(perPageResult.rows[0].view_count || 0),
    totalViews: Number(totalResult.rows[0].total || 0)
  };
}

function requireMasterSessionPage(req, res) {
  const session = getSession(req);
  if (!session) {
    redirect(res, "/admin-login.html");
    return null;
  }
  if (String(session.role || "").toLowerCase() !== "master") {
    sendText(res, 403, "Forbidden");
    return null;
  }
  return session;
}

function requireMasterSessionApi(req, res) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return null;
  }
  if (String(session.role || "").toLowerCase() !== "master") {
    sendJson(res, 403, { ok: false, error: "Forbidden" });
    return null;
  }
  return session;
}

async function handleLogin(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (!dbPool) {
    sendJson(res, 500, { ok: false, error: "Database not configured" });
    return;
  }

  let payload;
  try {
    const rawBody = await readRequestBody(req);
    payload = parseBodyByContentType(rawBody, req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Payload login tidak valid" });
    return;
  }

  const username = cleanString(payload.username);
  const password = String(payload.password || "");

  if (!username || !password) {
    sendJson(res, 400, { ok: false, error: "Username dan password wajib diisi" });
    return;
  }

  try {
    await ensureDatabaseReady();

    const result = await dbPool.query(
      `
        SELECT id, username, password_hash, role
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
      [username]
    );

    if (result.rowCount === 0) {
      await logActivity(req, {
        username,
        action: "admin_login",
        entityType: "auth",
        status: "failed",
        message: "Username tidak ditemukan"
      });
      sendJson(res, 401, { ok: false, error: "Username atau password tidak valid" });
      return;
    }

    const user = result.rows[0];
    const passwordHash = String(user.password_hash || "");
    if (!passwordHash) {
      await logActivity(req, {
        userId: user.id,
        username: user.username,
        action: "admin_login",
        entityType: "auth",
        status: "failed",
        message: "Password hash kosong"
      });
      sendJson(res, 401, { ok: false, error: "Username atau password tidak valid" });
      return;
    }

    const passwordValid = await bcrypt.compare(password, passwordHash);
    if (!passwordValid) {
      await logActivity(req, {
        userId: user.id,
        username: user.username,
        action: "admin_login",
        entityType: "auth",
        status: "failed",
        message: "Password tidak valid"
      });
      sendJson(res, 401, { ok: false, error: "Username atau password tidak valid" });
      return;
    }

    if (String(user.role || "").toLowerCase() !== "master") {
      await logActivity(req, {
        userId: user.id,
        username: user.username,
        action: "admin_login",
        entityType: "auth",
        status: "failed",
        message: `Role tidak diizinkan: ${user.role}`
      });
      sendJson(res, 403, { ok: false, error: "Role tidak diizinkan masuk admin" });
      return;
    }

    const { sid, expiresAt } = createSession(user);
    const secureCookie = forceSecureCookie || isSecureRequest(req);
    const setCookie = serializeCookie(sessionCookieName, sid, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: sessionMaxAgeSeconds,
      secure: secureCookie
    });

    await logActivity(req, {
      userId: user.id,
      username: user.username,
      action: "admin_login",
      entityType: "auth",
      status: "success",
      message: "Login berhasil"
    });

    sendJson(
      res,
      200,
      {
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        expiresAt: new Date(expiresAt).toISOString()
      },
      { "set-cookie": setCookie }
    );
  } catch (error) {
    console.error("Login error:", error);
    sendJson(res, 500, { ok: false, error: "Terjadi kesalahan saat login" });
  }
}

function handleSession(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }
  const session = getSession(req);
  if (!session) {
    sendJson(res, 200, { ok: true, authenticated: false });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    authenticated: true,
    user: {
      id: session.userId || null,
      username: session.username,
      role: session.role
    },
    expiresAt: new Date(session.expiresAt).toISOString()
  });
}

async function handleLogout(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }
  const session = getSession(req);
  if (session) {
    clearSession(session.sid);
    await logActivity(req, {
      userId: session.userId,
      username: session.username,
      action: "admin_logout",
      entityType: "auth",
      status: "success",
      message: "Logout berhasil"
    });
  }

  const secureCookie = forceSecureCookie || isSecureRequest(req);
  const setCookie = serializeCookie(sessionCookieName, "", {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 0,
    secure: secureCookie
  });

  sendJson(res, 200, { ok: true }, { "set-cookie": setCookie });
}

async function handleSpotifyApi(req, res, pathname, requestUrl) {
  if (pathname !== "/api/spotify/login"
    && pathname !== "/api/spotify/callback"
    && pathname !== "/api/spotify/status"
    && pathname !== "/api/spotify/refresh"
    && pathname !== "/api/spotify/disconnect") {
    return false;
  }

  const config = buildSpotifyConfig(req);

  if (pathname === "/api/spotify/login") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const session = requireMasterSessionApi(req, res);
    if (!session) return true;

    if (!spotifyConfigured(config)) {
      sendJson(res, 500, {
        ok: false,
        error: "Spotify backend config belum lengkap (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI)"
      });
      return true;
    }

    await upsertSpotifySettingsFromEnv(config);
    const state = createSpotifyOauthState(session, {
      redirectUri: config.redirectUri,
      nextPath: requestUrl.searchParams.get("next")
    });

    const authUrl = new URL(config.authBaseUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", config.redirectUri);
    authUrl.searchParams.set("scope", config.scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("show_dialog", "true");

    await logActivity(req, {
      userId: session.userId,
      username: session.username,
      action: "spotify_oauth_start",
      entityType: "spotify",
      entityId: state,
      status: "success",
      message: "Spotify OAuth login dimulai",
      metadata: {
        redirect_uri: config.redirectUri
      }
    });

    redirect(res, authUrl.toString());
    return true;
  }

  if (pathname === "/api/spotify/callback") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const spotifyErrorParam = cleanString(requestUrl.searchParams.get("error"));
    const spotifyErrorDescription = cleanString(requestUrl.searchParams.get("error_description"));
    const state = cleanString(requestUrl.searchParams.get("state"));
    const code = cleanString(requestUrl.searchParams.get("code"));
    const stateEntry = consumeSpotifyOauthState(state);
    const session = getSession(req);
    const nextPath = stateEntry && stateEntry.nextPath
      ? stateEntry.nextPath
      : "/admin.html#module-spotify";

    if (spotifyErrorParam) {
      const message = spotifyErrorDescription || spotifyErrorParam;
      await logActivity(req, {
        userId: session && session.userId,
        username: session && session.username,
        action: "spotify_oauth_callback",
        entityType: "spotify",
        entityId: state || null,
        status: "failed",
        message: `Spotify callback error: ${message}`
      });
      redirect(res, appendQueryParamToPath(nextPath, "spotify_error", message));
      return true;
    }

    if (!stateEntry || !code) {
      await logActivity(req, {
        userId: session && session.userId,
        username: session && session.username,
        action: "spotify_oauth_callback",
        entityType: "spotify",
        entityId: state || null,
        status: "failed",
        message: "State atau code callback Spotify tidak valid"
      });
      redirect(res, appendQueryParamToPath(nextPath, "spotify_error", "Spotify callback state/code invalid"));
      return true;
    }

    if (!session || String(session.role || "").toLowerCase() !== "master" || session.sid !== stateEntry.sessionSid) {
      await logActivity(req, {
        userId: session && session.userId,
        username: session && session.username,
        action: "spotify_oauth_callback",
        entityType: "spotify",
        entityId: state || null,
        status: "failed",
        message: "Session admin untuk callback Spotify tidak valid"
      });
      redirect(res, appendQueryParamToPath(nextPath, "spotify_error", "Admin session invalid during Spotify callback"));
      return true;
    }

    if (!spotifyConfigured(config)) {
      redirect(res, appendQueryParamToPath(nextPath, "spotify_error", "Spotify backend config incomplete"));
      return true;
    }

    try {
      await upsertSpotifySettingsFromEnv(config);
      const tokenPayload = await spotifyTokenRequest(config, {
        grant_type: "authorization_code",
        code,
        redirect_uri: stateEntry.redirectUri || config.redirectUri
      });
      const profile = await spotifyApiGet(tokenPayload.access_token, "/me");
      const policy = await spotifyAllowedPolicy(config);
      const ownerProfile = validateSpotifyOwnerProfile(profile, policy);

      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        await saveSpotifyToken(client, tokenPayload, ownerProfile);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "spotify_oauth_callback",
        entityType: "spotify",
        entityId: ownerProfile.spotifyUserId,
        status: "success",
        message: "Spotify token berhasil disimpan",
        metadata: {
          spotify_email: ownerProfile.spotifyEmail
        }
      });

      redirect(res, appendQueryParamToPath(nextPath, "spotify", "connected"));
      return true;
    } catch (error) {
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "spotify_oauth_callback",
        entityType: "spotify",
        entityId: null,
        status: "failed",
        message: error.message || "Spotify callback gagal"
      });
      redirect(res, appendQueryParamToPath(nextPath, "spotify_error", error.message || "Spotify callback failed"));
      return true;
    }
  }

  if (pathname === "/api/spotify/status") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const session = getSession(req);
    const forceRefreshRequested = String(requestUrl.searchParams.get("refresh") || "").toLowerCase() === "1";
    const forceRefreshAllowed = Boolean(
      forceRefreshRequested
      && session
      && String(session.role || "").toLowerCase() === "master"
    );

    try {
      const payload = await spotifyStatusPayload(req, { forceRefresh: forceRefreshAllowed });
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || "Failed to read Spotify status"
      });
    }
    return true;
  }

  if (pathname === "/api/spotify/refresh") {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const session = requireMasterSessionApi(req, res);
    if (!session) return true;

    if (!spotifyConfigured(config)) {
      sendJson(res, 500, { ok: false, error: "Spotify backend config belum lengkap" });
      return true;
    }

    try {
      await ensureDatabaseReady();
      const tokenRow = await activeSpotifyTokenRow(dbPool);
      if (!tokenRow) {
        sendJson(res, 404, { ok: false, error: "Spotify belum terhubung" });
        return true;
      }

      await refreshSpotifyToken(dbPool, config, tokenRow);
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "spotify_token_refresh",
        entityType: "spotify",
        entityId: tokenRow.spotify_user_id,
        status: "success",
        message: "Spotify token berhasil di-refresh"
      });

      const payload = await spotifyStatusPayload(req, { forceRefresh: false });
      sendJson(res, 200, payload);
    } catch (error) {
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "spotify_token_refresh",
        entityType: "spotify",
        entityId: null,
        status: "failed",
        message: error.message || "Spotify refresh gagal"
      });
      sendJson(res, 400, { ok: false, error: error.message || "Spotify refresh gagal" });
    }
    return true;
  }

  if (pathname === "/api/spotify/disconnect") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const session = requireMasterSessionApi(req, res);
    if (!session) return true;

    await ensureDatabaseReady();
    await dbPool.query(
      `
        UPDATE spotify_tokens
        SET is_active = FALSE, updated_at = NOW()
        WHERE is_active = TRUE
      `
    );

    await logActivity(req, {
      userId: session.userId,
      username: session.username,
      action: "spotify_disconnect",
      entityType: "spotify",
      entityId: null,
      status: "success",
      message: "Spotify token dinonaktifkan"
    });

    sendJson(res, 200, { ok: true, disconnected: true });
    return true;
  }

  return false;
}

async function handlePublicApi(req, res, pathname, requestUrl) {
  if (await handleSpotifyApi(req, res, pathname, requestUrl)) {
    return true;
  }

  if (pathname === "/api/profile") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const profile = await getProfileData();
    sendJson(res, 200, profile);
    return true;
  }

  if (pathname === "/api/projects") {
    if (req.method === "GET") {
      const projects = await getProjectsData(false);
      sendJson(res, 200, projects);
      return true;
    }
  }

  if (pathname === "/api/articles" || pathname === "/api/knowledge") {
    if (req.method === "GET") {
      const articles = await getArticlesData(false);
      sendJson(res, 200, articles);
      return true;
    }
  }

  if (pathname === "/api/experiences") {
    if (req.method === "GET") {
      const experiences = await getExperiencesData(false);
      sendJson(res, 200, experiences);
      return true;
    }
  }

  if (pathname === "/api/skills") {
    if (req.method === "GET") {
      const skills = await getSkillsData(false);
      sendJson(res, 200, skills);
      return true;
    }
  }

  if (pathname === "/api/social-links") {
    if (req.method === "GET") {
      const links = await getSocialLinksData(false);
      sendJson(res, 200, links);
      return true;
    }
  }

  if (pathname === "/api/ventures") {
    if (req.method === "GET") {
      const ventures = await getVenturesData(false);
      sendJson(res, 200, ventures);
      return true;
    }
  }

  if (pathname === "/api/settings") {
    if (req.method === "GET") {
      const key = cleanString(requestUrl.searchParams.get("key"));
      if (key) {
        const setting = await getSettingByKey(key);
        sendJson(res, 200, setting != null ? setting : {});
      } else {
        const settings = await getSettingsData();
        sendJson(res, 200, settings);
      }
      return true;
    }
  }

  if (pathname === "/api/site-content") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const payload = await getUnifiedSiteContent();
    sendJson(res, 200, payload);
    return true;
  }

  if (pathname === "/api/sheets/notes") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const notes = await getSheetData("notes");
    sendJson(res, 200, notes);
    return true;
  }

  if (pathname === "/api/sheets/timeline") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const timeline = await getSheetData("timeline");
    sendJson(res, 200, timeline);
    return true;
  }

  if (pathname === "/api/sheets/profile") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const profile = await getSheetData("profile");
    sendJson(res, 200, profile);
    return true;
  }

  if (pathname === "/api/sheets/homepage") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const homepage = await getSheetData("homepage");
    sendJson(res, 200, homepage);
    return true;
  }

  const projectLikeMatch = pathname.match(/^\/api\/projects\/([^/]+)\/like$/);
  if (projectLikeMatch) {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const id = parsePathParam(projectLikeMatch[1]);
    const likes = await incrementProjectLike(id);
    if (likes == null) {
      sendJson(res, 404, { ok: false, error: "Project tidak ditemukan" });
      return true;
    }
    sendJson(res, 200, { ok: true, id, likes });
    return true;
  }

  const articleLikeMatch = pathname.match(/^\/api\/articles\/([^/]+)\/like$/);
  if (articleLikeMatch) {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }
    const id = parsePathParam(articleLikeMatch[1]);
    const likes = await incrementArticleLike(id);
    if (likes == null) {
      sendJson(res, 404, { ok: false, error: "Article tidak ditemukan" });
      return true;
    }
    sendJson(res, 200, { ok: true, id, likes });
    return true;
  }

  if (pathname === "/api/visitor-counter") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    const counter = await incrementVisitorCounter(payload.path || requestUrl.pathname || "/");
    sendJson(res, 200, { ok: true, ...counter });
    return true;
  }

  return false;
}

async function handleAdminApi(req, res, pathname) {
  if (!pathname.startsWith("/api/admin/")) return false;

  if (pathname === "/api/admin/login") {
    await handleLogin(req, res);
    return true;
  }

  if (pathname === "/api/admin/session") {
    handleSession(req, res);
    return true;
  }

  if (pathname === "/api/admin/logout") {
    await handleLogout(req, res);
    return true;
  }

  const session = requireMasterSessionApi(req, res);
  if (!session) return true;

  if (pathname === "/api/admin/profile") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const profile = await upsertProfile(client, payload);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "profile_upsert",
        entityType: "profile",
        entityId: profile.id || "profile-main",
        status: "success",
        message: "Profile berhasil diupdate"
      });

      sendJson(res, 200, { ok: true, data: profile });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "profile_upsert",
        entityType: "profile",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal menyimpan profile" });
    } finally {
      client.release();
    }
    return true;
  }

  if (pathname === "/api/admin/projects" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const created = await upsertProject(client, payload, payload.id);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "project_create",
        entityType: "projects",
        entityId: created && created.id,
        status: "success",
        message: "Project berhasil dibuat"
      });

      sendJson(res, 200, { ok: true, data: created });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "project_create",
        entityType: "projects",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal membuat project" });
    } finally {
      client.release();
    }
    return true;
  }

  const projectIdMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (projectIdMatch) {
    const projectId = parsePathParam(projectIdMatch[1]);

    if (req.method === "PUT") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return true;

      await ensureDatabaseReady();
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        const updated = await upsertProject(client, { ...asObject(payload), id: projectId }, projectId);
        await client.query("COMMIT");

        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "project_update",
          entityType: "projects",
          entityId: projectId,
          status: "success",
          message: "Project berhasil diupdate"
        });

        sendJson(res, 200, { ok: true, data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "project_update",
          entityType: "projects",
          entityId: projectId,
          status: "failed",
          message: error.message
        });
        sendJson(res, 400, { ok: false, error: error.message || "Gagal update project" });
      } finally {
        client.release();
      }
      return true;
    }

    if (req.method === "DELETE") {
      await ensureDatabaseReady();
      const removed = await deleteByExternalId(dbPool, "projects", projectId);

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "project_delete",
        entityType: "projects",
        entityId: projectId,
        status: removed ? "success" : "failed",
        message: removed ? "Project dihapus" : "Project tidak ditemukan"
      });

      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Project tidak ditemukan" });
      } else {
        sendNoContent(res);
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  if (pathname === "/api/admin/articles" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const created = await upsertArticle(client, payload, payload.id);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "article_create",
        entityType: "articles",
        entityId: created && created.id,
        status: "success",
        message: "Article berhasil dibuat"
      });

      sendJson(res, 200, { ok: true, data: created });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "article_create",
        entityType: "articles",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal membuat article" });
    } finally {
      client.release();
    }
    return true;
  }

  const articleIdMatch = pathname.match(/^\/api\/admin\/articles\/([^/]+)$/);
  if (articleIdMatch) {
    const articleId = parsePathParam(articleIdMatch[1]);

    if (req.method === "PUT") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return true;

      await ensureDatabaseReady();
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        const updated = await upsertArticle(client, { ...asObject(payload), id: articleId }, articleId);
        await client.query("COMMIT");

        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "article_update",
          entityType: "articles",
          entityId: articleId,
          status: "success",
          message: "Article berhasil diupdate"
        });

        sendJson(res, 200, { ok: true, data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "article_update",
          entityType: "articles",
          entityId: articleId,
          status: "failed",
          message: error.message
        });
        sendJson(res, 400, { ok: false, error: error.message || "Gagal update article" });
      } finally {
        client.release();
      }
      return true;
    }

    if (req.method === "DELETE") {
      await ensureDatabaseReady();
      const removed = await deleteByExternalId(dbPool, "articles", articleId);

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "article_delete",
        entityType: "articles",
        entityId: articleId,
        status: removed ? "success" : "failed",
        message: removed ? "Article dihapus" : "Article tidak ditemukan"
      });

      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Article tidak ditemukan" });
      } else {
        sendNoContent(res);
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  if (pathname === "/api/admin/experiences" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const created = await upsertExperience(client, payload, payload.id, Number(payload.sort_order) || 0);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "experience_create",
        entityType: "experiences",
        entityId: created && created.id,
        status: "success",
        message: "Experience berhasil dibuat"
      });

      sendJson(res, 200, { ok: true, data: created });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "experience_create",
        entityType: "experiences",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal membuat experience" });
    } finally {
      client.release();
    }
    return true;
  }

  const experienceIdMatch = pathname.match(/^\/api\/admin\/experiences\/([^/]+)$/);
  if (experienceIdMatch) {
    const experienceId = parsePathParam(experienceIdMatch[1]);

    if (req.method === "PUT") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return true;

      await ensureDatabaseReady();
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        const updated = await upsertExperience(
          client,
          { ...asObject(payload), id: experienceId },
          experienceId,
          Number(payload.sort_order) || 0
        );
        await client.query("COMMIT");

        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "experience_update",
          entityType: "experiences",
          entityId: experienceId,
          status: "success",
          message: "Experience berhasil diupdate"
        });

        sendJson(res, 200, { ok: true, data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "experience_update",
          entityType: "experiences",
          entityId: experienceId,
          status: "failed",
          message: error.message
        });
        sendJson(res, 400, { ok: false, error: error.message || "Gagal update experience" });
      } finally {
        client.release();
      }
      return true;
    }

    if (req.method === "DELETE") {
      await ensureDatabaseReady();
      const removed = await deleteByExternalId(dbPool, "experiences", experienceId);

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "experience_delete",
        entityType: "experiences",
        entityId: experienceId,
        status: removed ? "success" : "failed",
        message: removed ? "Experience dihapus" : "Experience tidak ditemukan"
      });

      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Experience tidak ditemukan" });
      } else {
        sendNoContent(res);
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  if (pathname === "/api/admin/skills" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const created = await upsertSkill(client, payload, Number(payload.sort_order) || 0);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "skill_create",
        entityType: "skills",
        entityId: created && created.id,
        status: "success",
        message: "Skill berhasil dibuat"
      });

      sendJson(res, 200, { ok: true, data: created });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "skill_create",
        entityType: "skills",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal membuat skill" });
    } finally {
      client.release();
    }
    return true;
  }

  const skillIdMatch = pathname.match(/^\/api\/admin\/skills\/([^/]+)$/);
  if (skillIdMatch) {
    const skillId = parsePathParam(skillIdMatch[1]);

    if (req.method === "PUT") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return true;

      await ensureDatabaseReady();
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        const updated = await upsertSkill(client, { ...asObject(payload), id: skillId, external_id: skillId }, Number(payload.sort_order) || 0);
        await client.query("COMMIT");

        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "skill_update",
          entityType: "skills",
          entityId: skillId,
          status: "success",
          message: "Skill berhasil diupdate"
        });

        sendJson(res, 200, { ok: true, data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "skill_update",
          entityType: "skills",
          entityId: skillId,
          status: "failed",
          message: error.message
        });
        sendJson(res, 400, { ok: false, error: error.message || "Gagal update skill" });
      } finally {
        client.release();
      }
      return true;
    }

    if (req.method === "DELETE") {
      await ensureDatabaseReady();
      const removed = await deleteSkill(dbPool, skillId);

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "skill_delete",
        entityType: "skills",
        entityId: skillId,
        status: removed ? "success" : "failed",
        message: removed ? "Skill dihapus" : "Skill tidak ditemukan"
      });

      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Skill tidak ditemukan" });
      } else {
        sendNoContent(res);
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  if (pathname === "/api/admin/social-links" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const created = await upsertSocialLink(client, payload, Number(payload.sort_order) || 0);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "social_link_create",
        entityType: "social_links",
        entityId: created && created.id,
        status: "success",
        message: "Social link berhasil dibuat"
      });

      sendJson(res, 200, { ok: true, data: created });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "social_link_create",
        entityType: "social_links",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal membuat social link" });
    } finally {
      client.release();
    }
    return true;
  }

  const socialLinkIdMatch = pathname.match(/^\/api\/admin\/social-links\/([^/]+)$/);
  if (socialLinkIdMatch) {
    const socialLinkId = parsePathParam(socialLinkIdMatch[1]);

    if (req.method === "PUT") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return true;

      await ensureDatabaseReady();
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        const updated = await upsertSocialLink(client, { ...asObject(payload), id: socialLinkId, external_id: socialLinkId }, Number(payload.sort_order) || 0);
        await client.query("COMMIT");

        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "social_link_update",
          entityType: "social_links",
          entityId: socialLinkId,
          status: "success",
          message: "Social link berhasil diupdate"
        });

        sendJson(res, 200, { ok: true, data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "social_link_update",
          entityType: "social_links",
          entityId: socialLinkId,
          status: "failed",
          message: error.message
        });
        sendJson(res, 400, { ok: false, error: error.message || "Gagal update social link" });
      } finally {
        client.release();
      }
      return true;
    }

    if (req.method === "DELETE") {
      await ensureDatabaseReady();
      const removed = await deleteSocialLink(dbPool, socialLinkId);

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "social_link_delete",
        entityType: "social_links",
        entityId: socialLinkId,
        status: removed ? "success" : "failed",
        message: removed ? "Social link dihapus" : "Social link tidak ditemukan"
      });

      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Social link tidak ditemukan" });
      } else {
        sendNoContent(res);
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  if (pathname === "/api/admin/settings" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    const key = cleanString(payload.key);
    const value = Object.prototype.hasOwnProperty.call(payload, "value") ? payload.value : null;
    if (!key) {
      sendJson(res, 400, { ok: false, error: "key wajib diisi" });
      return true;
    }

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const saved = await upsertSetting(client, key, value, Number(payload.sort_order) || 0);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "setting_upsert",
        entityType: "site_settings",
        entityId: key,
        status: "success",
        message: "Setting berhasil diupdate"
      });

      sendJson(res, 200, { ok: true, key, data: saved });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "setting_upsert",
        entityType: "site_settings",
        entityId: key,
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal update setting" });
    } finally {
      client.release();
    }
    return true;
  }

  const settingKeyMatch = pathname.match(/^\/api\/admin\/settings\/([^/]+)$/);
  if (settingKeyMatch) {
    const settingKey = parsePathParam(settingKeyMatch[1]);

    if (req.method !== "POST" && req.method !== "PUT") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const saved = await upsertSetting(client, settingKey, payload, Number(payload.sort_order) || 0);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "setting_upsert",
        entityType: "site_settings",
        entityId: settingKey,
        status: "success",
        message: "Setting berhasil diupdate"
      });

      sendJson(res, 200, { ok: true, key: settingKey, data: saved });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "setting_upsert",
        entityType: "site_settings",
        entityId: settingKey,
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal update setting" });
    } finally {
      client.release();
    }

    return true;
  }

  if (pathname === "/api/admin/ventures" && req.method === "POST") {
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const created = await upsertVenture(client, payload, payload.id, Number(payload.sort_order) || 0);
      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "venture_create",
        entityType: "ventures",
        entityId: created && created.id,
        status: "success",
        message: "Venture berhasil dibuat"
      });

      sendJson(res, 200, { ok: true, data: created });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "venture_create",
        entityType: "ventures",
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Gagal membuat venture" });
    } finally {
      client.release();
    }
    return true;
  }

  const ventureIdMatch = pathname.match(/^\/api\/admin\/ventures\/([^/]+)$/);
  if (ventureIdMatch) {
    const ventureId = parsePathParam(ventureIdMatch[1]);

    if (req.method === "PUT") {
      const payload = await readJsonBody(req, res);
      if (payload == null) return true;

      await ensureDatabaseReady();
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        const updated = await upsertVenture(client, { ...asObject(payload), id: ventureId }, ventureId, Number(payload.sort_order) || 0);
        await client.query("COMMIT");

        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "venture_update",
          entityType: "ventures",
          entityId: ventureId,
          status: "success",
          message: "Venture berhasil diupdate"
        });

        sendJson(res, 200, { ok: true, data: updated });
      } catch (error) {
        await client.query("ROLLBACK");
        await logActivity(req, {
          userId: session.userId,
          username: session.username,
          action: "venture_update",
          entityType: "ventures",
          entityId: ventureId,
          status: "failed",
          message: error.message
        });
        sendJson(res, 400, { ok: false, error: error.message || "Gagal update venture" });
      } finally {
        client.release();
      }
      return true;
    }

    if (req.method === "DELETE") {
      await ensureDatabaseReady();
      const removed = await deleteByExternalId(dbPool, "ventures", ventureId);

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "venture_delete",
        entityType: "ventures",
        entityId: ventureId,
        status: removed ? "success" : "failed",
        message: removed ? "Venture dihapus" : "Venture tidak ditemukan"
      });

      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Venture tidak ditemukan" });
      } else {
        sendNoContent(res);
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  const bulkMatch = pathname.match(/^\/api\/admin\/bulk\/([^/]+)$/);
  if (bulkMatch) {
    if (req.method !== "POST" && req.method !== "PUT") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    }

    const source = parsePathParam(bulkMatch[1]);
    const payload = await readJsonBody(req, res);
    if (payload == null) return true;

    await ensureDatabaseReady();
    const client = await dbPool.connect();

    try {
      await client.query("BEGIN");
      let data;

      if (source === "projects") {
        data = await syncProjects(client, payload);
      } else if (source === "knowledge" || source === "articles") {
        data = await syncArticles(client, payload);
      } else if (source === "ventures") {
        data = await syncVentures(client, payload);
      } else {
        throw new Error(`Bulk source tidak didukung: ${source}`);
      }

      await client.query("COMMIT");

      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "bulk_sync",
        entityType: source,
        entityId: source,
        status: "success",
        message: `Bulk sync ${source} berhasil`
      });

      sendJson(res, 200, { ok: true, source, data });
    } catch (error) {
      await client.query("ROLLBACK");
      await logActivity(req, {
        userId: session.userId,
        username: session.username,
        action: "bulk_sync",
        entityType: source,
        entityId: source,
        status: "failed",
        message: error.message
      });
      sendJson(res, 400, { ok: false, error: error.message || "Bulk sync gagal" });
    } finally {
      client.release();
    }

    return true;
  }

  sendJson(res, 404, { ok: false, error: "Admin endpoint not found" });
  return true;
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  const pathname = safeDecode(requestUrl.pathname);

  if (pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "rasyid-puteraa", port });
    return;
  }

  if (await handlePublicApi(req, res, pathname, requestUrl)) {
    return;
  }

  if (await handleAdminApi(req, res, pathname)) {
    return;
  }

  if (pathname === "/admin" || pathname === "/admin.html") {
    if (!requireMasterSessionPage(req, res)) return;
    sendFile(res, path.join(appRoot, "admin.html"));
    return;
  }

  if (pathname === "/admin-login" || pathname === "/admin-login.html") {
    const session = getSession(req);
    if (session && String(session.role || "").toLowerCase() === "master") {
      redirect(res, "/admin.html");
      return;
    }
    sendFile(res, path.join(appRoot, "admin-login.html"));
    return;
  }

  const filePath = resolveStaticPath(pathname);
  if (!filePath) {
    sendText(res, 400, "Bad Request");
    return;
  }

  sendFile(res, filePath);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Unhandled server error:", error);
    sendJson(res, 500, { ok: false, error: "Internal Server Error" });
  });
});

server.listen(port, host, () => {
  console.log(`rasyid-puteraa listening on http://${host}:${port}`);
});
