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
    if (!list.length) return "";
    return list.map(tag => `<span class="badge border text-dark">#${escapeHtml(String(tag).replace(/\s+/g, "-"))}</span>`).join("");
  }

  function setSiteName(name) {
    document.querySelectorAll(".sitename").forEach(element => {
      element.textContent = name || "";
    });
  }

  function iconClassByPlatform(platform) {
    const key = normalize(platform);
    if (key === "linkedin") return "bi-linkedin";
    if (key === "github") return "bi-github";
    if (key === "instagram") return "bi-instagram";
    if (key === "youtube") return "bi-youtube";
    if (key === "twitter" || key === "x") return "bi-twitter-x";
    if (key === "facebook") return "bi-facebook";
    return "bi-link-45deg";
  }

  function socialLinksFromSource(source) {
    if (Array.isArray(source)) return source;
    return ensureArray(asObject(source).social_links);
  }

  function renderSocialLinks(profile, contact, options = {}) {
    const container = document.querySelector(".social-links");
    if (!container) return;

    const profileLinks = socialLinksFromSource(profile);
    const contactLinks = socialLinksFromSource(contact);
    const links = profileLinks.length ? profileLinks : contactLinks;
    const clearIfEmpty = options.clearIfEmpty !== false;
    if (!links.length) {
      if (clearIfEmpty) {
        container.innerHTML = "";
      }
      return;
    }

    container.innerHTML = links.map((item) => {
      const platform = item.platform || item.name || "link";
      const url = item.url || "#";
      const icon = iconClassByPlatform(platform);
      return `<a href="${escapeHtml(url)}" class="${escapeHtml(normalize(platform) || "link")}" target="_blank" rel="noopener noreferrer"><i class="bi ${escapeHtml(icon)}"></i></a>`;
    }).join("");
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
    element.textContent = label || "";
  }

  function setImageSource(id, src) {
    const element = byId(id);
    if (!element) return;
    const resolved = String(src || "").trim();
    if (!resolved) {
      element.removeAttribute("src");
      return;
    }
    element.setAttribute("src", resolved);
  }

  function setProfileImages(src) {
    const resolved = String(src || "").trim();
    document.querySelectorAll(".profile-img img").forEach(img => {
      if (!resolved) {
        img.removeAttribute("src");
        return;
      }
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

    const mapQuery = String(contact.map_query || fallbackLocation || "").trim();
    if (!mapQuery) return "";
    return `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  }

  function createEmptySiteContent() {
    return {
      homepage: {},
      profile: {},
      timeline: [],
      notes: [],
      skills: [],
      social_links: [],
      ventures: [],
      projects: [],
      knowledge: [],
      contact: {},
      reviews: [],
      "kom-config": {}
    };
  }

  async function loadSiteContent() {
    const response = await fetch("/api/site-content", {
      credentials: "same-origin",
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch site content (${response.status})`);
    }

    const payload = asObject(await response.json());
    return {
      homepage: asObject(payload.homepage),
      profile: asObject(payload.profile),
      timeline: ensureArray(payload.timeline),
      notes: ensureArray(payload.notes),
      skills: ensureArray(payload.skills),
      social_links: ensureArray(payload.social_links),
      ventures: ensureArray(payload.ventures),
      projects: ensureArray(payload.projects),
      knowledge: ensureArray(payload.knowledge),
      contact: asObject(payload.contact),
      reviews: ensureArray(payload.reviews),
      "kom-config": asObject(payload["kom-config"])
    };
  }

  function renderHomeFeaturedProjects(homepage) {
    const listEl = byId("home-featured-projects-list");
    if (!listEl) return;

    const featuredRaw = homepage.featured_projects;
    const items = Array.isArray(featuredRaw)
      ? featuredRaw
      : String(featuredRaw || "")
          .split(",")
          .map(item => item.trim())
          .filter(Boolean);

    if (!items.length) {
      listEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = items
      .map(title => `<li>${escapeHtml(title)}</li>`)
      .join("");
  }

  function noteTags(item) {
    const source = item ? item.tags : null;
    if (Array.isArray(source)) {
      return source.map(tag => String(tag || "").trim()).filter(Boolean);
    }
    return String(source || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }

  function renderHomeNotes(notes) {
    const container = byId("home-notes-preview");
    if (!container) return;

    const list = ensureArray(notes)
      .filter(item => item && typeof item === "object")
      .slice(0, 4);

    if (!list.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = list.map(item => {
      const title = item.title || item.name || "Untitled Note";
      const category = item.category || item.type || "General";
      const summary = item.summary || item.description || item.excerpt || "Summary is not available yet.";
      const tags = noteTags(item).slice(0, 4);
      const href = item.id
        ? `knowledge-detail.html?id=${encodeURIComponent(item.id)}`
        : (item.url || "knowledge.html");
      const tagsHtml = tags.length
        ? `<div class="d-flex flex-wrap gap-2 mt-2">${tags.map(tag => `<span class="badge border text-dark">#${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";

      return `
        <div class="col-lg-6">
          <article class="card h-100 border-0 shadow-sm">
            <div class="card-body d-flex flex-column">
              <p class="small text-muted mb-2">${escapeHtml(category)}</p>
              <h4 class="h6 mb-2">${escapeHtml(title)}</h4>
              <p class="mb-3">${escapeHtml(summary)}</p>
              ${tagsHtml}
              <a href="${escapeHtml(href)}" class="btn btn-outline-primary btn-sm mt-auto">Open Note</a>
            </div>
          </article>
        </div>
      `;
    }).join("");
  }

  function renderHomeTimeline(timeline) {
    const container = document.querySelector("#evolution-map .row.gy-4");
    if (!container) return;

    const list = ensureArray(timeline)
      .slice()
      .sort((a, b) => {
        const left = Number(a && a.order);
        const right = Number(b && b.order);
        const leftValue = Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER;
        const rightValue = Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER;
        return leftValue - rightValue;
      });

    if (!list.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = list.map(item => {
      const title = item.title || item.phase || "";
      const statusLine = item.period || item.status || "";
      const meta = [item.organization, item.location].filter(Boolean).join(" | ");
      const summary = item.summary || "";
      const description = meta ? `${meta}. ${summary}` : summary;

      return `
        <div class="col-lg-4 col-md-6">
          <div class="resume-item h-100">
            <h4>${escapeHtml(title)}</h4>
            <h5>${escapeHtml(statusLine)}</h5>
            <p>${escapeHtml(description)}</p>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderHomeImages(homepage, profile) {
    const heroImage = homepage.hero_image_path || "";
    const aboutImage = homepage.about_profile_image_path || profile.profile_image_path || "";

    setImageSource("home-hero-bg", heroImage);
    setImageSource("home-about-image", aboutImage);
  }

  function toSkillLabel(item) {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object") return "";
    return String(item.skill || item.name || item.title || item.label || "").trim();
  }

  function renderIdentitySkills(skills) {
    const container = byId("home-skill-badges");
    if (!container) return;

    const list = ensureArray(skills)
      .map(toSkillLabel)
      .filter(Boolean)
      .slice(0, 8);

    if (!list.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = list
      .map(skill => `<span class="badge border text-dark">${escapeHtml(skill)}</span>`)
      .join("");
  }

  function renderHomeContact(contact, profileContacts, fallbackLocation) {
    const contactData = asObject(contact);
    const profileContactData = asObject(profileContacts);

    const address = contactData.location || fallbackLocation || "";
    const phone = contactData.phone || profileContactData.phone || "";
    const email = contactData.email || profileContactData.email || "";
    const availability = contactData.availability || "";

    setText("contact-address", address);
    setText("contact-section-note", availability);

    const phoneLinkEl = byId("contact-phone-link");
    if (phoneLinkEl) {
      const normalizedPhone = normalizePhoneForTel(phone);
      phoneLinkEl.textContent = phone;
      phoneLinkEl.setAttribute("href", normalizedPhone ? `tel:${normalizedPhone}` : "#");
    }

    const emailLinkEl = byId("contact-email-link");
    if (emailLinkEl) {
      emailLinkEl.textContent = email;
      emailLinkEl.setAttribute("href", email ? `mailto:${email}` : "#");
    }

    const mapEl = byId("contact-map-embed");
    if (mapEl) {
      const mapUrl = resolveMapEmbedUrl(contactData, address);
      if (mapUrl) {
        mapEl.setAttribute("src", mapUrl);
      } else {
        mapEl.removeAttribute("src");
      }
    }
  }

  function renderHomeVenturesPreview(ventures) {
    const wrapper = byId("home-ventures-preview");
    if (!wrapper) return;

    const list = ensureArray(ventures)
      .filter(item => item && typeof item === "object")
      .slice(0, 6);

    if (!list.length) {
      wrapper.innerHTML = "";
      return;
    }

    wrapper.innerHTML = list.map(item => {
      const title = item.title || "";
      const status = item.status ? `Status: ${item.status}` : "";
      const summary = item.description || item.summary || "";
      return `
        <div class="swiper-slide">
          <div class="testimonial-item">
            <h3>${escapeHtml(title)}</h3>
            <h4>${escapeHtml(status)}</h4>
            <p><span>${escapeHtml(summary)}</span></p>
          </div>
        </div>
      `;
    }).join("");
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
                <p class="mb-3">${escapeHtml(item.summary || "")}</p>
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
                <p class="mb-3">${escapeHtml(item.summary || "")}</p>
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

    container.innerHTML = list.map(item => {
      const image = item.image || item.cover_image || "";
      const imageHtml = image
        ? `<img src="${escapeHtml(image)}" class="card-img-top" alt="${escapeHtml(item.title || "Venture")} cover">`
        : "";

      return `
        <div class="col-lg-4 col-md-6">
          <article id="${escapeHtml(item.id || slugify(item.title))}" class="card h-100 border-0 shadow-sm archive-entry-card">
            ${imageHtml}
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
                <h3 class="h5 mb-0">${escapeHtml(item.title || "")}</h3>
                <span class="badge ${badgeClassByStatus(item.status)}">${escapeHtml(item.status || "")}</span>
              </div>
              <p class="mb-3">${escapeHtml(item.description || item.summary || "")}</p>
              <p class="mb-3"><strong>Current role/status:</strong> ${escapeHtml(item.role || item.status || "")}</p>
              <div class="mt-auto">
                <a href="${escapeHtml(item.link || item.url || "#")}" class="btn btn-outline-primary btn-sm">View Venture</a>
              </div>
            </div>
          </article>
        </div>
      `;
    }).join("");
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

  function renderIndexPage(siteContent) {
    const profile = asObject(siteContent.profile);
    const homepage = asObject(siteContent.homepage);
    const contact = asObject(siteContent.contact);
    const timeline = ensureArray(siteContent.timeline);
    const notes = ensureArray(siteContent.notes);
    const skills = ensureArray(siteContent.skills);
    const socialLinks = ensureArray(siteContent.social_links);
    const ventures = ensureArray(siteContent.ventures);
    const profileContacts = asObject(profile.contacts);
    const primaryFocus = String(profile.primary_focus || "").trim();
    const domainFocus = String(profile.domain_focus || "").trim();
    const location = String(profile.location || "").trim();
    const role = String(profile.role || "").trim();
    const email = String(profileContacts.email || profile.email || "").trim();
    const collaboration = String(profile.collaboration || "").trim();
    const educationInstitution = String(profile.education_institution || "").trim();
    const educationDegree = String(profile.education_degree || "").trim();
    const educationPeriod = String(profile.education_period || "").trim();
    const educationLine = educationInstitution || educationDegree || educationPeriod
      ? `${educationInstitution} - ${educationDegree} (${educationPeriod})`
      : "";
    const heroTitle = String(homepage.hero_title || profile.name || "").trim();
    const heroSubtitle = String(homepage.hero_subtitle || role || profile.headline || "").trim();
    const heroNote = String(homepage.hero_note || "").trim();

    setSiteName(profile.name);
    setProfileImages(profile.profile_image_path || profile.profile_image || "");
    renderSocialLinks(socialLinks, null, { clearIfEmpty: true });
    renderHomeImages(homepage, profile);
    setText("home-hero-title", heroTitle);
    setText("home-hero-subtitle", heroSubtitle);
    setText("home-hero-note", heroNote);
    setText("home-profile-headline", profile.headline || "");
    setText("home-identity-snapshot", profile.summary || profile.bio || homepage.identity_snapshot || "");
    setText("home-primary-focus", primaryFocus);
    setText("home-domain-focus", domainFocus);
    setText("home-current-role", role);
    setText("home-location", location);
    setText("home-collaboration", collaboration);
    setLink("home-email-link", email ? `mailto:${email}` : "#", email);
    setText("home-identity-note", educationLine ? `Education: ${educationLine}` : "");
    renderIdentitySkills(skills);
    setText("home-kom-intro", homepage.kom_intro || "");
    renderHomeFeaturedProjects(homepage);
    renderHomeNotes(notes);
    renderHomeTimeline(timeline);
    renderHomeVenturesPreview(ventures);
    renderHomeContact(contact, profileContacts, location);
  }

  function renderProjectsPage(siteContent) {
    const profile = asObject(siteContent.profile);
    const projects = ensureArray(siteContent.projects);
    const knowledge = ensureArray(siteContent.knowledge);
    const socialLinks = ensureArray(siteContent.social_links);

    setSiteName(profile.name);
    setProfileImages(profile.profile_image_path || profile.profile_image || "");
    renderSocialLinks(socialLinks, null, { clearIfEmpty: true });

    const knowledgeMap = knowledge.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    renderProjectsArchive(projects, knowledgeMap);
    renderProjectsConnected(projects, knowledgeMap);
  }

  function renderKnowledgePage(siteContent) {
    const profile = asObject(siteContent.profile);
    const projects = ensureArray(siteContent.projects);
    const knowledge = ensureArray(siteContent.knowledge);
    const socialLinks = ensureArray(siteContent.social_links);

    setSiteName(profile.name);
    setProfileImages(profile.profile_image_path || profile.profile_image || "");
    renderSocialLinks(socialLinks, null, { clearIfEmpty: true });

    const projectMap = projects.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    renderKnowledgeArchive(knowledge, projectMap);
    renderKnowledgeRelated(knowledge, projectMap);
  }

  function renderVenturesPage(siteContent) {
    const profile = asObject(siteContent.profile);
    const ventures = ensureArray(siteContent.ventures);
    const socialLinks = ensureArray(siteContent.social_links);
    setSiteName(profile.name);
    setProfileImages(profile.profile_image_path || profile.profile_image || "");
    renderSocialLinks(socialLinks, null, { clearIfEmpty: true });
    renderVentures(ventures);
  }

  function renderKomPage(siteContent) {
    const profile = asObject(siteContent.profile);
    const homepage = asObject(siteContent.homepage);
    const socialLinks = ensureArray(siteContent.social_links);

    setSiteName(profile.name);
    setProfileImages(profile.profile_image_path || profile.profile_image || "");
    renderSocialLinks(socialLinks, null, { clearIfEmpty: true });
    setText("kom-page-intro", homepage.kom_intro || "");
    renderKomPrompts(siteContent["kom-config"]);
  }

  async function bootstrap() {
    let siteContent = createEmptySiteContent();
    try {
      siteContent = await loadSiteContent();
    } catch (error) {
      console.error("Site content fetch failed:", error);
    }

    console.log("SITE CONTENT:", siteContent);

    try {
      if (pageFlags.index) renderIndexPage(siteContent);
      if (pageFlags.projects) renderProjectsPage(siteContent);
      if (pageFlags.knowledge) renderKnowledgePage(siteContent);
      if (pageFlags.ventures) renderVenturesPage(siteContent);
      if (pageFlags.kom) renderKomPage(siteContent);
    } catch (error) {
      console.error("Public render sync failed:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
