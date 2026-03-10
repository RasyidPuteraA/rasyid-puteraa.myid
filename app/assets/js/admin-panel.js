(function() {
  "use strict";

  const dashboardPage = document.body && document.body.dataset.adminPage === "dashboard";
  if (!dashboardPage) return;

  const adapter = window.StorageAdapter;
  if (!adapter || typeof adapter.getData !== "function") {
    console.error("StorageAdapter is not available.");
    return;
  }

  if (window.AdminAuth && typeof window.AdminAuth.isLoggedIn === "function" && !window.AdminAuth.isLoggedIn()) {
    return;
  }

  const state = {
    profile: {},
    homepage: {},
    projects: [],
    knowledge: [],
    ventures: [],
    komConfig: {},
    selected: {
      projects: 0,
      knowledge: 0,
      ventures: 0
    }
  };

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

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function setInputValue(id, value) {
    const element = byId(id);
    if (!element) return;
    element.value = value == null ? "" : String(value);
  }

  function getInputValue(id) {
    const element = byId(id);
    if (!element) return "";
    return String(element.value || "").trim();
  }

  function parseLineArray(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .flatMap(line => line.split(","))
      .map(item => item.trim())
      .filter(Boolean);
  }

  function toLineArray(value) {
    if (Array.isArray(value)) return value.join("\n");
    if (typeof value === "string") return value;
    return "";
  }

  function setImagePreview(previewId, value, fallback) {
    const preview = byId(previewId);
    if (!preview) return;
    const resolved = String(value || "").trim() || String(fallback || "").trim();
    if (!resolved) {
      preview.setAttribute("hidden", "hidden");
      preview.removeAttribute("src");
      return;
    }
    preview.removeAttribute("hidden");
    preview.setAttribute("src", resolved);
  }

  function syncImagePreviewFromInput(inputId, previewId, fallback) {
    const value = getInputValue(inputId);
    setImagePreview(previewId, value, fallback);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toTitleCase(value) {
    return String(value || "")
      .replace(/-/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(token => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function parseTopicClusters(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split("|");
        if (parts.length >= 2) {
          const label = parts[0].trim();
          const query = parts.slice(1).join("|").trim();
          return {
            label: label || toTitleCase(query),
            query: query || label
          };
        }
        return {
          label: toTitleCase(line),
          query: line.toLowerCase()
        };
      })
      .filter(item => item.query);
  }

  function formatTopicClusters(clusters) {
    if (!Array.isArray(clusters)) return "";
    return clusters.map(item => {
      const label = item && item.label ? item.label : "";
      const query = item && item.query ? item.query : label;
      return `${label} | ${query}`.trim();
    }).join("\n");
  }

  function parseStructuredSections(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split("|").map(item => item.trim());
        const title = parts[0] || "Section";
        const type = (parts[1] || "paragraph").toLowerCase();
        const payload = parts.slice(2).join("|").trim();

        if (type === "list") {
          return {
            title,
            type: "list",
            items: payload.split(";").map(item => item.trim()).filter(Boolean)
          };
        }

        if (type === "steps") {
          return {
            title,
            type: "steps",
            steps: payload.split(";").map(item => item.trim()).filter(Boolean)
          };
        }

        return {
          title,
          type: "paragraph",
          content: payload
        };
      });
  }

  function formatStructuredSections(sections) {
    return ensureArray(sections).map(section => {
      const item = asObject(section);
      const title = item.title || "Section";
      const type = String(item.type || "paragraph").toLowerCase();

      if (type === "list") {
        return `${title} | list | ${ensureArray(item.items).join("; ")}`;
      }

      if (type === "steps") {
        return `${title} | steps | ${ensureArray(item.steps).join("; ")}`;
      }

      return `${title} | paragraph | ${item.content || ""}`;
    }).join("\n");
  }

  function bindImageUploaders() {
    const uploadInputs = document.querySelectorAll(".admin-image-upload");
    if (!uploadInputs.length) return;

    uploadInputs.forEach(input => {
      const targetInputId = input.getAttribute("data-target-input");
      const previewId = input.getAttribute("data-preview-target");
      const targetInput = targetInputId ? byId(targetInputId) : null;

      if (targetInput && previewId) {
        const updatePreviewFromInput = function() {
          setImagePreview(previewId, targetInput.value, "");
        };
        targetInput.addEventListener("input", updatePreviewFromInput);
        targetInput.addEventListener("change", updatePreviewFromInput);
      }

      input.addEventListener("change", function() {
        const file = this.files && this.files[0];
        if (!file) return;

        const targetInputId = this.getAttribute("data-target-input");
        const previewId = this.getAttribute("data-preview-target");
        const moduleName = this.getAttribute("data-module") || "profile";

        if (!targetInputId) return;
        const inputElement = this;

        const maxSizeBytes = 2.5 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          showStatus(moduleName, "Image is too large. Use files up to 2.5MB.", "error");
          this.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
          const dataUrl = String(event.target && event.target.result ? event.target.result : "");
          if (!dataUrl) {
            showStatus(moduleName, "Failed to read selected image.", "error");
            return;
          }
          setInputValue(targetInputId, dataUrl);
          if (previewId) setImagePreview(previewId, dataUrl, "");
          showStatus(moduleName, "Image loaded. Click Save to persist.", "success");
          inputElement.value = "";
        };
        reader.onerror = function() {
          showStatus(moduleName, "Failed to load image file.", "error");
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function showStatus(moduleName, message, type) {
    const statusEl = byId(`${moduleName}-status`);
    if (!statusEl) return;

    statusEl.className = "alert py-2 px-3 mb-0 admin-module-status";
    statusEl.classList.add(type === "error" ? "alert-danger" : type === "info" ? "alert-secondary" : "alert-success");
    statusEl.textContent = message;
    statusEl.hidden = false;
  }

  function hideStatus(moduleName) {
    const statusEl = byId(`${moduleName}-status`);
    if (!statusEl) return;
    statusEl.hidden = true;
  }

  function isDuplicateId(items, activeIndex, candidateId) {
    const normalized = String(candidateId || "").trim().toLowerCase();
    return items.some((item, index) => {
      if (index === activeIndex) return false;
      return String(item.id || "").trim().toLowerCase() === normalized;
    });
  }

  function generateUniqueId(prefix, items) {
    const existing = new Set(items.map(item => String(item.id || "").toLowerCase()));
    let counter = 1;
    let generated = `${prefix}-${String(counter).padStart(3, "0")}`;

    while (existing.has(generated.toLowerCase())) {
      counter += 1;
      generated = `${prefix}-${String(counter).padStart(3, "0")}`;
    }

    return generated;
  }

  function renderSelectableList(kind, listElementId, emptyMessage) {
    const listEl = byId(listElementId);
    if (!listEl) return;

    const items = ensureArray(state[kind]);
    if (!items.length) {
      listEl.innerHTML = `<div class="small text-muted admin-list-empty">${escapeHtml(emptyMessage)}</div>`;
      return;
    }

    const selectedIndex = state.selected[kind];
    listEl.innerHTML = items.map((item, index) => {
      const activeClass = index === selectedIndex ? "active" : "";
      const title = item.title || item.name || item.id || `Item ${index + 1}`;
      const subtitle = item.id || item.category || item.type || "No metadata";
      return `
        <button type="button" class="list-group-item list-group-item-action admin-item-btn ${activeClass}" data-kind="${escapeHtml(kind)}" data-index="${index}">
          <span class="admin-item-title">${escapeHtml(title)}</span>
          <small class="admin-item-subtitle">${escapeHtml(subtitle)}</small>
        </button>
      `;
    }).join("");
  }

  function renderProfileForm() {
    const profile = asObject(state.profile);
    const skills = profile.skills || profile.focus_areas || [];
    const hobbies = profile.hobbies || [];
    const interests = profile.interests || [];

    setInputValue("profile-name", profile.name);
    setInputValue("profile-headline", profile.headline);
    setInputValue("profile-bio", profile.bio);
    setInputValue("profile-image", profile.profile_image || "");
    setInputValue("profile-skills", toLineArray(skills));
    setInputValue("profile-hobbies", toLineArray(hobbies));
    setInputValue("profile-interests", toLineArray(interests));
    syncImagePreviewFromInput("profile-image", "profile-image-preview", "assets/img/my-profile-img.jpg");
  }

  function renderHomepageForm() {
    const homepage = asObject(state.homepage);
    const hero = asObject(homepage.hero);

    setInputValue("homepage-hero-title", homepage.hero_title || hero.title || "");
    setInputValue("homepage-hero-subtitle", homepage.hero_subtitle || hero.subtitle || "");
    setInputValue("homepage-hero-image", homepage.hero_background_image || homepage.hero_image || "");
    setInputValue("homepage-about-image", homepage.about_profile_image || "");
    setInputValue("homepage-identity-snapshot", homepage.identity_snapshot || "");
    setInputValue("homepage-featured-projects", toLineArray(homepage.featured_projects || []));
    setInputValue("homepage-kom-intro", homepage.kom_intro || "");
    syncImagePreviewFromInput("homepage-hero-image", "homepage-hero-image-preview", "assets/img/hero-bg.jpg");
    syncImagePreviewFromInput("homepage-about-image", "homepage-about-image-preview", "assets/img/my-profile-img.jpg");
  }

  function renderProjectsForm() {
    const items = ensureArray(state.projects);
    const active = items[state.selected.projects];

    if (!active) {
      setInputValue("projects-id", "");
      setInputValue("projects-title", "");
      setInputValue("projects-category", "");
      setInputValue("projects-summary", "");
      setInputValue("projects-status", "");
      setInputValue("projects-date", "");
      setInputValue("projects-likes", "");
      setInputValue("projects-cover-image", "");
      setInputValue("projects-author", "");
      setInputValue("projects-content", "");
      setInputValue("projects-sections", "");
      setInputValue("projects-tags", "");
      setInputValue("projects-related-knowledge", "");
      setInputValue("projects-url", "");
      setImagePreview("projects-cover-preview", "", "assets/img/portfolio/app-1.jpg");
      return;
    }

    setInputValue("projects-id", active.id);
    setInputValue("projects-title", active.title);
    setInputValue("projects-category", active.category);
    setInputValue("projects-summary", active.summary);
    setInputValue("projects-status", active.status);
    setInputValue("projects-date", active.date || "");
    setInputValue("projects-likes", active.likes == null ? "" : active.likes);
    setInputValue("projects-cover-image", active.cover_image || "");
    setInputValue("projects-author", active.author || "");
    setInputValue("projects-content", active.content || "");
    setInputValue("projects-sections", formatStructuredSections(active.sections));
    setInputValue("projects-tags", toLineArray(active.tags));
    setInputValue("projects-related-knowledge", toLineArray(active.related_knowledge));
    setInputValue("projects-url", active.url);
    syncImagePreviewFromInput("projects-cover-image", "projects-cover-preview", "assets/img/portfolio/app-1.jpg");
  }

  function renderKnowledgeForm() {
    const items = ensureArray(state.knowledge);
    const active = items[state.selected.knowledge];

    if (!active) {
      setInputValue("knowledge-id", "");
      setInputValue("knowledge-title", "");
      setInputValue("knowledge-type", "");
      setInputValue("knowledge-category", "");
      setInputValue("knowledge-summary", "");
      setInputValue("knowledge-date", "");
      setInputValue("knowledge-likes", "");
      setInputValue("knowledge-cover-image", "");
      setInputValue("knowledge-author", "");
      setInputValue("knowledge-content", "");
      setInputValue("knowledge-sections", "");
      setInputValue("knowledge-tags", "");
      setInputValue("knowledge-related-projects", "");
      setInputValue("knowledge-url", "");
      setImagePreview("knowledge-cover-preview", "", "assets/img/portfolio/books-1.jpg");
      return;
    }

    setInputValue("knowledge-id", active.id);
    setInputValue("knowledge-title", active.title);
    setInputValue("knowledge-type", active.type);
    setInputValue("knowledge-category", active.category);
    setInputValue("knowledge-summary", active.summary);
    setInputValue("knowledge-date", active.date || "");
    setInputValue("knowledge-likes", active.likes == null ? "" : active.likes);
    setInputValue("knowledge-cover-image", active.cover_image || "");
    setInputValue("knowledge-author", active.author || "");
    setInputValue("knowledge-content", active.content || "");
    setInputValue("knowledge-sections", formatStructuredSections(active.sections));
    setInputValue("knowledge-tags", toLineArray(active.tags));
    setInputValue("knowledge-related-projects", toLineArray(active.related_projects));
    setInputValue("knowledge-url", active.url);
    syncImagePreviewFromInput("knowledge-cover-image", "knowledge-cover-preview", "assets/img/portfolio/books-1.jpg");
  }

  function renderVenturesForm() {
    const items = ensureArray(state.ventures);
    const active = items[state.selected.ventures];

    if (!active) {
      setInputValue("ventures-id", "");
      setInputValue("ventures-title", "");
      setInputValue("ventures-description", "");
      setInputValue("ventures-status", "");
      setInputValue("ventures-link", "");
      setInputValue("ventures-image", "");
      setImagePreview("ventures-image-preview", "", "assets/img/portfolio/product-1.jpg");
      return;
    }

    setInputValue("ventures-id", active.id);
    setInputValue("ventures-title", active.title);
    setInputValue("ventures-description", active.description || active.summary || "");
    setInputValue("ventures-status", active.status);
    setInputValue("ventures-link", active.link || active.url || "");
    setInputValue("ventures-image", active.image || active.cover_image || "");
    syncImagePreviewFromInput("ventures-image", "ventures-image-preview", "assets/img/portfolio/product-1.jpg");
  }

  function renderKomConfigForm() {
    const config = asObject(state.komConfig);
    const ui = asObject(config.ui);
    const prompts = config.suggested_prompts || ui.suggested_prompts || [];
    const clusters = ui.topic_clusters || config.topic_clusters || [];

    setInputValue("kom-config-prompts", toLineArray(prompts));
    setInputValue("kom-config-clusters", formatTopicClusters(clusters));
  }

  function refreshProjectsModule() {
    const items = ensureArray(state.projects);
    if (state.selected.projects >= items.length) {
      state.selected.projects = Math.max(items.length - 1, 0);
    }
    renderSelectableList("projects", "projects-list", "No project data available.");
    renderProjectsForm();
  }

  function refreshKnowledgeModule() {
    const items = ensureArray(state.knowledge);
    if (state.selected.knowledge >= items.length) {
      state.selected.knowledge = Math.max(items.length - 1, 0);
    }
    renderSelectableList("knowledge", "knowledge-list", "No knowledge data available.");
    renderKnowledgeForm();
  }

  function refreshVenturesModule() {
    const items = ensureArray(state.ventures);
    if (state.selected.ventures >= items.length) {
      state.selected.ventures = Math.max(items.length - 1, 0);
    }
    renderSelectableList("ventures", "ventures-list", "No venture data available.");
    renderVenturesForm();
  }

  async function saveProfile() {
    try {
      const name = getInputValue("profile-name");
      const headline = getInputValue("profile-headline");
      const bio = getInputValue("profile-bio");

      if (!name) {
        showStatus("profile", "Name is required.", "error");
        return;
      }

      state.profile = Object.assign({}, asObject(state.profile), {
        name,
        headline,
        bio,
        profile_image: getInputValue("profile-image"),
        skills: parseLineArray(getInputValue("profile-skills")),
        hobbies: parseLineArray(getInputValue("profile-hobbies")),
        interests: parseLineArray(getInputValue("profile-interests")),
        focus_areas: parseLineArray(getInputValue("profile-skills")),
        updated_at: todayIso()
      });

      await adapter.saveData("profile", state.profile);
      showStatus("profile", "Profile data saved to localStorage.", "success");
    } catch (error) {
      showStatus("profile", "Failed to save profile data.", "error");
    }
  }

  async function resetProfile() {
    try {
      state.profile = await adapter.resetData("profile");
      renderProfileForm();
      showStatus("profile", "Profile data reset to default JSON.", "info");
    } catch (error) {
      showStatus("profile", "Failed to reset profile data.", "error");
    }
  }

  async function saveHomepage() {
    try {
      const heroTitle = getInputValue("homepage-hero-title");
      const heroSubtitle = getInputValue("homepage-hero-subtitle");

      if (!heroTitle) {
        showStatus("homepage", "Hero title is required.", "error");
        return;
      }

      const featuredProjects = parseLineArray(getInputValue("homepage-featured-projects"));
      const previous = asObject(state.homepage);
      const previousHero = asObject(previous.hero);

      state.homepage = Object.assign({}, previous, {
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        hero_background_image: getInputValue("homepage-hero-image"),
        hero_image: getInputValue("homepage-hero-image"),
        about_profile_image: getInputValue("homepage-about-image"),
        identity_snapshot: getInputValue("homepage-identity-snapshot"),
        featured_projects: featuredProjects,
        kom_intro: getInputValue("homepage-kom-intro"),
        hero: Object.assign({}, previousHero, {
          title: heroTitle,
          subtitle: heroSubtitle
        }),
        updated_at: todayIso()
      });

      await adapter.saveData("homepage", state.homepage);
      showStatus("homepage", "Homepage data saved to localStorage.", "success");
    } catch (error) {
      showStatus("homepage", "Failed to save homepage data.", "error");
    }
  }

  async function resetHomepage() {
    try {
      state.homepage = await adapter.resetData("homepage");
      renderHomepageForm();
      showStatus("homepage", "Homepage data reset to default JSON.", "info");
    } catch (error) {
      showStatus("homepage", "Failed to reset homepage data.", "error");
    }
  }

  async function saveProjects() {
    try {
      const items = ensureArray(state.projects);
      if (!items.length) {
        showStatus("projects", "No project item selected.", "error");
        return;
      }

      const index = state.selected.projects;
      const id = getInputValue("projects-id");
      const title = getInputValue("projects-title");
      if (!id || !title) {
        showStatus("projects", "Project id and title are required.", "error");
        return;
      }

      if (isDuplicateId(items, index, id)) {
        showStatus("projects", "Project id must be unique.", "error");
        return;
      }

      const current = asObject(items[index]);
      const parsedLikes = Number.parseInt(getInputValue("projects-likes"), 10);
      const resolvedLikes = Number.isFinite(parsedLikes) && parsedLikes >= 0
        ? parsedLikes
        : (Number.parseInt(current.likes, 10) >= 0 ? Number.parseInt(current.likes, 10) : 0);
      const resolvedUrl = getInputValue("projects-url") || `project-detail.html?id=${encodeURIComponent(id)}`;
      items[index] = Object.assign({}, current, {
        id,
        title,
        category: getInputValue("projects-category"),
        summary: getInputValue("projects-summary"),
        status: getInputValue("projects-status"),
        date: getInputValue("projects-date"),
        likes: resolvedLikes,
        cover_image: getInputValue("projects-cover-image"),
        author: getInputValue("projects-author"),
        content: getInputValue("projects-content"),
        sections: parseStructuredSections(getInputValue("projects-sections")),
        tags: parseLineArray(getInputValue("projects-tags")),
        related_knowledge: parseLineArray(getInputValue("projects-related-knowledge")),
        url: resolvedUrl,
        updated_at: todayIso()
      });

      state.projects = items;
      await adapter.saveData("projects", state.projects);
      refreshProjectsModule();
      showStatus("projects", "Project data saved to localStorage.", "success");
    } catch (error) {
      showStatus("projects", "Failed to save project data.", "error");
    }
  }

  async function resetProjects() {
    try {
      state.projects = ensureArray(await adapter.resetData("projects"));
      state.selected.projects = 0;
      refreshProjectsModule();
      showStatus("projects", "Projects reset to default JSON.", "info");
    } catch (error) {
      showStatus("projects", "Failed to reset projects data.", "error");
    }
  }

  async function addProject() {
    const items = ensureArray(state.projects);
    const generatedId = generateUniqueId("prj-new", items);
    const newItem = {
      id: generatedId,
      title: "New Project Placeholder",
      category: "Engineering Projects",
      summary: "Describe this project scope and objective.",
      status: "Draft",
      date: todayIso(),
      likes: 0,
      cover_image: "assets/img/portfolio/app-1.jpg",
      author: "Muhammad Rasyid Putera Agung",
      content: "Write the full project detail content here.",
      sections: [
        {
          title: "Context and Goal",
          type: "paragraph",
          content: "Describe context and goal."
        }
      ],
      tags: ["new"],
      related_knowledge: [],
      url: `project-detail.html?id=${encodeURIComponent(generatedId)}`
    };

    items.push(newItem);
    state.projects = items;
    state.selected.projects = items.length - 1;

    try {
      await adapter.saveData("projects", state.projects);
      refreshProjectsModule();
      showStatus("projects", "New project added. Update fields and click Save.", "success");
    } catch (error) {
      showStatus("projects", "Failed to add new project.", "error");
    }
  }

  async function deleteProject() {
    const items = ensureArray(state.projects);
    if (!items.length) {
      showStatus("projects", "No project available to delete.", "error");
      return;
    }

    const index = state.selected.projects;
    const selected = items[index];
    const allowDelete = window.confirm(`Delete project "${selected.title || selected.id}"?`);
    if (!allowDelete) return;

    items.splice(index, 1);
    state.projects = items;
    state.selected.projects = Math.max(index - 1, 0);

    try {
      await adapter.saveData("projects", state.projects);
      refreshProjectsModule();
      showStatus("projects", "Project deleted successfully.", "info");
    } catch (error) {
      showStatus("projects", "Failed to delete project.", "error");
    }
  }

  async function saveKnowledge() {
    try {
      const items = ensureArray(state.knowledge);
      if (!items.length) {
        showStatus("knowledge", "No knowledge entry selected.", "error");
        return;
      }

      const index = state.selected.knowledge;
      const id = getInputValue("knowledge-id");
      const title = getInputValue("knowledge-title");
      if (!id || !title) {
        showStatus("knowledge", "Knowledge id and title are required.", "error");
        return;
      }

      if (isDuplicateId(items, index, id)) {
        showStatus("knowledge", "Knowledge id must be unique.", "error");
        return;
      }

      const current = asObject(items[index]);
      const parsedLikes = Number.parseInt(getInputValue("knowledge-likes"), 10);
      const resolvedLikes = Number.isFinite(parsedLikes) && parsedLikes >= 0
        ? parsedLikes
        : (Number.parseInt(current.likes, 10) >= 0 ? Number.parseInt(current.likes, 10) : 0);
      const resolvedUrl = getInputValue("knowledge-url") || `knowledge-detail.html?id=${encodeURIComponent(id)}`;
      items[index] = Object.assign({}, current, {
        id,
        title,
        type: getInputValue("knowledge-type"),
        category: getInputValue("knowledge-category"),
        summary: getInputValue("knowledge-summary"),
        date: getInputValue("knowledge-date"),
        likes: resolvedLikes,
        cover_image: getInputValue("knowledge-cover-image"),
        author: getInputValue("knowledge-author"),
        content: getInputValue("knowledge-content"),
        sections: parseStructuredSections(getInputValue("knowledge-sections")),
        tags: parseLineArray(getInputValue("knowledge-tags")),
        related_projects: parseLineArray(getInputValue("knowledge-related-projects")),
        url: resolvedUrl,
        updated_at: todayIso()
      });

      state.knowledge = items;
      await adapter.saveData("knowledge", state.knowledge);
      refreshKnowledgeModule();
      showStatus("knowledge", "Knowledge data saved to localStorage.", "success");
    } catch (error) {
      showStatus("knowledge", "Failed to save knowledge data.", "error");
    }
  }

  async function resetKnowledge() {
    try {
      state.knowledge = ensureArray(await adapter.resetData("knowledge"));
      state.selected.knowledge = 0;
      refreshKnowledgeModule();
      showStatus("knowledge", "Knowledge entries reset to default JSON.", "info");
    } catch (error) {
      showStatus("knowledge", "Failed to reset knowledge data.", "error");
    }
  }

  async function addKnowledge() {
    const items = ensureArray(state.knowledge);
    const generatedId = generateUniqueId("knw-new", items);
    const newItem = {
      id: generatedId,
      title: "New Knowledge Entry",
      type: "note",
      category: "Learning Notes",
      summary: "Describe key points for this knowledge entry.",
      date: todayIso(),
      likes: 0,
      cover_image: "assets/img/portfolio/books-1.jpg",
      author: "Muhammad Rasyid Putera Agung",
      content: "Write the main knowledge content here.",
      sections: [
        {
          title: "Abstract",
          type: "paragraph",
          content: "Write concise abstract."
        }
      ],
      tags: ["new"],
      related_projects: [],
      url: `knowledge-detail.html?id=${encodeURIComponent(generatedId)}`
    };

    items.push(newItem);
    state.knowledge = items;
    state.selected.knowledge = items.length - 1;

    try {
      await adapter.saveData("knowledge", state.knowledge);
      refreshKnowledgeModule();
      showStatus("knowledge", "New knowledge entry added. Update fields and click Save.", "success");
    } catch (error) {
      showStatus("knowledge", "Failed to add new knowledge entry.", "error");
    }
  }

  async function deleteKnowledge() {
    const items = ensureArray(state.knowledge);
    if (!items.length) {
      showStatus("knowledge", "No knowledge entry available to delete.", "error");
      return;
    }

    const index = state.selected.knowledge;
    const selected = items[index];
    const allowDelete = window.confirm(`Delete knowledge "${selected.title || selected.id}"?`);
    if (!allowDelete) return;

    items.splice(index, 1);
    state.knowledge = items;
    state.selected.knowledge = Math.max(index - 1, 0);

    try {
      await adapter.saveData("knowledge", state.knowledge);
      refreshKnowledgeModule();
      showStatus("knowledge", "Knowledge entry deleted successfully.", "info");
    } catch (error) {
      showStatus("knowledge", "Failed to delete knowledge entry.", "error");
    }
  }

  async function saveVentures() {
    try {
      const items = ensureArray(state.ventures);
      if (!items.length) {
        showStatus("ventures", "No venture selected.", "error");
        return;
      }

      const index = state.selected.ventures;
      const id = getInputValue("ventures-id");
      const title = getInputValue("ventures-title");
      if (!id || !title) {
        showStatus("ventures", "Venture id and title are required.", "error");
        return;
      }

      if (isDuplicateId(items, index, id)) {
        showStatus("ventures", "Venture id must be unique.", "error");
        return;
      }

      const description = getInputValue("ventures-description");
      const link = getInputValue("ventures-link");
      const current = asObject(items[index]);

      items[index] = Object.assign({}, current, {
        id,
        title,
        description,
        summary: description,
        status: getInputValue("ventures-status"),
        image: getInputValue("ventures-image"),
        cover_image: getInputValue("ventures-image"),
        link,
        url: link,
        updated_at: todayIso()
      });

      state.ventures = items;
      await adapter.saveData("ventures", state.ventures);
      refreshVenturesModule();
      showStatus("ventures", "Venture data saved to localStorage.", "success");
    } catch (error) {
      showStatus("ventures", "Failed to save venture data.", "error");
    }
  }

  async function resetVentures() {
    try {
      state.ventures = ensureArray(await adapter.resetData("ventures"));
      state.selected.ventures = 0;
      refreshVenturesModule();
      showStatus("ventures", "Ventures reset to default JSON.", "info");
    } catch (error) {
      showStatus("ventures", "Failed to reset ventures data.", "error");
    }
  }

  async function addVenture() {
    const items = ensureArray(state.ventures);
    const newItem = {
      id: generateUniqueId("vtr-new", items),
      title: "New Venture Placeholder",
      description: "Describe venture focus and current direction.",
      status: "Draft",
      image: "assets/img/portfolio/product-1.jpg",
      cover_image: "assets/img/portfolio/product-1.jpg",
      link: "ventures.html#new-venture",
      url: "ventures.html#new-venture"
    };

    items.push(newItem);
    state.ventures = items;
    state.selected.ventures = items.length - 1;

    try {
      await adapter.saveData("ventures", state.ventures);
      refreshVenturesModule();
      showStatus("ventures", "New venture added. Update fields and click Save.", "success");
    } catch (error) {
      showStatus("ventures", "Failed to add new venture.", "error");
    }
  }

  async function deleteVenture() {
    const items = ensureArray(state.ventures);
    if (!items.length) {
      showStatus("ventures", "No venture available to delete.", "error");
      return;
    }

    const index = state.selected.ventures;
    const selected = items[index];
    const allowDelete = window.confirm(`Delete venture "${selected.title || selected.id}"?`);
    if (!allowDelete) return;

    items.splice(index, 1);
    state.ventures = items;
    state.selected.ventures = Math.max(index - 1, 0);

    try {
      await adapter.saveData("ventures", state.ventures);
      refreshVenturesModule();
      showStatus("ventures", "Venture deleted successfully.", "info");
    } catch (error) {
      showStatus("ventures", "Failed to delete venture.", "error");
    }
  }

  async function saveKomConfig() {
    try {
      const prompts = parseLineArray(getInputValue("kom-config-prompts"));
      const clusters = parseTopicClusters(getInputValue("kom-config-clusters"));

      if (!clusters.length) {
        showStatus("kom-config", "At least one topic cluster is required.", "error");
        return;
      }

      const previous = asObject(state.komConfig);
      const previousUi = asObject(previous.ui);

      state.komConfig = Object.assign({}, previous, {
        suggested_prompts: prompts,
        ui: Object.assign({}, previousUi, {
          suggested_prompts: prompts,
          topic_clusters: clusters
        }),
        updated_at: todayIso()
      });

      await adapter.saveData("kom-config", state.komConfig);
      renderKomConfigForm();
      showStatus("kom-config", "KOM config saved to localStorage.", "success");
    } catch (error) {
      showStatus("kom-config", "Failed to save KOM config.", "error");
    }
  }

  async function resetKomConfig() {
    try {
      state.komConfig = asObject(await adapter.resetData("kom-config"));
      renderKomConfigForm();
      showStatus("kom-config", "KOM config reset to default JSON.", "info");
    } catch (error) {
      showStatus("kom-config", "Failed to reset KOM config.", "error");
    }
  }

  function bindListSelection() {
    const projectsList = byId("projects-list");
    const knowledgeList = byId("knowledge-list");
    const venturesList = byId("ventures-list");

    if (projectsList) {
      projectsList.addEventListener("click", function(event) {
        const button = event.target.closest("[data-kind='projects']");
        if (!button) return;
        state.selected.projects = Number(button.getAttribute("data-index")) || 0;
        hideStatus("projects");
        refreshProjectsModule();
      });
    }

    if (knowledgeList) {
      knowledgeList.addEventListener("click", function(event) {
        const button = event.target.closest("[data-kind='knowledge']");
        if (!button) return;
        state.selected.knowledge = Number(button.getAttribute("data-index")) || 0;
        hideStatus("knowledge");
        refreshKnowledgeModule();
      });
    }

    if (venturesList) {
      venturesList.addEventListener("click", function(event) {
        const button = event.target.closest("[data-kind='ventures']");
        if (!button) return;
        state.selected.ventures = Number(button.getAttribute("data-index")) || 0;
        hideStatus("ventures");
        refreshVenturesModule();
      });
    }
  }

  function bindActions() {
    const actionMap = [
      ["profile-save-btn", saveProfile],
      ["profile-reset-btn", resetProfile],
      ["homepage-save-btn", saveHomepage],
      ["homepage-reset-btn", resetHomepage],
      ["projects-save-btn", saveProjects],
      ["projects-reset-btn", resetProjects],
      ["projects-add-btn", addProject],
      ["projects-delete-btn", deleteProject],
      ["knowledge-save-btn", saveKnowledge],
      ["knowledge-reset-btn", resetKnowledge],
      ["knowledge-add-btn", addKnowledge],
      ["knowledge-delete-btn", deleteKnowledge],
      ["ventures-save-btn", saveVentures],
      ["ventures-reset-btn", resetVentures],
      ["ventures-add-btn", addVenture],
      ["ventures-delete-btn", deleteVenture],
      ["kom-config-save-btn", saveKomConfig],
      ["kom-config-reset-btn", resetKomConfig]
    ];

    actionMap.forEach(([id, handler]) => {
      const element = byId(id);
      if (!element) return;
      element.addEventListener("click", function(event) {
        event.preventDefault();
        handler();
      });
    });

    bindListSelection();
    bindImageUploaders();
  }

  function renderAllModules() {
    renderProfileForm();
    renderHomepageForm();
    refreshProjectsModule();
    refreshKnowledgeModule();
    refreshVenturesModule();
    renderKomConfigForm();
  }

  async function initialize() {
    try {
      const loaded = await Promise.all([
        adapter.getData("profile"),
        adapter.getData("homepage"),
        adapter.getData("projects"),
        adapter.getData("knowledge"),
        adapter.getData("ventures"),
        adapter.getData("kom-config")
      ]);

      state.profile = asObject(loaded[0]);
      state.homepage = asObject(loaded[1]);
      state.projects = ensureArray(loaded[2]);
      state.knowledge = ensureArray(loaded[3]);
      state.ventures = ensureArray(loaded[4]);
      state.komConfig = asObject(loaded[5]);

      renderAllModules();
      showStatus("profile", "Profile source loaded.", "info");
      showStatus("homepage", "Homepage source loaded.", "info");
      showStatus("projects", "Projects source loaded.", "info");
      showStatus("knowledge", "Knowledge source loaded.", "info");
      showStatus("ventures", "Ventures source loaded.", "info");
      showStatus("kom-config", "KOM config source loaded.", "info");
    } catch (error) {
      console.error(error);
      const initStatus = byId("admin-init-status");
      if (initStatus) {
        initStatus.hidden = false;
        initStatus.textContent = "Failed to load one or more data sources. Check /data JSON files.";
      }
    }
  }

  bindActions();
  initialize();
})();
