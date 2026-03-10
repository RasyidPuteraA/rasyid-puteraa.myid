/**
 * Master Admin Auth Prototype
 * Local-only authentication using localStorage.
 */
(function () {
  "use strict";

  const SESSION_KEY = "mrp_admin_session_v1";
  const MASTER_CREDENTIAL = Object.freeze({
    username: "masteradmin",
    password: "mrasyid@local2026"
  });

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      console.error("Failed to parse admin session:", error);
      return null;
    }
  }

  function isSessionValid(session) {
    if (!session || typeof session !== "object") return false;
    return (
      session.isAuthenticated === true &&
      session.username === MASTER_CREDENTIAL.username &&
      typeof session.loginAt === "string"
    );
  }

  function saveSession() {
    const payload = {
      isAuthenticated: true,
      username: MASTER_CREDENTIAL.username,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return isSessionValid(getSession());
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

  function redirectTo(url) {
    window.location.href = url;
  }

  function formatDate(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  }

  function initLoginPage() {
    const existing = getSession();
    if (isSessionValid(existing)) {
      redirectTo("admin.html");
      return;
    }

    const form = document.getElementById("admin-login-form");
    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");
    if (!form || !usernameInput || !passwordInput) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearLoginError();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (
        username === MASTER_CREDENTIAL.username &&
        password === MASTER_CREDENTIAL.password
      ) {
        saveSession();
        redirectTo("admin.html");
        return;
      }

      showLoginError("Login gagal. Username atau password tidak valid.");
      passwordInput.value = "";
      passwordInput.focus();
    });
  }

  function initDashboardPage() {
    const session = getSession();
    if (!isSessionValid(session)) {
      clearSession();
      redirectTo("admin-login.html");
      return;
    }

    const statusEl = document.getElementById("admin-session-status");
    if (statusEl) {
      statusEl.textContent =
        "Logged in as " +
        session.username +
        " (Local session started: " +
        formatDate(session.loginAt) +
        ")";
    }

    const logoutButton = document.getElementById("admin-logout-btn");
    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        clearSession();
        redirectTo("admin-login.html");
      });
    }
  }

  function init() {
    const pageType = document.body ? document.body.dataset.adminPage : "";
    if (pageType === "login") {
      initLoginPage();
    } else if (pageType === "dashboard") {
      initDashboardPage();
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  window.AdminAuth = {
    getSession: getSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn
  };
})();
