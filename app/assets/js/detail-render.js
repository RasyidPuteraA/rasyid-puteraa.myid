(function() {
  "use strict";

  const body = document.body;
  if (!body) return;

  const pageType = body.classList.contains("project-detail-page")
    ? "project"
    : body.classList.contains("knowledge-detail-page")
      ? "knowledge"
      : "";

  if (!pageType) return;

  function byId(id) {
    return document.getElementById(id);
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(id, value) {
    const el = byId(id);
    if (!el) return;
    el.textContent = value || "";
  }

  function setSiteName(name) {
    if (!name) return;
    document.querySelectorAll(".sitename").forEach(function(el) {
      el.textContent = name;
    });
  }

  function setProfileImages(src) {
    const resolved = String(src || "").trim();
    if (!resolved) return;
    document.querySelectorAll(".profile-img img").forEach(function(img) {
      img.setAttribute("src", resolved);
    });
  }

  function iconClassByPlatform(platform) {
    const key = String(platform || "").toLowerCase().trim();
    if (key === "linkedin") return "bi-linkedin";
    if (key === "github") return "bi-github";
    if (key === "instagram") return "bi-instagram";
    if (key === "youtube") return "bi-youtube";
    if (key === "twitter" || key === "x") return "bi-twitter-x";
    if (key === "facebook") return "bi-facebook";
    return "bi-link-45deg";
  }

  function renderSocialLinks(profile) {
    const container = document.querySelector(".social-links");
    if (!container) return;
    const links = ensureArray(profile && profile.social_links ? profile.social_links : []);
    if (!links.length) return;

    container.innerHTML = links.map(function(item) {
      const platform = item && (item.platform || item.name) ? String(item.platform || item.name) : "link";
      const url = item && item.url ? String(item.url) : "#";
      const icon = iconClassByPlatform(platform);
      return '<a href=\"' + escapeHtml(url) + '\" class=\"' + escapeHtml(platform.toLowerCase()) + '\" target=\"_blank\" rel=\"noopener noreferrer\"><i class=\"bi ' + escapeHtml(icon) + '\"></i></a>';
    }).join("");
  }

  function formatDate(value) {
    if (!value) return "Date n/a";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit"
    }).format(dt);
  }

  function splitParagraphs(content) {
    if (Array.isArray(content)) {
      return content.filter(Boolean).map(function(item) { return String(item); });
    }
    const raw = String(content || "").trim();
    if (!raw) return [];
    return raw.split(/\n\s*\n/).map(function(part) { return part.trim(); }).filter(Boolean);
  }

  function renderTags(tags) {
    const list = ensureArray(tags);
    if (!list.length) {
      return '<span class="badge border text-dark">#untagged</span>';
    }
    return list
      .map(function(tag) {
        return '<span class="badge border text-dark">#' + escapeHtml(String(tag).replace(/\s+/g, "-")) + '</span>';
      })
      .join("");
  }

  function renderSections(sections) {
    const list = ensureArray(sections);
    if (!list.length) return "";

    return list.map(function(section, index) {
      const item = asObject(section);
      const title = item.title || ("Section " + (index + 1));
      const content = item.content ? ('<p>' + escapeHtml(item.content) + '</p>') : "";
      const items = ensureArray(item.items).length
        ? ('<ul>' + ensureArray(item.items).map(function(point) {
          return '<li>' + escapeHtml(point) + '</li>';
        }).join("") + '</ul>')
        : "";
      const steps = ensureArray(item.steps).length
        ? ('<ol>' + ensureArray(item.steps).map(function(step) {
          return '<li>' + escapeHtml(step) + '</li>';
        }).join("") + '</ol>')
        : "";

      return [
        '<section class="detail-section-card card border-0 shadow-sm">',
        '  <div class="card-body">',
        '    <h3 class="h6 mb-3">' + escapeHtml(title) + '</h3>',
        '    <div class="detail-section-body">' + content + items + steps + '</div>',
        '  </div>',
        '</section>'
      ].join("\n");
    }).join("\n");
  }

  function renderRelatedEntries(ids, entryMap, type) {
    const list = ensureArray(ids);
    if (!list.length) {
      return '<span class="badge border text-dark">No related references</span>';
    }

    return list.map(function(id) {
      const ref = entryMap[id];
      if (!ref) {
        return '<span class="badge border text-dark">' + escapeHtml(id) + '</span>';
      }
      const href = type === "project"
        ? ('project-detail.html?id=' + encodeURIComponent(ref.id))
        : ('knowledge-detail.html?id=' + encodeURIComponent(ref.id));
      return '<a class="badge border text-dark text-decoration-none" href="' + escapeHtml(href) + '">' + escapeHtml(ref.title) + '</a>';
    }).join("");
  }

  function likeEndpoint(itemId) {
    if (pageType === "project") {
      return "/api/projects/" + encodeURIComponent(itemId) + "/like";
    }
    return "/api/articles/" + encodeURIComponent(itemId) + "/like";
  }

  async function incrementLikeOnServer(itemId) {
    const response = await fetch(likeEndpoint(itemId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin"
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error((payload && payload.error) || "Failed to register like.");
    }

    return Number(payload && payload.likes ? payload.likes : 0);
  }

  function renderNotFound() {
    const root = byId("detail-root");
    if (!root) return;

    const backHref = pageType === "project" ? "projects.html" : "knowledge.html";
    const backLabel = pageType === "project" ? "Back to Projects" : "Back to Knowledge";

    root.innerHTML = [
      '<div class="card border-0 shadow-sm">',
      '  <div class="card-body p-4">',
      '    <h2 class="h4 mb-3">Content Not Found</h2>',
      '    <p class="mb-3">The requested content ID is not available in this archive.</p>',
      '    <a href="' + backHref + '" class="btn btn-outline-primary btn-sm">' + backLabel + '</a>',
      '  </div>',
      '</div>'
    ].join("\n");
  }

  async function copyToClipboard(text) {
    const value = String(text || "");
    if (!value) return false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        // continue to fallback
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  }

  function setActionStatus(message, type) {
    const el = byId("detail-action-status");
    if (!el) return;
    el.textContent = message || "";
    el.className = "small";
    if (type === "error") {
      el.classList.add("text-danger");
    } else {
      el.classList.add("text-muted");
    }
  }

  async function loadSources() {
    if (window.DataLoader && typeof window.DataLoader.loadAllData === "function") {
      return window.DataLoader.loadAllData(["profile", "projects", "knowledge"]);
    }

    const [profileRes, projectsRes, knowledgeRes] = await Promise.all([
      fetch("data/profile.json"),
      fetch("data/projects.json"),
      fetch("data/knowledge.json")
    ]);

    if (!profileRes.ok || !projectsRes.ok || !knowledgeRes.ok) {
      throw new Error("Failed to load detail data sources.");
    }

    return {
      profile: await profileRes.json(),
      projects: await projectsRes.json(),
      knowledge: await knowledgeRes.json()
    };
  }

  function metaRow(item, likeCount) {
    if (pageType === "project") {
      return [
        '<span class="badge text-bg-light border text-dark"><i class="bi bi-calendar-event me-1"></i>' + escapeHtml(formatDate(item.date)) + '</span>',
        '<span class="badge text-bg-primary">' + escapeHtml(item.category || "Project") + '</span>',
        '<span class="badge text-bg-secondary"><i class="bi bi-heart-fill me-1"></i><span id="detail-like-count">' + escapeHtml(String(likeCount)) + '</span></span>',
        '<span class="badge text-bg-info">' + escapeHtml(item.status || "Status") + '</span>'
      ].join(" ");
    }

    return [
      '<span class="badge text-bg-light border text-dark"><i class="bi bi-calendar-event me-1"></i>' + escapeHtml(formatDate(item.date)) + '</span>',
      '<span class="badge text-bg-secondary">' + escapeHtml((item.type || "knowledge").toUpperCase()) + '</span>',
      '<span class="badge text-bg-primary">' + escapeHtml(item.category || "Knowledge") + '</span>',
      '<span class="badge text-bg-info"><i class="bi bi-heart-fill me-1"></i><span id="detail-like-count">' + escapeHtml(String(likeCount)) + '</span></span>'
    ].join(" ");
  }

  function buildArticle(item, relatedHtml, likeCount) {
    const root = byId("detail-root");
    if (!root) return;

    const contentParagraphs = splitParagraphs(item.content).map(function(text) {
      return '<p>' + escapeHtml(text) + '</p>';
    }).join("\n");

    const sectionsHtml = renderSections(item.sections);
    const backHref = pageType === "project" ? "projects.html" : "knowledge.html";
    const backLabel = pageType === "project" ? "Back to Projects" : "Back to Knowledge";
    const relatedLabel = pageType === "project" ? "Related Knowledge" : "Related Projects";
    const cover = item.cover_image || (pageType === "project" ? "assets/img/portfolio/app-1.jpg" : "assets/img/portfolio/books-1.jpg");
    const author = item.author || "Author n/a";

    root.innerHTML = [
      '<article class="detail-article card border-0 shadow-sm">',
      '  <div class="card-body p-4 p-lg-5">',
      '    <header class="detail-header mb-4">',
      '      <h2 id="detail-hero-title" class="detail-title mb-2">' + escapeHtml(item.title || "Untitled") + '</h2>',
      '      <p id="detail-hero-subtitle" class="detail-subtitle mb-3">' + escapeHtml(item.summary || "Summary not available.") + '</p>',
      '      <div class="detail-meta d-flex flex-wrap gap-2 mb-3">' + metaRow(item, likeCount) + '</div>',
      '      <div class="d-flex flex-wrap align-items-center gap-2">',
      '        <button type="button" id="detail-like-btn" class="btn btn-outline-primary btn-sm"><i class="bi bi-hand-thumbs-up me-1"></i>Like</button>',
      '        <button type="button" id="detail-share-btn" class="btn btn-outline-secondary btn-sm"><i class="bi bi-share me-1"></i>Share</button>',
      '        <button type="button" id="detail-copy-link-btn" class="btn btn-outline-secondary btn-sm"><i class="bi bi-link-45deg me-1"></i>Copy Link</button>',
      '        <span class="small text-muted">Author: ' + escapeHtml(author) + '</span>',
      '        <span id="detail-action-status" class="small text-muted"></span>',
      '      </div>',
      '    </header>',
      '    <figure class="detail-cover mb-4">',
      '      <img src="' + escapeHtml(cover) + '" alt="' + escapeHtml(item.title || "Cover") + '" class="img-fluid rounded-3">',
      '    </figure>',
      '    <div class="detail-content mb-4">',
      contentParagraphs || '<p>Content body is being prepared.</p>',
      '    </div>',
      '    <div class="detail-sections-stack mb-4">',
      sectionsHtml,
      '    </div>',
      '    <section class="detail-related card border-0 shadow-sm mb-4">',
      '      <div class="card-body">',
      '        <h3 class="h6 mb-3">' + relatedLabel + '</h3>',
      '        <div class="d-flex flex-wrap gap-2">' + relatedHtml + '</div>',
      '      </div>',
      '    </section>',
      '    <a href="' + backHref + '" class="btn btn-outline-primary btn-sm"><i class="bi bi-arrow-left me-1"></i>' + backLabel + '</a>',
      '  </div>',
      '</article>'
    ].join("\n");
  }

  async function bootstrap() {
    try {
      const params = new URLSearchParams(window.location.search);
      const itemId = params.get("id") || "";
      const currentTitle = byId("detail-page-title");
      setText("detail-page-title", pageType === "project" ? "Project Detail" : "Knowledge Detail");
      setText("detail-breadcrumb-current", pageType === "project" ? "Project Detail" : "Knowledge Detail");

      const data = await loadSources();
      const profile = asObject(data.profile);
      const projects = ensureArray(data.projects);
      const knowledge = ensureArray(data.knowledge);

      setSiteName(profile.name);
      setProfileImages(profile.profile_image || "");
      renderSocialLinks(profile);

      const projectMap = projects.reduce(function(acc, item) {
        acc[item.id] = item;
        return acc;
      }, {});

      const knowledgeMap = knowledge.reduce(function(acc, item) {
        acc[item.id] = item;
        return acc;
      }, {});

      const source = pageType === "project" ? projects : knowledge;
      const item = source.find(function(entry) {
        return String(entry.id) === String(itemId);
      });

      if (!item) {
        renderNotFound();
        if (currentTitle) currentTitle.textContent = "Content Not Found";
        setText("detail-breadcrumb-current", "Not Found");
        return;
      }

      setText("detail-page-title", item.title || (pageType === "project" ? "Project Detail" : "Knowledge Detail"));
      setText("detail-breadcrumb-current", item.title || "Detail");
      document.title = (item.title || "Detail") + " - rasyid-puteraa.my.id";

      let likeCount = Number(item.likes) || 0;

      const relatedHtml = pageType === "project"
        ? renderRelatedEntries(item.related_knowledge, knowledgeMap, "knowledge")
        : renderRelatedEntries(item.related_projects, projectMap, "project");

      buildArticle(item, relatedHtml, likeCount);

      const likeBtn = byId("detail-like-btn");
      const likeCountEl = byId("detail-like-count");
      if (likeBtn && likeCountEl) {
        likeBtn.addEventListener("click", async function() {
          try {
            likeBtn.disabled = true;
            likeCount = await incrementLikeOnServer(item.id);
            likeCountEl.textContent = String(likeCount);
            setActionStatus("Thanks, your like was saved.", "info");
          } catch (error) {
            setActionStatus(error.message || "Failed to save like.", "error");
          } finally {
            likeBtn.disabled = false;
          }
        });
      }

      const shareBtn = byId("detail-share-btn");
      const copyBtn = byId("detail-copy-link-btn");
      const shareTitle = item.title || "Archive Detail";
      const shareUrl = window.location.href;

      if (shareBtn) {
        shareBtn.addEventListener("click", async function() {
          if (navigator.share && typeof navigator.share === "function") {
            try {
              await navigator.share({
                title: shareTitle,
                text: item.summary || "",
                url: shareUrl
              });
              setActionStatus("Link shared successfully.", "info");
              return;
            } catch (error) {
              if (error && error.name === "AbortError") {
                setActionStatus("Share cancelled.", "error");
                return;
              }
            }
          }

          const copied = await copyToClipboard(shareUrl);
          setActionStatus(copied ? "Share not supported here. Link copied instead." : "Unable to share or copy link.", copied ? "info" : "error");
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener("click", async function() {
          const copied = await copyToClipboard(shareUrl);
          setActionStatus(copied ? "Link copied to clipboard." : "Copy failed. Please copy URL manually.", copied ? "info" : "error");
        });
      }
    } catch (error) {
      renderNotFound();
      console.error("Detail render failed:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
