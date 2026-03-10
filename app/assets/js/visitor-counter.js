(function() {
  "use strict";

  const body = document.body;
  if (!body) return;

  if (body.classList.contains("admin-page") || body.classList.contains("admin-login-page")) {
    return;
  }

  const footerContainer = document.querySelector("#footer .container");
  if (!footerContainer) return;

  const storageKey = "mrp_visitor_counter_v1";

  function readCounter() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { total: 0, pages: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { total: 0, pages: {} };
      if (!parsed.pages || typeof parsed.pages !== "object") parsed.pages = {};
      if (typeof parsed.total !== "number") parsed.total = 0;
      return parsed;
    } catch (error) {
      return { total: 0, pages: {} };
    }
  }

  function saveCounter(counter) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(counter));
    } catch (error) {
      // ignore if storage is unavailable
    }
  }

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

  const counter = readCounter();
  const path = window.location.pathname || "index.html";

  counter.total += 1;
  counter.pages[path] = (Number(counter.pages[path]) || 0) + 1;
  saveCounter(counter);

  renderText("Visitor counter: " + counter.total + " views (" + counter.pages[path] + " on this page, local browser).");
})();
