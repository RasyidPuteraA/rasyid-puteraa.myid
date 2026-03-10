(function() {
  "use strict";

  const STORAGE_KEYS = {
    auth: "mrp_spotify_auth_v1",
    pkceVerifier: "mrp_spotify_pkce_verifier_v1",
    oauthState: "mrp_spotify_oauth_state_v1"
  };

  const OWNER_SPOTIFY_CONFIG = {
    // Set this once with your Spotify App Client ID.
    spotify_client_id: "",
    redirect_uri: "",
    required_scopes: [
      "user-read-currently-playing",
      "user-read-recently-played",
      "user-read-private"
    ],
    allowed_spotify_user_id: "6q18z8t9g2c2v41522b3zjmxm",
    // Optional hard check. Keep empty to skip display name validation.
    allowed_display_name: "",
    auth_base_url: "https://accounts.spotify.com/authorize",
    token_url: "https://accounts.spotify.com/api/token",
    api_base_url: "https://api.spotify.com/v1"
  };

  function createSpotifyError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function resolveRedirectUri() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function getRuntimeOwnerConfig() {
    const runtime = window.__SPOTIFY_OWNER_CONFIG__;
    return runtime && typeof runtime === "object" ? runtime : {};
  }

  function getConfig() {
    const runtime = getRuntimeOwnerConfig();
    const requiredScopes = Array.isArray(runtime.required_scopes)
      ? runtime.required_scopes.map(item => String(item || "").trim()).filter(Boolean)
      : OWNER_SPOTIFY_CONFIG.required_scopes.slice();
    const scopeSet = new Set([
      ...OWNER_SPOTIFY_CONFIG.required_scopes,
      ...requiredScopes
    ]);

    const clientId = String(
      runtime.spotify_client_id ||
      OWNER_SPOTIFY_CONFIG.spotify_client_id ||
      ""
    ).trim();

    const redirectUri = String(
      runtime.redirect_uri ||
      OWNER_SPOTIFY_CONFIG.redirect_uri ||
      ""
    ).trim() || resolveRedirectUri();

    const allowedDisplayName = String(
      runtime.allowed_display_name ||
      OWNER_SPOTIFY_CONFIG.allowed_display_name ||
      ""
    ).trim();

    return {
      spotify_client_id: clientId,
      redirect_uri: redirectUri,
      required_scopes: Array.from(scopeSet),
      allowed_spotify_user_id: OWNER_SPOTIFY_CONFIG.allowed_spotify_user_id,
      allowed_display_name: allowedDisplayName,
      auth_base_url: String(runtime.auth_base_url || OWNER_SPOTIFY_CONFIG.auth_base_url),
      token_url: String(runtime.token_url || OWNER_SPOTIFY_CONFIG.token_url),
      api_base_url: String(runtime.api_base_url || OWNER_SPOTIFY_CONFIG.api_base_url)
    };
  }

  function getStoredSpotifyAuth() {
    return readJson(STORAGE_KEYS.auth);
  }

  function persistSpotifyAuthFromToken(payload, previousAuth) {
    const previous = previousAuth && typeof previousAuth === "object" ? previousAuth : {};
    const expiresIn = Number.parseInt(payload.expires_in, 10);
    const expiresAt = Date.now() + ((Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000);
    const config = getConfig();

    const auth = {
      access_token: String(payload.access_token || "").trim(),
      refresh_token: String(payload.refresh_token || previous.refresh_token || "").trim(),
      token_type: String(payload.token_type || previous.token_type || "Bearer"),
      scope: String(payload.scope || previous.scope || config.required_scopes.join(" ")),
      expires_at: expiresAt,
      spotify_user_id: String(previous.spotify_user_id || ""),
      spotify_display_name: String(previous.spotify_display_name || ""),
      updated_at: new Date().toISOString()
    };

    if (!auth.access_token) {
      throw createSpotifyError("TOKEN_INVALID", "Spotify token response is missing access_token.");
    }

    writeJson(STORAGE_KEYS.auth, auth);
    return auth;
  }

  function clearSpotifyAuthSession() {
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.pkceVerifier);
    localStorage.removeItem(STORAGE_KEYS.oauthState);
  }

  function hasStoredSpotifyAuth() {
    const auth = getStoredSpotifyAuth();
    return Boolean(auth && auth.access_token);
  }

  function isTokenExpiring(auth) {
    if (!auth || !auth.access_token) return true;
    return Date.now() >= (Number(auth.expires_at) - 60000);
  }

  function generateRandomString(length) {
    const size = Number(length) || 64;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(size);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(value => chars[value % chars.length]).join("");
  }

  async function sha256Base64Url(input) {
    if (!window.crypto || !window.crypto.subtle) {
      throw createSpotifyError("CRYPTO_UNAVAILABLE", "Web Crypto API is unavailable.");
    }

    const data = new TextEncoder().encode(String(input || ""));
    const hash = await window.crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(hash));
    const binary = bytes.map(value => String.fromCharCode(value)).join("");
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function cleanAuthParamsFromUrl() {
    const url = new URL(window.location.href);
    const paramsToClear = ["code", "state", "error", "error_description"];
    let changed = false;

    paramsToClear.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });

    if (!changed) return;

    const query = url.searchParams.toString();
    const cleanUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash || ""}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  async function connectSpotify(customConfig) {
    const config = Object.assign({}, getConfig(), customConfig || {});

    if (!config.spotify_client_id) {
      throw createSpotifyError("CONFIG_MISSING_CLIENT_ID", "Spotify Client ID is not configured.");
    }

    if (!config.redirect_uri) {
      throw createSpotifyError("CONFIG_MISSING_REDIRECT_URI", "Spotify redirect URI is not configured.");
    }

    const codeVerifier = generateRandomString(96);
    const oauthState = generateRandomString(24);
    const codeChallenge = await sha256Base64Url(codeVerifier);

    localStorage.setItem(STORAGE_KEYS.pkceVerifier, codeVerifier);
    localStorage.setItem(STORAGE_KEYS.oauthState, oauthState);

    const authUrl = new URL(config.auth_base_url);
    authUrl.searchParams.set("client_id", config.spotify_client_id);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", config.redirect_uri);
    authUrl.searchParams.set("scope", config.required_scopes.join(" "));
    authUrl.searchParams.set("state", oauthState);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", codeChallenge);

    window.location.assign(authUrl.toString());
  }

  async function fetchSpotifyProfile(config, accessToken) {
    const response = await fetch(`${config.api_base_url}/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw createSpotifyError(
        "PROFILE_FETCH_FAILED",
        `Failed to fetch Spotify profile (${response.status}): ${text || "Unknown error"}`
      );
    }

    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : {};
  }

  async function validateOwnerAccount(customConfig, accessToken) {
    const config = Object.assign({}, getConfig(), customConfig || {});
    const profile = await fetchSpotifyProfile(config, accessToken);

    const actualUserId = String(profile.id || "").trim();
    const expectedUserId = String(config.allowed_spotify_user_id || "").trim();
    const expectedDisplay = String(config.allowed_display_name || "").trim().toLowerCase();
    const actualDisplay = String(profile.display_name || "").trim().toLowerCase();

    if (!actualUserId || !expectedUserId || actualUserId !== expectedUserId) {
      clearSpotifyAuthSession();
      throw createSpotifyError("UNAUTHORIZED_ACCOUNT", "Unauthorized account. Only owner Spotify account is allowed.");
    }

    if (expectedDisplay && actualDisplay && actualDisplay !== expectedDisplay) {
      clearSpotifyAuthSession();
      throw createSpotifyError("UNAUTHORIZED_ACCOUNT", "Unauthorized account display name.");
    }

    const currentAuth = getStoredSpotifyAuth();
    if (currentAuth) {
      currentAuth.spotify_user_id = actualUserId;
      currentAuth.spotify_display_name = String(profile.display_name || "");
      currentAuth.updated_at = new Date().toISOString();
      writeJson(STORAGE_KEYS.auth, currentAuth);
    }

    return {
      spotify_user_id: actualUserId,
      spotify_display_name: String(profile.display_name || "")
    };
  }

  async function exchangeCodeForToken(code, config) {
    const verifier = localStorage.getItem(STORAGE_KEYS.pkceVerifier);
    if (!verifier) {
      throw createSpotifyError("PKCE_VERIFIER_MISSING", "Missing PKCE code verifier.");
    }

    const payload = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code || ""),
      redirect_uri: config.redirect_uri,
      client_id: config.spotify_client_id,
      code_verifier: verifier
    });

    const response = await fetch(config.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString()
    });

    if (!response.ok) {
      const text = await response.text();
      throw createSpotifyError(
        "TOKEN_EXCHANGE_FAILED",
        `Spotify token exchange failed (${response.status}): ${text || "Unknown error"}`
      );
    }

    const tokenPayload = await response.json();
    const auth = persistSpotifyAuthFromToken(tokenPayload, getStoredSpotifyAuth() || {});
    await validateOwnerAccount(config, auth.access_token);

    localStorage.removeItem(STORAGE_KEYS.pkceVerifier);
    localStorage.removeItem(STORAGE_KEYS.oauthState);

    return auth;
  }

  async function handleAuthCallback(customConfig) {
    const config = Object.assign({}, getConfig(), customConfig || {});
    const url = new URL(window.location.href);
    const authError = url.searchParams.get("error");
    const code = url.searchParams.get("code");

    if (authError) {
      const detail = url.searchParams.get("error_description") || authError;
      cleanAuthParamsFromUrl();
      throw createSpotifyError("AUTHORIZATION_FAILED", detail);
    }

    if (!code) return false;

    const incomingState = String(url.searchParams.get("state") || "");
    const expectedState = String(localStorage.getItem(STORAGE_KEYS.oauthState) || "");
    if (!incomingState || !expectedState || incomingState !== expectedState) {
      cleanAuthParamsFromUrl();
      throw createSpotifyError("STATE_MISMATCH", "Invalid Spotify auth state.");
    }

    await exchangeCodeForToken(code, config);
    cleanAuthParamsFromUrl();
    return true;
  }

  async function refreshSpotifyToken(customConfig) {
    const config = Object.assign({}, getConfig(), customConfig || {});
    const currentAuth = getStoredSpotifyAuth();

    if (!currentAuth || !currentAuth.refresh_token) {
      throw createSpotifyError("REFRESH_TOKEN_MISSING", "No refresh token available.");
    }

    const payload = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: currentAuth.refresh_token,
      client_id: config.spotify_client_id
    });

    const response = await fetch(config.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString()
    });

    if (!response.ok) {
      clearSpotifyAuthSession();
      throw createSpotifyError("TOKEN_REFRESH_FAILED", `Token refresh failed (${response.status}).`);
    }

    const refreshedPayload = await response.json();
    const auth = persistSpotifyAuthFromToken(refreshedPayload, currentAuth);
    await validateOwnerAccount(config, auth.access_token);

    return auth;
  }

  async function restoreSpotifySession(customConfig) {
    const config = Object.assign({}, getConfig(), customConfig || {});
    const auth = getStoredSpotifyAuth();

    if (!auth || !auth.access_token) {
      return { state: "disconnected", auth: null };
    }

    if (auth.spotify_user_id && auth.spotify_user_id !== config.allowed_spotify_user_id) {
      clearSpotifyAuthSession();
      return { state: "unauthorized_account", auth: null };
    }

    if (!isTokenExpiring(auth)) {
      return { state: "connected", auth };
    }

    try {
      const refreshed = await refreshSpotifyToken(config);
      return { state: "connected", auth: refreshed };
    } catch (error) {
      const code = String(error && error.code ? error.code : "");
      if (code === "UNAUTHORIZED_ACCOUNT") {
        return { state: "unauthorized_account", auth: null, error };
      }
      return { state: "token_refresh_failed", auth: null, error };
    }
  }

  async function getAccessToken(customConfig) {
    const session = await restoreSpotifySession(customConfig);
    if (session.state !== "connected" || !session.auth || !session.auth.access_token) {
      if (session.state === "unauthorized_account") {
        throw createSpotifyError("UNAUTHORIZED_ACCOUNT", "Unauthorized account.");
      }
      if (session.state === "token_refresh_failed") {
        throw createSpotifyError("TOKEN_REFRESH_FAILED", "Token refresh failed.");
      }
      throw createSpotifyError("DISCONNECTED", "Spotify is disconnected.");
    }
    return session.auth.access_token;
  }

  async function spotifyGet(path, queryParams, customConfig) {
    const config = Object.assign({}, getConfig(), customConfig || {});
    const accessToken = await getAccessToken(config);
    const url = new URL(`${config.api_base_url}${path}`);
    const query = queryParams && typeof queryParams === "object" ? queryParams : {};

    Object.keys(query).forEach(key => {
      if (query[key] == null) return;
      url.searchParams.set(key, String(query[key]));
    });

    async function run(token) {
      return fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    let response = await run(accessToken);
    if (response.status === 401) {
      const refreshed = await refreshSpotifyToken(config);
      response = await run(refreshed.access_token);
    }

    if (response.status === 204) return null;

    if (!response.ok) {
      const text = await response.text();
      throw createSpotifyError(
        "API_REQUEST_FAILED",
        `Spotify API request failed (${response.status}): ${text || "Unknown error"}`
      );
    }

    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.includes("application/json")) return null;
    return response.json();
  }

  function normalizeTrack(track, options) {
    const source = track && typeof track === "object" ? track : {};
    const album = source.album && typeof source.album === "object" ? source.album : {};
    const images = Array.isArray(album.images) ? album.images : [];
    const artists = Array.isArray(source.artists)
      ? source.artists.map(artist => artist && artist.name ? artist.name : "").filter(Boolean)
      : [];
    const extras = options && typeof options === "object" ? options : {};

    return {
      id: source.id || "",
      title: source.name || "Unknown Track",
      artists,
      album: album.name || "Unknown Album",
      albumImage: images.length ? images[0].url : "",
      spotifyUrl: source.external_urls && source.external_urls.spotify ? source.external_urls.spotify : "",
      playedAt: extras.playedAt || "",
      isPlaying: Boolean(extras.isPlaying),
      source: extras.source || ""
    };
  }

  async function loadCurrentTrack(customConfig) {
    const payload = await spotifyGet("/me/player/currently-playing", null, customConfig);
    if (!payload || !payload.item) return null;

    const playedAt = payload.timestamp ? new Date(Number(payload.timestamp)).toISOString() : "";
    return normalizeTrack(payload.item, {
      source: "currently-playing",
      isPlaying: Boolean(payload.is_playing),
      playedAt
    });
  }

  async function loadRecentlyPlayed(customConfig) {
    const payload = await spotifyGet("/me/player/recently-played", { limit: 1 }, customConfig);
    const items = payload && Array.isArray(payload.items) ? payload.items : [];
    const item = items[0];
    if (!item || !item.track) return null;

    return normalizeTrack(item.track, {
      source: "recently-played",
      isPlaying: false,
      playedAt: item.played_at || ""
    });
  }

  async function getActivity(customConfig) {
    const currentlyPlaying = await loadCurrentTrack(customConfig).catch(() => null);
    const lastPlayed = await loadRecentlyPlayed(customConfig).catch(() => null);
    return {
      currentlyPlaying,
      lastPlayed,
      fetchedAt: new Date().toISOString()
    };
  }

  window.SpotifyAdapter = {
    getConfig,
    connectSpotify,
    disconnectSpotify: clearSpotifyAuthSession,
    getStoredSpotifyAuth,
    hasStoredSpotifyAuth,
    refreshSpotifyToken,
    validateOwnerAccount,
    restoreSpotifySession,
    loadCurrentTrack,
    loadRecentlyPlayed,
    getAccessToken,
    getActivity,
    handleAuthCallback,
    // Backward-compatible aliases
    beginAuthFlow: connectSpotify,
    disconnect: clearSpotifyAuthSession,
    hasTokenRecord: hasStoredSpotifyAuth,
    getCurrentlyPlaying: loadCurrentTrack,
    getLastPlayed: loadRecentlyPlayed
  };
})();
