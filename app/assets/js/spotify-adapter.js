(function() {
  "use strict";

  const STATUS_SYNC_STORAGE_KEY = "mrp_spotify_status_sync_v1";
  const STATUS_SYNC_EVENT_NAME = "mrp:spotify-status-sync";

  let cachedStatus = {
    ok: true,
    configured: false,
    connected: false,
    canManage: false,
    owner: null,
    currentlyPlaying: null,
    recentlyPlayed: null,
    fetchedAt: ""
  };

  function statusSignature(status) {
    const source = status && typeof status === "object" ? status : {};
    const owner = source.owner && typeof source.owner === "object" ? source.owner : {};
    const current = source.currentlyPlaying && typeof source.currentlyPlaying === "object"
      ? source.currentlyPlaying
      : {};
    const recent = source.recentlyPlayed && typeof source.recentlyPlayed === "object"
      ? source.recentlyPlayed
      : {};
    return JSON.stringify({
      configured: Boolean(source.configured),
      connected: Boolean(source.connected),
      ownerUserId: String(owner.spotifyUserId || ""),
      currentTrackId: String(current.id || ""),
      currentPlayedAt: String(current.playedAt || ""),
      recentTrackId: String(recent.id || ""),
      recentPlayedAt: String(recent.playedAt || "")
    });
  }

  function publishStatusSync(reason, status) {
    const payload = {
      reason: String(reason || "status"),
      at: new Date().toISOString(),
      signature: statusSignature(status || cachedStatus)
    };

    try {
      localStorage.setItem(STATUS_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }

    try {
      window.dispatchEvent(new CustomEvent(STATUS_SYNC_EVENT_NAME, { detail: payload }));
    } catch {
      // ignore
    }
  }

  function createSpotifyError(code, message, status) {
    const error = new Error(message);
    error.code = code;
    if (status) error.status = status;
    return error;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : `Spotify request failed (${response.status})`;
      throw createSpotifyError("REQUEST_FAILED", message, response.status);
    }

    return payload || {};
  }

  function normalizeStatus(payload) {
    const previousSignature = statusSignature(cachedStatus);
    const source = payload && typeof payload === "object" ? payload : {};
    const normalized = {
      ok: source.ok !== false,
      configured: Boolean(source.configured),
      connected: Boolean(source.connected),
      canManage: Boolean(source.canManage),
      owner: source.owner && typeof source.owner === "object" ? source.owner : null,
      currentlyPlaying: source.currentlyPlaying && typeof source.currentlyPlaying === "object"
        ? source.currentlyPlaying
        : null,
      recentlyPlayed: source.recentlyPlayed && typeof source.recentlyPlayed === "object"
        ? source.recentlyPlayed
        : null,
      redirectUri: source.redirectUri || "",
      redirectAllowList: Array.isArray(source.redirectAllowList) ? source.redirectAllowList : [],
      tokenExpiresAt: source.tokenExpiresAt || "",
      fetchedAt: source.fetchedAt || new Date().toISOString(),
      error: source.error || ""
    };
    cachedStatus = normalized;
    if (statusSignature(normalized) !== previousSignature) {
      publishStatusSync("status-change", normalized);
    }
    return normalized;
  }

  async function fetchStatus(options) {
    const opts = options && typeof options === "object" ? options : {};
    const forceRefresh = Boolean(opts.refresh);
    const url = forceRefresh ? "/api/spotify/status?refresh=1" : "/api/spotify/status";
    const payload = await requestJson(url, { method: "GET" });
    return normalizeStatus(payload);
  }

  function getStoredSpotifyAuth() {
    if (!cachedStatus || !cachedStatus.connected || !cachedStatus.owner) return null;
    return {
      spotify_user_id: String(cachedStatus.owner.spotifyUserId || ""),
      spotify_display_name: String(cachedStatus.owner.spotifyDisplayName || ""),
      spotify_email: String(cachedStatus.owner.spotifyEmail || "")
    };
  }

  function hasStoredSpotifyAuth() {
    return Boolean(cachedStatus && cachedStatus.connected);
  }

  function getConfig() {
    return {
      backend_managed: true,
      redirect_uri: cachedStatus && cachedStatus.redirectUri ? cachedStatus.redirectUri : ""
    };
  }

  function connectSpotify(nextPath) {
    const next = typeof nextPath === "string" && nextPath.trim()
      ? nextPath.trim()
      : "/admin.html#module-spotify";
    const target = `/api/spotify/login?next=${encodeURIComponent(next)}`;
    window.location.assign(target);
  }

  async function disconnectSpotify() {
    await requestJson("/api/spotify/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" }
    });
    cachedStatus = {
      ok: true,
      configured: cachedStatus.configured,
      connected: false,
      canManage: cachedStatus.canManage,
      owner: null,
      currentlyPlaying: null,
      recentlyPlayed: null,
      redirectUri: cachedStatus.redirectUri,
      redirectAllowList: cachedStatus.redirectAllowList,
      tokenExpiresAt: "",
      fetchedAt: new Date().toISOString(),
      error: ""
    };
    publishStatusSync("disconnect", cachedStatus);
    return cachedStatus;
  }

  async function refreshSpotifyToken() {
    const payload = await requestJson("/api/spotify/refresh", { method: "GET" });
    return normalizeStatus(payload);
  }

  async function restoreSpotifySession() {
    try {
      const status = await fetchStatus({ refresh: false });
      if (!status.configured) {
        return {
          state: "not_configured",
          auth: null,
          status
        };
      }

      if (!status.connected) {
        return {
          state: "disconnected",
          auth: null,
          status
        };
      }

      return {
        state: "connected",
        auth: getStoredSpotifyAuth(),
        status
      };
    } catch (error) {
      return {
        state: "error",
        auth: null,
        error,
        status: cachedStatus
      };
    }
  }

  async function getActivity(options) {
    const status = await fetchStatus(options);
    if (!status.configured) {
      throw createSpotifyError("NOT_CONFIGURED", status.error || "Spotify backend is not configured.");
    }
    if (!status.connected) {
      throw createSpotifyError("DISCONNECTED", status.error || "Spotify is not connected.");
    }

    return {
      owner: status.owner,
      currentlyPlaying: status.currentlyPlaying,
      lastPlayed: status.recentlyPlayed,
      fetchedAt: status.fetchedAt
    };
  }

  function parseAuthFeedbackFromUrl() {
    const url = new URL(window.location.href);
    const spotify = url.searchParams.get("spotify") || "";
    const spotifyError = url.searchParams.get("spotify_error") || "";
    return {
      spotify,
      spotifyError
    };
  }

  function clearAuthFeedbackInUrl() {
    const url = new URL(window.location.href);
    let changed = false;
    ["spotify", "spotify_error"].forEach((key) => {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    });
    if (!changed) return;

    const query = url.searchParams.toString();
    const cleanUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash || ""}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  window.SpotifyOwnerAdapter = {
    connectSpotify,
    disconnectSpotify,
    fetchStatus,
    getActivity,
    getConfig,
    getStoredSpotifyAuth,
    handleAuthCallback: async function() {
      return false;
    },
    hasStoredSpotifyAuth,
    parseAuthFeedbackFromUrl,
    clearAuthFeedbackInUrl,
    refreshSpotifyToken,
    restoreSpotifySession,
    statusSyncStorageKey: STATUS_SYNC_STORAGE_KEY,
    statusSyncEventName: STATUS_SYNC_EVENT_NAME
  };
})();
