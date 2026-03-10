(function() {
  "use strict";

  const body = document.body;
  if (!body) return;

  const pageFlags = {
    index: body.classList.contains("index-page"),
    projects: body.classList.contains("projects-page"),
    knowledge: body.classList.contains("knowledge-page"),
    ventures: body.classList.contains("ventures-page"),
    kom: body.classList.contains("kom-page")
  };

  const needsRender = Object.values(pageFlags).some(Boolean);
  if (!needsRender) return;

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

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function slugify(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function groupedByCategory(items) {
    const order = [];
    const map = {};

    items.forEach(item => {
      const category = item.category || "Uncategorized";
      if (!map[category]) {
        map[category] = [];
        order.push(category);
      }
      map[category].push(item);
    });

    return order.map(category => ({
      category,
      items: map[category]
    }));
  }

  function badgeClassByStatus(value) {
    const status = normalize(value);
    if (status.includes("progress") || status.includes("active")) return "text-bg-success";
    if (status.includes("plan") || status.includes("next")) return "text-bg-warning";
    if (status.includes("draft") || status.includes("backlog")) return "text-bg-secondary";
    return "text-bg-primary";
  }

  function badgeClassByType(value) {
    const type = normalize(value);
    if (type.includes("journal")) return "text-bg-warning";
    if (type.includes("review")) return "text-bg-secondary";
    if (type.includes("article")) return "text-bg-info";
    return "text-bg-primary";
  }

  function renderTagBadges(tags) {
    const list = ensureArray(tags);
    if (!list.length) return '<span class="badge border text-dark">#placeholder</span>';
    return list.map(tag => `<span class="badge border text-dark">#${escapeHtml(String(tag).replace(/\s+/g, "-"))}</span>`).join("");
  }

  function setSiteName(name) {
    if (!name) return;
    document.querySelectorAll(".sitename").forEach(element => {
      element.textContent = name;
    });
  }

  function setText(id, text) {
    const element = byId(id);
    if (!element) return;
    element.textContent = text || "";
  }

  function setLink(id, href, label) {
    const element = byId(id);
    if (!element) return;
    const safeHref = href || "#";
    element.setAttribute("href", safeHref);
    element.textContent = label || safeHref;
  }

  function setImageSource(id, src, fallback) {
    const element = byId(id);
    if (!element) return;
    const resolved = String(src || "").trim() || String(fallback || "").trim();
    if (!resolved) return;
    element.setAttribute("src", resolved);
  }

  function setProfileImages(src) {
    const resolved = String(src || "").trim();
    if (!resolved) return;
    document.querySelectorAll(".profile-img img").forEach(img => {
      img.setAttribute("src", resolved);
    });
  }

  function normalizePhoneForTel(phone) {
    return String(phone || "").replace(/[^\d+]/g, "");
  }

  function resolveMapEmbedUrl(contact, fallbackLocation) {
    const directUrl = String(contact.map_embed_url || "").trim();
    if (/^https:\/\/www\.google\.[^/]+\/maps/i.test(directUrl)) {
      return directUrl;
    }

    const mapQuery = String(contact.map_query || fallbackLocation || "Jakarta Selatan, Indonesia").trim();
    return `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  }

  function resolveLoader() {
    if (window.DataLoader && typeof window.DataLoader.loadAllData === "function") {
      return window.DataLoader;
    }
    return null;
  }

  async function loadSources(sources) {
    const loader = resolveLoader();
    if (!loader) throw new Error("DataLoader is unavailable");
    return loader.loadAllData(sources);
  }

  function renderHomeFeaturedProjects(homepage, projects) {
    const listEl = byId("home-featured-projects-list");
    if (!listEl) return;

    const featured = ensureArray(homepage.featured_projects);
    const fallback = ensureArray(projects).slice(0, 4).map(item => item.title);
    const items = featured.length ? featured : fallback;

    if (!items.length) {
      listEl.innerHTML = '<li class="small text-muted">Featured projects will appear after data is available.</li>';
      return;
    }

    listEl.innerHTML = items
      .map(title => `<li>${escapeHtml(title)}</li>`)
      .join("");
  }

  function renderHomeImages(homepage, profile) {
    const heroImage = homepage.hero_background_image || homepage.hero_image || "";
    const aboutImage = homepage.about_profile_image || profile.profile_image || "";

    setImageSource("home-hero-bg", heroImage, "assets/img/hero-bg.jpg");
    setImageSource("home-about-image", aboutImage, "assets/img/my-profile-img.jpg");
  }

  function renderIdentitySkills(profile) {
    const container = byId("home-skill-badges");
    if (!container) return;

    const hardSkills = ensureArray(profile.hard_skills);
    const fallbackSkills = ensureArray(profile.skills);
    const list = (hardSkills.length ? hardSkills : fallbackSkills).slice(0, 8);

    if (!list.length) {
      container.innerHTML = '<span class="badge border text-dark">skill-placeholder</span>';
      return;
    }

    container.innerHTML = list
      .map(skill => `<span class="badge border text-dark">${escapeHtml(skill)}</span>`)
      .join("");
  }

  function renderHomeContact(contact, profileContacts, fallbackLocation) {
    const contactData = asObject(contact);
    const profileContactData = asObject(profileContacts);

    const address = contactData.location || fallbackLocation || "Jakarta Selatan, Indonesia";
    const phone = contactData.phone || profileContactData.phone || "";
    const email = contactData.email || profileContactData.email || "";
    const availability = contactData.availability || "Open for collaboration.";

    setText("contact-address", address);
    setText("contact-section-note", `${availability} You can contact me via form, email, or direct phone.`);

    const phoneLinkEl = byId("contact-phone-link");
    if (phoneLinkEl) {
      const normalizedPhone = normalizePhoneForTel(phone);
      phoneLinkEl.textContent = phone || "Phone not available yet";
      phoneLinkEl.setAttribute("href", normalizedPhone ? `tel:${normalizedPhone}` : "#");
    }

    const emailLinkEl = byId("contact-email-link");
    if (emailLinkEl) {
      emailLinkEl.textContent = email || "Email not available yet";
      emailLinkEl.setAttribute("href", email ? `mailto:${email}` : "#");
    }

    const mapEl = byId("contact-map-embed");
    if (mapEl) {
      mapEl.setAttribute("src", resolveMapEmbedUrl(contactData, address));
    }
  }

  function renderProjectsArchive(projects, knowledgeMap) {
    const container = byId("projects-archive-content");
    if (!container) return;

    const grouped = groupedByCategory(ensureArray(projects));
    if (!grouped.length) {
      container.innerHTML = '<div class="alert alert-light border">No project data available.</div>';
      return;
    }

    container.innerHTML = grouped.map(group => {
      const cards = group.items.map(item => {
        const related = ensureArray(item.related_knowledge)
          .map(id => knowledgeMap[id] ? knowledgeMap[id].title : id)
          .slice(0, 3)
          .join(" | ");
        const detailHref = item.id ? `project-detail.html?id=${encodeURIComponent(item.id)}` : (item.url || "#");

        return `
          <div class="col-lg-4 col-md-6">
            <article id="${escapeHtml(item.id || "")}" class="card h-100 border-0 shadow-sm archive-entry-card">
              <img src="${escapeHtml(item.cover_image || "assets/img/portfolio/app-1.jpg")}" class="card-img-top" alt="${escapeHtml(item.title || "Project")} cover">
              <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
                  <h4 class="h6 mb-0">${escapeHtml(item.title || "Untitled Project")}</h4>
                  <span class="badge ${badgeClassByStatus(item.status)}">${escapeHtml(item.status || "Draft")}</span>
                </div>
                <p class="small mb-2"><strong>Category:</strong> ${escapeHtml(item.category || "Uncategorized")}</p>
                <p class="mb-3">${escapeHtml(item.summary || "Summary placeholder.")}</p>
                <div class="mb-3 d-flex flex-wrap gap-2">${renderTagBadges(item.tags)}</div>
                <p class="small mb-3"><strong>Related knowledge:</strong> ${escapeHtml(related || "No related reference")}</p>
                <a href="${escapeHtml(detailHref)}" class="btn btn-outline-primary btn-sm mt-auto">View Project</a>
              </div>
            </article>
          </div>
        `;
      }).join("");

      return `
        <div class="mb-5">
          <h3 class="resume-title">${escapeHtml(group.category)}</h3>
          <div class="row gy-4">${cards}</div>
        </div>
      `;
    }).join("");
  }

  function renderProjectsConnected(projects, knowledgeMap) {
    const listEl = byId("projects-connected-list");
    if (!listEl) return;

    const lines = ensureArray(projects)
      .filter(item => ensureArray(item.related_knowledge).length)
      .slice(0, 4)
      .map(item => {
        const firstRef = ensureArray(item.related_knowledge)[0];
        const relatedTitle = knowledgeMap[firstRef] ? knowledgeMap[firstRef].title : firstRef;
        return `<li>${escapeHtml(item.title)} -> ${escapeHtml(relatedTitle || "Related Knowledge")}</li>`;
      });

    if (!lines.length) {
      listEl.innerHTML = "<li>Project and knowledge links will appear after metadata is available.</li>";
      return;
    }

    listEl.innerHTML = lines.join("");
  }

  function renderKnowledgeArchive(knowledge, projectMap) {
    const container = byId("knowledge-archive-content");
    if (!container) return;

    const grouped = groupedByCategory(ensureArray(knowledge));
    if (!grouped.length) {
      container.innerHTML = '<div class="alert alert-light border">No knowledge data available.</div>';
      return;
    }

    container.innerHTML = grouped.map(group => {
      const cards = group.items.map(item => {
        const related = ensureArray(item.related_projects)
          .map(id => projectMap[id] ? projectMap[id].title : id)
          .slice(0, 3)
          .join(" | ");
        const detailHref = item.id ? `knowledge-detail.html?id=${encodeURIComponent(item.id)}` : (item.url || "#");

        return `
          <div class="col-lg-6">
            <article id="${escapeHtml(item.id || "")}" class="card h-100 border-0 shadow-sm archive-entry-card">
              <img src="${escapeHtml(item.cover_image || "assets/img/portfolio/books-1.jpg")}" class="card-img-top" alt="${escapeHtml(item.title || "Knowledge")} cover">
              <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
                  <h4 class="h6 mb-0">${escapeHtml(item.title || "Untitled Entry")}</h4>
                  <span class="badge ${badgeClassByType(item.type)}">${escapeHtml((item.type || "note").toUpperCase())}</span>
                </div>
                <p class="small mb-2"><strong>Category:</strong> ${escapeHtml(item.category || "Uncategorized")}</p>
                <p class="mb-3">${escapeHtml(item.summary || "Summary placeholder.")}</p>
                <div class="mb-3 d-flex flex-wrap gap-2">${renderTagBadges(item.tags)}</div>
                <p class="small mb-3"><strong>Related project:</strong> ${escapeHtml(related || "No related reference")}</p>
                <a href="${escapeHtml(detailHref)}" class="btn btn-outline-primary btn-sm mt-auto">Open Entry</a>
              </div>
            </article>
          </div>
        `;
      }).join("");

      return `
        <div class="mb-5">
          <h3 class="resume-title">${escapeHtml(group.category)}</h3>
          <div class="row gy-4">${cards}</div>
        </div>
      `;
    }).join("");
  }

  function renderKnowledgeRelated(knowledge, projectMap) {
    const listEl = byId("knowledge-related-list");
    if (!listEl) return;

    const lines = ensureArray(knowledge)
      .filter(item => ensureArray(item.related_projects).length)
      .slice(0, 4)
      .map(item => {
        const firstRef = ensureArray(item.related_projects)[0];
        const projectTitle = projectMap[firstRef] ? projectMap[firstRef].title : firstRef;
        return `<li>${escapeHtml(item.title)} -> ${escapeHtml(projectTitle || "Related Project")}</li>`;
      });

    if (!lines.length) {
      listEl.innerHTML = "<li>Knowledge and project links will appear after metadata is available.</li>";
      return;
    }

    listEl.innerHTML = lines.join("");
  }

  function renderVentures(ventures) {
    const container = byId("ventures-cards-grid");
    if (!container) return;

    const list = ensureArray(ventures);
    if (!list.length) {
      container.innerHTML = '<div class="col-12"><div class="alert alert-light border mb-0">No venture data available.</div></div>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="col-lg-4 col-md-6">
        <article id="${escapeHtml(item.id || slugify(item.title))}" class="card h-100 border-0 shadow-sm archive-entry-card">
          <img src="${escapeHtml(item.image || item.cover_image || "assets/img/portfolio/product-1.jpg")}" class="card-img-top" alt="${escapeHtml(item.title || "Venture")} cover">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
              <h3 class="h5 mb-0">${escapeHtml(item.title || "Untitled Venture")}</h3>
              <span class="badge ${badgeClassByStatus(item.status)}">${escapeHtml(item.status || "Draft")}</span>
            </div>
            <p class="mb-3">${escapeHtml(item.description || item.summary || "Description placeholder.")}</p>
            <p class="mb-3"><strong>Current role/status:</strong> ${escapeHtml(item.role || item.status || "Placeholder")}</p>
            <div class="mt-auto">
              <a href="${escapeHtml(item.link || item.url || "#")}" class="btn btn-outline-primary btn-sm">View Venture</a>
            </div>
          </div>
        </article>
      </div>
    `).join("");
  }

  function renderKomPrompts(komConfig) {
    const promptWrap = byId("kom-suggested-prompts");
    if (!promptWrap) return;

    const promptButtons = Array.from(promptWrap.querySelectorAll(".kom-prompt-btn"));
    if (!promptButtons.length) return;

    const config = asObject(komConfig);
    const ui = asObject(config.ui);
    const prompts = ensureArray(config.suggested_prompts).length
      ? ensureArray(config.suggested_prompts)
      : ensureArray(ui.suggested_prompts);

    if (!prompts.length) return;

    promptButtons.forEach((button, index) => {
      const value = prompts[index];
      if (!value) {
        button.hidden = true;
        return;
      }

      button.hidden = false;
      button.textContent = value;
      button.setAttribute("data-query", value);
    });
  }

  async function renderIndexPage() {
    const data = await loadSources(["profile", "homepage", "projects", "contact"]);
    const profile = asObject(data.profile);
    const homepage = asObject(data.homepage);
    const contact = asObject(data.contact);
    const profileContacts = asObject(profile.contacts);
    const hero = asObject(homepage.hero);
    const focusAreas = ensureArray(profile.focus_areas);
    const interests = ensureArray(profile.interests);
    const primaryFocus = focusAreas.length ? focusAreas.slice(0, 2).join(" / ") : "Electric Vehicle Technology / Embedded Systems";
    const domainFocus = interests.length ? interests.slice(0, 3).join(", ") : "Engineering, Knowledge, Ventures";
    const location = profile.location || contact.location || "Indonesia";
    const role = profile.role || profile.headline || "Engineer";
    const email = profileContacts.email || contact.email || "hello@example.com";
    const collaboration = contact.availability || "Open for collaboration";
    const heroTitle = homepage.hero_title || hero.title || "";
    const heroSubtitle = homepage.hero_subtitle || hero.subtitle || "";
    const heroNote = heroSubtitle && normalize(heroSubtitle) !== normalize(role)
      ? heroSubtitle
      : "Personal website and knowledge archive built in iterative phases.";

    setSiteName(profile.name);
    setProfileImages(profile.profile_image || "");
    renderHomeImages(homepage, profile);
    setText("home-hero-title", profile.name || heroTitle || "Hero / Introduction");
    setText("home-hero-subtitle", role || heroSubtitle || "Homepage subtitle from unified data.");
    setText("home-hero-note", heroNote);
    setText("home-profile-headline", profile.headline || "Builder, Research-Oriented Learner, and Systems Thinker");
    setText("home-identity-snapshot", homepage.identity_snapshot || profile.summary || profile.bio || "Identity snapshot placeholder from unified data.");
    setText("home-primary-focus", primaryFocus);
    setText("home-domain-focus", domainFocus);
    setText("home-current-role", role);
    setText("home-location", location);
    setText("home-collaboration", collaboration);
    setLink("home-email-link", `mailto:${email}`, email);
    setText("home-identity-note", `Education: ${(ensureArray(profile.education)[0] || {}).institution || "Institution"} - ${(ensureArray(profile.education)[0] || {}).degree || "Degree"} (${(ensureArray(profile.education)[0] || {}).period || "Period"})`);
    renderIdentitySkills(profile);
    renderHomeContact(contact, profileContacts, location);
    setText("home-kom-intro", homepage.kom_intro || "KOM introduction from unified data source.");

    renderHomeFeaturedProjects(homepage, data.projects);
  }

  async function renderProjectsPage() {
    const data = await loadSources(["profile", "projects", "knowledge"]);
    const profile = asObject(data.profile);
    setSiteName(profile.name);
    setProfileImages(profile.profile_image || "");

    const knowledgeMap = ensureArray(data.knowledge).reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    renderProjectsArchive(data.projects, knowledgeMap);
    renderProjectsConnected(data.projects, knowledgeMap);
  }

  async function renderKnowledgePage() {
    const data = await loadSources(["profile", "projects", "knowledge"]);
    const profile = asObject(data.profile);
    setSiteName(profile.name);
    setProfileImages(profile.profile_image || "");

    const projectMap = ensureArray(data.projects).reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    renderKnowledgeArchive(data.knowledge, projectMap);
    renderKnowledgeRelated(data.knowledge, projectMap);
  }

  async function renderVenturesPage() {
    const data = await loadSources(["profile", "ventures"]);
    const profile = asObject(data.profile);
    setSiteName(profile.name);
    setProfileImages(profile.profile_image || "");
    renderVentures(data.ventures);
  }

  async function renderKomPage() {
    const data = await loadSources(["profile", "homepage", "kom-config"]);
    const profile = asObject(data.profile);
    const homepage = asObject(data.homepage);

    setSiteName(profile.name);
    setProfileImages(profile.profile_image || "");
    setText("kom-page-intro", homepage.kom_intro || "KOM reads projects and knowledge archives using structured metadata and relevance ranking, fully on the client-side.");
    renderKomPrompts(data["kom-config"]);
  }

  async function bootstrap() {
    try {
      if (pageFlags.index) await renderIndexPage();
      if (pageFlags.projects) await renderProjectsPage();
      if (pageFlags.knowledge) await renderKnowledgePage();
      if (pageFlags.ventures) await renderVenturesPage();
      if (pageFlags.kom) await renderKomPage();
    } catch (error) {
      console.error("Public render sync failed:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
