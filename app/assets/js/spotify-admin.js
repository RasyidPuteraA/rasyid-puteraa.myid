(function() {
  "use strict";

  const dashboardPage = document.body && document.body.dataset.adminPage === "dashboard";
  if (!dashboardPage) return;

  const adapter = window.SpotifyOwnerAdapter;
  if (!adapter || typeof adapter.fetchStatus !== "function") return;

  const state = {
    busy: false,
    status: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = byId(id);
    if (!element) return;
    element.textContent = value == null || value === "" ? "-" : String(value);
  }

  function setStatus(message, type) {
    const element = byId("spotify-admin-status");
    if (!element) return;
    element.className = "alert py-2 px-3 mb-3 admin-module-status";
    if (type === "error") {
      element.classList.add("alert-danger");
    } else if (type === "success") {
      element.classList.add("alert-success");
    } else {
      element.classList.add("alert-secondary");
    }
    element.textContent = message || "";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function formatTrack(track) {
    if (!track || typeof track !== "object") return "-";
    const title = String(track.title || "Unknown Track");
    const artists = Array.isArray(track.artists) && track.artists.length
      ? track.artists.join(", ")
      : "Unknown Artist";
    const playedAt = formatDateTime(track.playedAt);
    return `${title} - ${artists} (${playedAt})`;
  }

  function renderAllowList(items) {
    const list = byId("spotify-admin-allow-list");
    if (!list) return;
    list.innerHTML = "";

    const values = Array.isArray(items) ? items : [];
    if (!values.length) {
      const item = document.createElement("li");
      item.textContent = "-";
      list.appendChild(item);
      return;
    }

    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = String(value || "");
      list.appendChild(item);
    });
  }

  function syncButtons() {
    const connectBtn = byId("spotify-admin-connect-btn");
    const refreshBtn = byId("spotify-admin-refresh-btn");
    const disconnectBtn = byId("spotify-admin-disconnect-btn");
    const status = state.status || {};
    const connected = Boolean(status.connected);

    if (connectBtn) {
      connectBtn.disabled = state.busy;
      connectBtn.textContent = connected ? "Reconnect" : "Connect";
    }
    if (refreshBtn) {
      refreshBtn.disabled = state.busy;
    }
    if (disconnectBtn) {
      disconnectBtn.disabled = state.busy || !connected;
    }
  }

  function renderStatus(status) {
    state.status = status || {};
    const payload = state.status;
    const owner = payload.owner && typeof payload.owner === "object" ? payload.owner : {};

    setText("spotify-admin-configured", payload.configured ? "Yes" : "No");
    setText("spotify-admin-connected", payload.connected ? "Yes" : "No");
    setText("spotify-admin-owner", owner.spotifyDisplayName || owner.spotifyUserId || "-");
    setText("spotify-admin-token-expiry", formatDateTime(payload.tokenExpiresAt));
    setText("spotify-admin-current-track", formatTrack(payload.currentlyPlaying));
    setText("spotify-admin-recent-track", formatTrack(payload.recentlyPlayed));
    setText("spotify-admin-redirect-uri", payload.redirectUri || "-");
    renderAllowList(payload.redirectAllowList);

    if (!payload.configured) {
      setStatus(payload.error || "Spotify backend belum dikonfigurasi di environment.", "error");
    } else if (!payload.connected) {
      setStatus(payload.error || "Spotify belum terhubung. Klik Connect untuk mulai OAuth.", "info");
    } else {
      setStatus("Spotify terhubung dan siap dipakai.", "success");
    }

    syncButtons();
  }

  async function loadStatus(options) {
    state.busy = true;
    syncButtons();
    try {
      const payload = await adapter.fetchStatus({
        refresh: Boolean(options && options.forceRefresh)
      });
      renderStatus(payload);
    } catch (error) {
      setStatus(error && error.message ? error.message : "Gagal mengambil status Spotify.", "error");
    } finally {
      state.busy = false;
      syncButtons();
    }
  }

  function bindActions() {
    const connectBtn = byId("spotify-admin-connect-btn");
    if (connectBtn) {
      connectBtn.addEventListener("click", function() {
        adapter.connectSpotify("/admin.html#module-spotify");
      });
    }

    const refreshBtn = byId("spotify-admin-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function() {
        loadStatus({ forceRefresh: true });
      });
    }

    const disconnectBtn = byId("spotify-admin-disconnect-btn");
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", async function() {
        state.busy = true;
        syncButtons();
        try {
          await adapter.disconnectSpotify();
          await loadStatus({ forceRefresh: false });
        } catch (error) {
          setStatus(error && error.message ? error.message : "Gagal memutuskan koneksi Spotify.", "error");
        } finally {
          state.busy = false;
          syncButtons();
        }
      });
    }
  }

  async function init() {
    bindActions();
    syncButtons();

    const feedback = adapter.parseAuthFeedbackFromUrl();
    if (feedback.spotify === "connected") {
      setStatus("Spotify account connected successfully.", "success");
      adapter.clearAuthFeedbackInUrl();
    } else if (feedback.spotifyError) {
      setStatus(feedback.spotifyError, "error");
      adapter.clearAuthFeedbackInUrl();
    }

    await loadStatus({ forceRefresh: false });
  }

  document.addEventListener("DOMContentLoaded", function() {
    init().catch(function(error) {
      setStatus(error && error.message ? error.message : "Spotify admin init failed.", "error");
    });
  });
})();
