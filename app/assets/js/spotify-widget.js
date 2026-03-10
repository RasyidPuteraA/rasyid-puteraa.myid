(function() {
  "use strict";

  const body = document.body;
  if (!body || body.classList.contains("admin-page")) return;

  const adapter = window.SpotifyAdapter;
  if (!adapter) return;

  const STORAGE_KEYS = {
    position: "mrp_spotify_widget_position_v1",
    panelOpen: "mrp_spotify_widget_open_v1",
    cache: "mrp_spotify_widget_cache_v1"
  };

  const UI_STATES = {
    disconnected: "disconnected",
    connecting: "connecting",
    connected: "connected",
    unauthorized: "unauthorized_account",
    noCurrentTrack: "no_current_track",
    refreshFailed: "token_refresh_failed",
    error: "error"
  };

  const POLL_INTERVAL_MS = 20000;
  const SNAP_MARGIN = 12;
  const BUBBLE_SIZE = 62;

  const state = {
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    position: { x: 0, y: 0 },
    panelOpen: false,
    refreshInFlight: false,
    pollTimer: null,
    uiState: UI_STATES.disconnected
  };

  const ui = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function maxPositionX() {
    return Math.max(SNAP_MARGIN, window.innerWidth - BUBBLE_SIZE - SNAP_MARGIN);
  }

  function maxPositionY() {
    return Math.max(SNAP_MARGIN, window.innerHeight - BUBBLE_SIZE - SNAP_MARGIN);
  }

  function defaultPosition() {
    return {
      x: maxPositionX(),
      y: clamp(window.innerHeight - 160, SNAP_MARGIN, maxPositionY())
    };
  }

  function resolveInitialPosition() {
    const saved = readJson(STORAGE_KEYS.position);
    if (!saved || typeof saved !== "object") return defaultPosition();
    return {
      x: clamp(Number(saved.x) || defaultPosition().x, SNAP_MARGIN, maxPositionX()),
      y: clamp(Number(saved.y) || defaultPosition().y, SNAP_MARGIN, maxPositionY())
    };
  }

  function savePosition() {
    writeJson(STORAGE_KEYS.position, state.position);
  }

  function applyPosition(x, y, persist) {
    state.position.x = clamp(Number(x) || 0, SNAP_MARGIN, maxPositionX());
    state.position.y = clamp(Number(y) || 0, SNAP_MARGIN, maxPositionY());

    if (ui.root) {
      ui.root.style.left = `${Math.round(state.position.x)}px`;
      ui.root.style.top = `${Math.round(state.position.y)}px`;
      ui.root.classList.toggle("side-left", state.position.x < (window.innerWidth / 2));
      ui.root.classList.toggle("side-right", state.position.x >= (window.innerWidth / 2));
    }

    if (persist) savePosition();
  }

  function snapToNearestSide() {
    const snapX = state.position.x < (window.innerWidth / 2)
      ? SNAP_MARGIN
      : maxPositionX();
    applyPosition(snapX, state.position.y, true);
  }

  function setPanelState(open, persist) {
    state.panelOpen = Boolean(open);
    if (ui.root) ui.root.classList.toggle("panel-open", state.panelOpen);
    if (persist) localStorage.setItem(STORAGE_KEYS.panelOpen, state.panelOpen ? "1" : "0");
  }

  function formatDateTime(value) {
    if (!value) return "Time unavailable";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(dt);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setUiState(nextState, message) {
    state.uiState = nextState || UI_STATES.error;
    if (!ui.root || !ui.status) return;

    ui.root.setAttribute("data-spotify-state", state.uiState);
    ui.status.textContent = message || "";
    ui.status.classList.remove("is-error", "is-success");

    if (state.uiState === UI_STATES.connected || state.uiState === UI_STATES.noCurrentTrack) {
      ui.status.classList.add("is-success");
      return;
    }

    if (state.uiState === UI_STATES.disconnected || state.uiState === UI_STATES.connecting) {
      return;
    }

    ui.status.classList.add("is-error");
  }

  function renderEmptyTrack(target, title, description) {
    if (!target) return;
    target.innerHTML = [
      `<h4>${escapeHtml(title)}</h4>`,
      `<p>${escapeHtml(description)}</p>`
    ].join("");
  }

  function renderTrack(target, title, track, modeLabel) {
    if (!target) return;
    if (!track) {
      renderEmptyTrack(target, title, `No ${modeLabel} track available.`);
      return;
    }

    const artists = Array.isArray(track.artists) ? track.artists.join(", ") : "Unknown Artist";
    const cover = track.albumImage || "assets/img/portfolio/app-1.jpg";
    const spotifyUrl = track.spotifyUrl || "#";
    const playedAt = track.playedAt ? formatDateTime(track.playedAt) : "Time unavailable";

    target.innerHTML = [
      '<div class="spotify-mini-track">',
      `  <img src="${escapeHtml(cover)}" alt="${escapeHtml(track.title || "Track")} cover">`,
      '  <div class="spotify-mini-track-meta">',
      `    <h4>${escapeHtml(title)}</h4>`,
      `    <div class="spotify-mini-track-title">${escapeHtml(track.title || "Unknown Track")}</div>`,
      `    <div class="spotify-mini-track-artist">${escapeHtml(artists)}</div>`,
      `    <div class="spotify-mini-track-time">${escapeHtml(modeLabel)}: ${escapeHtml(playedAt)}</div>`,
      `    <a href="${escapeHtml(spotifyUrl)}" target="_blank" rel="noopener noreferrer">Open in Spotify</a>`,
      "  </div>",
      "</div>"
    ].join("\n");
  }

  function updateBubbleLabel(activity) {
    if (!ui.label) return;
    const current = activity && activity.currentlyPlaying;
    const last = activity && activity.lastPlayed;

    if (current) {
      const artist = Array.isArray(current.artists) ? current.artists[0] : "";
      ui.label.textContent = `${current.title || "Track"} - ${artist || "Artist"}`;
      return;
    }

    if (last) {
      const artist = Array.isArray(last.artists) ? last.artists[0] : "";
      ui.label.textContent = `Last: ${last.title || "Track"} - ${artist || "Artist"}`;
      return;
    }

    if (state.uiState === UI_STATES.unauthorized) {
      ui.label.textContent = "Unauthorized Spotify Account";
      return;
    }

    ui.label.textContent = "Spotify Activity";
  }

  function loadCachedActivity() {
    const cache = readJson(STORAGE_KEYS.cache);
    return cache && typeof cache === "object" ? cache : null;
  }

  function saveCachedActivity(activity) {
    writeJson(STORAGE_KEYS.cache, activity || {});
  }

  function clearCachedActivity() {
    localStorage.removeItem(STORAGE_KEYS.cache);
  }

  function syncButtons() {
    const storedAuth = adapter.getStoredSpotifyAuth();
    const connected = Boolean(storedAuth && storedAuth.access_token);

    if (ui.connectBtn) {
      ui.connectBtn.textContent = connected ? "Reconnect" : "Connect";
      ui.connectBtn.disabled = state.uiState === UI_STATES.connecting;
    }

    if (ui.disconnectBtn) {
      ui.disconnectBtn.hidden = !connected;
    }

    if (ui.refreshBtn) {
      ui.refreshBtn.disabled = !connected || state.uiState === UI_STATES.connecting;
    }
  }

  function renderFromActivity(activity) {
    renderTrack(ui.currentTrack, "Currently Playing", activity && activity.currentlyPlaying, "Playing");
    renderTrack(ui.lastTrack, "Last Played", activity && activity.lastPlayed, "Played");
    updateBubbleLabel(activity);
  }

  function renderDisconnectedView() {
    renderEmptyTrack(ui.currentTrack, "Currently Playing", "Spotify is disconnected.");
    renderEmptyTrack(ui.lastTrack, "Last Played", "Connect Spotify to load owner activity.");
    updateBubbleLabel(null);
  }

  function renderUnauthorizedView() {
    renderEmptyTrack(ui.currentTrack, "Currently Playing", "Unauthorized account.");
    renderEmptyTrack(ui.lastTrack, "Last Played", "Only owner Spotify account is allowed.");
    updateBubbleLabel(null);
  }

  function parseErrorCode(error) {
    return String(error && error.code ? error.code : "").trim();
  }

  async function refreshActivity(options) {
    if (state.refreshInFlight) return;

    const opts = options && typeof options === "object" ? options : {};
    const storedAuth = adapter.getStoredSpotifyAuth();
    if (!storedAuth || !storedAuth.access_token) {
      setUiState(UI_STATES.disconnected, "Disconnected. Click Connect to authorize Spotify.");
      renderDisconnectedView();
      syncButtons();
      return;
    }

    state.refreshInFlight = true;
    if (!opts.silent) {
      setUiState(UI_STATES.connecting, "Loading Spotify owner activity...");
    }

    try {
      const activity = await adapter.getActivity();
      saveCachedActivity(activity);
      renderFromActivity(activity);

      if (activity.currentlyPlaying) {
        setUiState(UI_STATES.connected, "Connected. Showing currently playing track.");
      } else if (activity.lastPlayed) {
        setUiState(UI_STATES.noCurrentTrack, "No current track. Showing last played.");
      } else {
        setUiState(UI_STATES.noCurrentTrack, "Connected. No track activity available yet.");
      }
    } catch (error) {
      const code = parseErrorCode(error);
      const cached = loadCachedActivity();

      if (code === "UNAUTHORIZED_ACCOUNT") {
        clearCachedActivity();
        setUiState(UI_STATES.unauthorized, "Unauthorized account. Only owner Spotify account is accepted.");
        renderUnauthorizedView();
      } else if (code === "TOKEN_REFRESH_FAILED") {
        setUiState(UI_STATES.refreshFailed, "Token refresh failed. Please reconnect Spotify.");
        if (cached) {
          renderFromActivity(cached);
        } else {
          renderDisconnectedView();
        }
      } else if (code === "DISCONNECTED") {
        setUiState(UI_STATES.disconnected, "Disconnected. Please connect Spotify again.");
        renderDisconnectedView();
      } else {
        setUiState(UI_STATES.error, "Failed to load Spotify activity.");
        if (cached) {
          renderFromActivity(cached);
        } else {
          renderDisconnectedView();
        }
      }
    } finally {
      state.refreshInFlight = false;
      syncButtons();
    }
  }

  function buildMarkup() {
    const root = document.createElement("div");
    root.id = "spotify-floating-root";
    root.className = "spotify-floating-root";
    root.innerHTML = `
      <button type="button" id="spotify-floating-bubble" class="spotify-floating-bubble" aria-label="Spotify Activity">
        <i class="bi bi-spotify"></i>
      </button>
      <div id="spotify-floating-label" class="spotify-floating-label">Spotify Activity</div>
      <div id="spotify-floating-panel" class="spotify-floating-panel">
        <div class="spotify-floating-panel-header">
          <h3>Spotify Activity</h3>
          <button type="button" id="spotify-floating-close" class="spotify-floating-close" aria-label="Close panel">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <p id="spotify-floating-status" class="spotify-floating-status">Disconnected.</p>
        <div class="spotify-floating-actions">
          <button type="button" id="spotify-widget-connect" class="btn btn-primary btn-sm">Connect</button>
          <button type="button" id="spotify-widget-refresh" class="btn btn-outline-primary btn-sm">Refresh</button>
          <button type="button" id="spotify-widget-disconnect" class="btn btn-outline-secondary btn-sm" hidden>Disconnect</button>
        </div>
        <div class="spotify-floating-track-card" id="spotify-widget-current-track"></div>
        <div class="spotify-floating-track-card" id="spotify-widget-last-track"></div>
      </div>
    `;

    document.body.appendChild(root);
  }

  function bindDrag() {
    if (!ui.bubble) return;

    ui.bubble.addEventListener("pointerdown", function(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      state.dragging = true;
      state.moved = false;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.originX = state.position.x;
      state.originY = state.position.y;

      ui.root.classList.add("is-dragging");
      ui.bubble.setPointerCapture(event.pointerId);
    });

    ui.bubble.addEventListener("pointermove", function(event) {
      if (!state.dragging) return;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        state.moved = true;
      }

      applyPosition(state.originX + deltaX, state.originY + deltaY, false);
    });

    ui.bubble.addEventListener("pointerup", function(event) {
      if (!state.dragging) return;

      state.dragging = false;
      ui.root.classList.remove("is-dragging");
      try {
        ui.bubble.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }

      if (state.moved) {
        snapToNearestSide();
        return;
      }

      setPanelState(!state.panelOpen, true);
    });

    ui.bubble.addEventListener("pointercancel", function(event) {
      if (!state.dragging) return;
      state.dragging = false;
      ui.root.classList.remove("is-dragging");
      try {
        ui.bubble.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
      snapToNearestSide();
    });

    ui.bubble.addEventListener("click", function(event) {
      event.preventDefault();
    });
  }

  function bindActions() {
    if (ui.closeBtn) {
      ui.closeBtn.addEventListener("click", function() {
        setPanelState(false, true);
      });
    }

    if (ui.label) {
      ui.label.addEventListener("click", function() {
        setPanelState(!state.panelOpen, true);
      });
    }

    if (ui.refreshBtn) {
      ui.refreshBtn.addEventListener("click", function() {
        refreshActivity({ silent: false });
      });
    }

    if (ui.connectBtn) {
      ui.connectBtn.addEventListener("click", async function() {
        try {
          const config = adapter.getConfig();
          if (!config.spotify_client_id) {
            setUiState(UI_STATES.error, "Spotify Client ID is not set in owner config.");
            return;
          }

          setUiState(UI_STATES.connecting, "Connecting to Spotify...");
          await adapter.connectSpotify();
        } catch (error) {
          const code = parseErrorCode(error);
          if (code === "UNAUTHORIZED_ACCOUNT") {
            setUiState(UI_STATES.unauthorized, "Unauthorized account.");
            renderUnauthorizedView();
          } else {
            setUiState(UI_STATES.error, error && error.message ? error.message : "Failed to connect Spotify.");
          }
          syncButtons();
        }
      });
    }

    if (ui.disconnectBtn) {
      ui.disconnectBtn.addEventListener("click", function() {
        adapter.disconnectSpotify();
        clearCachedActivity();
        renderDisconnectedView();
        setUiState(UI_STATES.disconnected, "Disconnected from Spotify.");
        syncButtons();
      });
    }

    window.addEventListener("resize", function() {
      applyPosition(state.position.x, state.position.y, true);
    });
  }

  function cacheUiReferences() {
    ui.root = byId("spotify-floating-root");
    ui.bubble = byId("spotify-floating-bubble");
    ui.label = byId("spotify-floating-label");
    ui.panel = byId("spotify-floating-panel");
    ui.closeBtn = byId("spotify-floating-close");
    ui.status = byId("spotify-floating-status");
    ui.connectBtn = byId("spotify-widget-connect");
    ui.refreshBtn = byId("spotify-widget-refresh");
    ui.disconnectBtn = byId("spotify-widget-disconnect");
    ui.currentTrack = byId("spotify-widget-current-track");
    ui.lastTrack = byId("spotify-widget-last-track");
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);

    state.pollTimer = window.setInterval(function() {
      if (document.hidden) return;
      if (!adapter.hasStoredSpotifyAuth()) return;
      refreshActivity({ silent: true });
    }, POLL_INTERVAL_MS);
  }

  async function bootstrap() {
    buildMarkup();
    cacheUiReferences();

    const initialPos = resolveInitialPosition();
    applyPosition(initialPos.x, initialPos.y, false);

    const persistedOpen = localStorage.getItem(STORAGE_KEYS.panelOpen) === "1";
    setPanelState(persistedOpen, false);

    bindDrag();
    bindActions();
    syncButtons();

    const cached = loadCachedActivity();
    if (cached) {
      renderFromActivity(cached);
    } else {
      renderDisconnectedView();
    }

    try {
      const callbackHandled = await adapter.handleAuthCallback();
      if (callbackHandled) {
        setPanelState(true, true);
        setUiState(UI_STATES.connecting, "Authorization completed. Restoring session...");
      }
    } catch (error) {
      const code = parseErrorCode(error);
      if (code === "UNAUTHORIZED_ACCOUNT") {
        setUiState(UI_STATES.unauthorized, "Unauthorized account. Only owner account allowed.");
        renderUnauthorizedView();
      } else {
        setUiState(UI_STATES.error, error && error.message ? error.message : "Authorization failed.");
      }
    }

    const session = await adapter.restoreSpotifySession();
    if (session.state === "connected") {
      setUiState(UI_STATES.connected, "Session restored. Loading owner activity...");
      await refreshActivity({ silent: false });
    } else if (session.state === "unauthorized_account") {
      setUiState(UI_STATES.unauthorized, "Unauthorized account. Only owner account allowed.");
      renderUnauthorizedView();
    } else if (session.state === "token_refresh_failed") {
      setUiState(UI_STATES.refreshFailed, "Token refresh failed. Please connect again.");
      await refreshActivity({ silent: true });
    } else {
      setUiState(UI_STATES.disconnected, "Disconnected. Click Connect to authorize Spotify.");
      renderDisconnectedView();
    }

    syncButtons();
    startPolling();
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
