(function() {
  "use strict";

  const adapter = window.SpotifyOwnerAdapter;
  if (!adapter) return;

  const STORAGE_KEYS = {
    position: "mrp_spotify_widget_position_v2",
    panelOpen: "mrp_spotify_widget_open_v2"
  };
  const STATUS_SYNC_STORAGE_KEY = adapter.statusSyncStorageKey || "mrp_spotify_status_sync_v1";
  const STATUS_SYNC_EVENT_NAME = adapter.statusSyncEventName || "mrp:spotify-status-sync";

  const SNAP_MARGIN = 16;
  const POLL_INTERVAL_MS = 20 * 1000;

  const ui = {
    root: null,
    bubble: null,
    label: null,
    panel: null,
    closeBtn: null,
    status: null,
    connectBtn: null,
    refreshBtn: null,
    disconnectBtn: null,
    currentTrack: null,
    recentTrack: null
  };

  const state = {
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    position: { x: 0, y: 0 },
    panelOpen: false,
    pollTimer: null,
    loading: false,
    lastStatus: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function maxPositionX() {
    if (!ui.root) return window.innerWidth - SNAP_MARGIN;
    return Math.max(SNAP_MARGIN, window.innerWidth - ui.root.offsetWidth - SNAP_MARGIN);
  }

  function maxPositionY() {
    if (!ui.root) return window.innerHeight - SNAP_MARGIN;
    return Math.max(SNAP_MARGIN, window.innerHeight - ui.root.offsetHeight - SNAP_MARGIN);
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function resolveInitialPosition() {
    const saved = readJson(STORAGE_KEYS.position);
    const fallback = {
      x: Math.max(SNAP_MARGIN, window.innerWidth - 96),
      y: Math.max(SNAP_MARGIN, window.innerHeight - 220)
    };

    if (!saved || typeof saved !== "object") return fallback;
    return {
      x: clamp(Number(saved.x) || fallback.x, SNAP_MARGIN, Math.max(SNAP_MARGIN, window.innerWidth - SNAP_MARGIN)),
      y: clamp(Number(saved.y) || fallback.y, SNAP_MARGIN, Math.max(SNAP_MARGIN, window.innerHeight - SNAP_MARGIN))
    };
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

    if (persist) {
      writeJson(STORAGE_KEYS.position, state.position);
    }
  }

  function setPanelState(open, persist) {
    state.panelOpen = Boolean(open);
    if (ui.root) {
      ui.root.classList.toggle("panel-open", state.panelOpen);
    }
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS.panelOpen, state.panelOpen ? "1" : "0");
      } catch {
        // ignore
      }
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "time unavailable";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(dt);
  }

  function renderTrack(target, title, track, timeLabel) {
    if (!target) return;

    if (!track) {
      target.innerHTML = [
        `<h4>${escapeHtml(title)}</h4>`,
        `<p>No ${escapeHtml(timeLabel)} track available.</p>`
      ].join("");
      return;
    }

    const artists = Array.isArray(track.artists) ? track.artists.join(", ") : "Unknown Artist";
    const cover = track.albumImage || "assets/img/portfolio/app-1.jpg";
    const spotifyUrl = track.spotifyUrl || "#";

    target.innerHTML = [
      '<div class="spotify-mini-track">',
      `  <img src="${escapeHtml(cover)}" alt="${escapeHtml(track.title || "Track")} cover">`,
      '  <div class="spotify-mini-track-meta">',
      `    <h4>${escapeHtml(title)}</h4>`,
      `    <div class="spotify-mini-track-title">${escapeHtml(track.title || "Unknown Track")}</div>`,
      `    <div class="spotify-mini-track-artist">${escapeHtml(artists)}</div>`,
      `    <div class="spotify-mini-track-time">${escapeHtml(timeLabel)}: ${escapeHtml(formatDateTime(track.playedAt))}</div>`,
      `    <a href="${escapeHtml(spotifyUrl)}" target="_blank" rel="noopener noreferrer">Open in Spotify</a>`,
      "  </div>",
      "</div>"
    ].join("\n");
  }

  function setStatusMessage(message, type) {
    if (!ui.status) return;
    ui.status.textContent = message || "";
    ui.status.classList.remove("is-success", "is-error");
    if (type === "success") {
      ui.status.classList.add("is-success");
    } else if (type === "error") {
      ui.status.classList.add("is-error");
    }
  }

  function updateBubbleLabel(status) {
    if (!ui.label) return;

    if (status && status.connected && status.currentlyPlaying) {
      const current = status.currentlyPlaying;
      const firstArtist = Array.isArray(current.artists) ? current.artists[0] : "";
      ui.label.textContent = `${current.title || "Track"} - ${firstArtist || "Artist"}`;
      return;
    }

    if (status && status.connected && status.recentlyPlayed) {
      const recent = status.recentlyPlayed;
      const firstArtist = Array.isArray(recent.artists) ? recent.artists[0] : "";
      ui.label.textContent = `Last: ${recent.title || "Track"} - ${firstArtist || "Artist"}`;
      return;
    }

    ui.label.textContent = "Spotify Activity";
  }

  function syncButtons(status) {
    const data = status || state.lastStatus || {};
    const canManage = Boolean(data.canManage);
    const connected = Boolean(data.connected);

    if (ui.connectBtn) {
      ui.connectBtn.hidden = !canManage;
      ui.connectBtn.textContent = connected ? "Reconnect" : "Connect";
      ui.connectBtn.disabled = state.loading;
    }

    if (ui.disconnectBtn) {
      ui.disconnectBtn.hidden = !canManage || !connected;
      ui.disconnectBtn.disabled = state.loading;
    }

    if (ui.refreshBtn) {
      ui.refreshBtn.disabled = state.loading;
    }
  }

  function renderDisconnected(status) {
    renderTrack(ui.currentTrack, "Currently Playing", null, "playing");
    renderTrack(ui.recentTrack, "Recently Played", null, "played");

    if (status && status.configured === false) {
      setStatusMessage("Spotify is not configured on backend.", "error");
    } else if (status && status.error) {
      setStatusMessage(String(status.error), "error");
    } else {
      setStatusMessage("Spotify account is not connected.", "");
    }

    updateBubbleLabel(status);
  }

  function renderConnected(status) {
    renderTrack(ui.currentTrack, "Currently Playing", status.currentlyPlaying, "playing");
    renderTrack(ui.recentTrack, "Recently Played", status.recentlyPlayed, "played");

    const ownerName = status.owner && status.owner.spotifyDisplayName
      ? status.owner.spotifyDisplayName
      : (status.owner && status.owner.spotifyUserId ? status.owner.spotifyUserId : "owner");

    if (status.currentlyPlaying) {
      setStatusMessage(`Connected as ${ownerName}. Live playback is active.`, "success");
    } else if (status.recentlyPlayed) {
      setStatusMessage(`Connected as ${ownerName}. Showing recent playback.`, "success");
    } else {
      setStatusMessage(`Connected as ${ownerName}. No playback data yet.`, "success");
    }

    updateBubbleLabel(status);
  }

  async function refreshStatus(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (state.loading) return;

    state.loading = true;
    syncButtons();

    try {
      const status = await adapter.fetchStatus({ refresh: Boolean(opts.forceRefresh) });
      state.lastStatus = status;

      if (!status.connected) {
        renderDisconnected(status);
      } else {
        renderConnected(status);
      }
    } catch (error) {
      renderDisconnected({ configured: true, connected: false, error: error && error.message ? error.message : "Failed to load Spotify status." });
    } finally {
      state.loading = false;
      syncButtons();
    }
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
      } catch {
        // ignore
      }

      if (state.moved) {
        const snapX = state.position.x < (window.innerWidth / 2)
          ? SNAP_MARGIN
          : maxPositionX();
        applyPosition(snapX, state.position.y, true);
        return;
      }

      setPanelState(!state.panelOpen, true);
    });
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
        <p id="spotify-floating-status" class="spotify-floating-status">Loading Spotify status...</p>
        <div class="spotify-floating-actions">
          <button type="button" id="spotify-widget-connect" class="btn btn-primary btn-sm">Connect</button>
          <button type="button" id="spotify-widget-refresh" class="btn btn-outline-primary btn-sm">Refresh</button>
          <button type="button" id="spotify-widget-disconnect" class="btn btn-outline-secondary btn-sm" hidden>Disconnect</button>
        </div>
        <div class="spotify-floating-track-card" id="spotify-widget-current-track"></div>
        <div class="spotify-floating-track-card" id="spotify-widget-recent-track"></div>
      </div>
    `;

    document.body.appendChild(root);
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
    ui.recentTrack = byId("spotify-widget-recent-track");
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
        refreshStatus({ forceRefresh: true });
      });
    }

    if (ui.connectBtn) {
      ui.connectBtn.addEventListener("click", function() {
        adapter.connectSpotify("/admin.html#module-spotify");
      });
    }

    if (ui.disconnectBtn) {
      ui.disconnectBtn.addEventListener("click", async function() {
        try {
          state.loading = true;
          syncButtons();
          await adapter.disconnectSpotify();
          await refreshStatus({ forceRefresh: false });
        } catch (error) {
          setStatusMessage(error && error.message ? error.message : "Failed to disconnect Spotify.", "error");
        } finally {
          state.loading = false;
          syncButtons();
        }
      });
    }

    window.addEventListener("resize", function() {
      applyPosition(state.position.x, state.position.y, true);
    });

    window.addEventListener("focus", function() {
      refreshStatus({ forceRefresh: false });
    });

    document.addEventListener("visibilitychange", function() {
      if (document.hidden) return;
      refreshStatus({ forceRefresh: false });
    });

    window.addEventListener("storage", function(event) {
      if (!event || event.key !== STATUS_SYNC_STORAGE_KEY) return;
      refreshStatus({ forceRefresh: false });
    });

    window.addEventListener(STATUS_SYNC_EVENT_NAME, function() {
      refreshStatus({ forceRefresh: false });
    });
  }

  function startPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
    }

    state.pollTimer = window.setInterval(function() {
      if (document.hidden) return;
      refreshStatus({ forceRefresh: false });
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

    renderDisconnected({ configured: true, connected: false, error: "Loading Spotify status..." });
    syncButtons();

    const feedback = adapter.parseAuthFeedbackFromUrl();
    if (feedback.spotify === "connected") {
      setStatusMessage("Spotify account connected successfully.", "success");
      adapter.clearAuthFeedbackInUrl();
    } else if (feedback.spotifyError) {
      setStatusMessage(feedback.spotifyError, "error");
      adapter.clearAuthFeedbackInUrl();
    }

    await refreshStatus({ forceRefresh: false });
    startPolling();
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
