(function() {
  "use strict";

  const body = document.body;
  if (!body) return;

  if (body.classList.contains("admin-page") || body.classList.contains("admin-login-page")) {
    return;
  }

  const footerContainer = document.querySelector("#footer .container");
  if (!footerContainer) return;

  function renderText(message) {
    let el = document.getElementById("visitor-counter-text");
    if (!el) {
      el = document.createElement("div");
      el.id = "visitor-counter-text";
      el.className = "visitor-counter text-center";
      const credits = footerContainer.querySelector(".credits");
      if (credits && credits.parentNode) {
        credits.parentNode.insertBefore(el, credits.nextSibling);
      } else {
        footerContainer.appendChild(el);
      }
    }
    el.textContent = message;
  }

  async function updateCounter() {
    try {
      const response = await fetch("/api/visitor-counter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ path: window.location.pathname || "/" })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || "Visitor counter unavailable");
      }

      renderText(
        "Visitor counter: " +
          String(payload.totalViews) +
          " views (" +
          String(payload.pageViews) +
          " on this page)."
      );
    } catch (error) {
      renderText("Visitor counter unavailable right now.");
    }
  }

  updateCounter();
})();
