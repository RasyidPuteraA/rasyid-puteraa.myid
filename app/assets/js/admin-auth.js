/**
 * Master Admin Auth
 * Uses backend auth endpoints and HttpOnly cookie session.
 */
(function () {
  "use strict";

  const API = Object.freeze({
    login: "/api/admin/login",
    session: "/api/admin/session",
    logout: "/api/admin/logout"
  });

  let currentSession = null;

  function redirectTo(url) {
    window.location.href = url;
  }

  function showLoginError(message) {
    const errorEl = document.getElementById("admin-login-error");
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("d-none");
  }

  function clearLoginError() {
    const errorEl = document.getElementById("admin-login-error");
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("d-none");
  }

  function formatDate(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload && payload.error ? payload.error : "Request gagal diproses";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload || {};
  }

  async function fetchSession() {
    try {
      const payload = await requestJson(API.session, { method: "GET" });
      if (payload && payload.authenticated && payload.user) {
        currentSession = {
          username: payload.user.username,
          role: payload.user.role,
          expiresAt: payload.expiresAt || null
        };
      } else {
        currentSession = null;
      }
      return currentSession;
    } catch (error) {
      console.error("Failed to fetch admin session:", error);
      currentSession = null;
      return null;
    }
  }

  async function login(username, password) {
    const payload = await requestJson(API.login, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    currentSession = {
      username: payload.user.username,
      role: payload.user.role,
      expiresAt: payload.expiresAt || null
    };

    return currentSession;
  }

  async function logout() {
    try {
      await requestJson(API.logout, { method: "POST" });
    } catch (error) {
      console.error("Failed to logout:", error);
    } finally {
      currentSession = null;
    }
  }

  function isLoggedIn() {
    return Boolean(currentSession && currentSession.username);
  }

  async function initLoginPage() {
    const existingSession = await fetchSession();
    if (existingSession && existingSession.role === "master") {
      redirectTo("admin.html");
      return;
    }

    const form = document.getElementById("admin-login-form");
    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");
    if (!form || !usernameInput || !passwordInput) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearLoginError();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        showLoginError("Username dan password wajib diisi.");
        return;
      }

      const submitButton = form.querySelector("button[type='submit']");
      if (submitButton) submitButton.disabled = true;

      try {
        const session = await login(username, password);
        if (!session || session.role !== "master") {
          showLoginError("Role akun tidak diizinkan untuk admin.");
          return;
        }
        redirectTo("admin.html");
      } catch (error) {
        showLoginError(error.message || "Login gagal.");
        passwordInput.value = "";
        passwordInput.focus();
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  async function initDashboardPage() {
    const session = await fetchSession();
    if (!session || session.role !== "master") {
      redirectTo("admin-login.html");
      return;
    }

    const statusEl = document.getElementById("admin-session-status");
    if (statusEl) {
      statusEl.textContent =
        "Logged in as " +
        session.username +
        " (Role: " +
        session.role +
        ", expires: " +
        formatDate(session.expiresAt) +
        ")";
    }

    const logoutButton = document.getElementById("admin-logout-btn");
    if (logoutButton) {
      logoutButton.addEventListener("click", async function () {
        await logout();
        redirectTo("admin-login.html");
      });
    }
  }

  async function init() {
    const pageType = document.body ? document.body.dataset.adminPage : "";
    if (pageType === "login") {
      await initLoginPage();
      return;
    }
    if (pageType === "dashboard") {
      await initDashboardPage();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(function (error) {
      console.error("Admin auth init error:", error);
    });
  });

  window.AdminAuth = {
    fetchSession: fetchSession,
    getSession: function () {
      return currentSession;
    },
    isLoggedIn: isLoggedIn,
    logout: logout
  };
})();
