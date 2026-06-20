(function() {
  "use strict";

  const ADAPTER = () => window.StorageAdapter;
  const UNIFIED_ENDPOINT = "/api/site-content";
  const UNIFIED_SOURCE_MAP = Object.freeze({
    homepage: "homepage",
    profile: "profile",
    timeline: "timeline",
    notes: "notes",
    skills: "skills",
    social_links: "social_links",
    "social-links": "social_links",
    ventures: "ventures"
  });
  let unifiedSiteContentPromise = null;

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  function defaultUnifiedValue(source) {
    const key = UNIFIED_SOURCE_MAP[source] || source;
    if (key === "homepage" || key === "profile") return {};
    return [];
  }

  async function loadUnifiedSiteContent() {
    if (!unifiedSiteContentPromise) {
      unifiedSiteContentPromise = fetch(UNIFIED_ENDPOINT, {
        credentials: "same-origin",
        cache: "no-store"
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load unified site content (${response.status})`);
          }
          return response.json();
        })
        .then((payload) => (isObject(payload) ? payload : {}))
        .catch((error) => {
          unifiedSiteContentPromise = null;
          throw error;
        });
    }
    return unifiedSiteContentPromise;
  }

  async function loadUnifiedSource(source) {
    const key = UNIFIED_SOURCE_MAP[source];
    if (!key) return null;

    try {
      const payload = await loadUnifiedSiteContent();
      const value = payload[key];
      if (key === "homepage" || key === "profile") {
        return isObject(value) ? value : {};
      }
      return ensureArray(value);
    } catch (error) {
      console.warn(`Unified source fetch failed for ${source}.`, error);
      return defaultUnifiedValue(source);
    }
  }

  async function loadSource(source) {
    if (Object.prototype.hasOwnProperty.call(UNIFIED_SOURCE_MAP, source)) {
      return loadUnifiedSource(source);
    }

    if (ADAPTER() && typeof ADAPTER().getData === "function") {
      return ADAPTER().getData(source);
    }

    const fallbackPath = `data/${source}.json`;
    const response = await fetch(fallbackPath);
    if (!response.ok) {
      throw new Error(`Failed to load data source: ${source}`);
    }
    return response.json();
  }

  async function loadProfile() {
    return loadSource("profile");
  }

  async function loadHomepage() {
    return loadSource("homepage");
  }

  async function loadProjects() {
    return loadSource("projects");
  }

  async function loadKnowledge() {
    return loadSource("knowledge");
  }

  async function loadVentures() {
    return loadSource("ventures");
  }

  async function loadTimeline() {
    return loadSource("timeline");
  }

  async function loadNotes() {
    return loadSource("notes");
  }

  async function loadSkills() {
    return loadSource("skills");
  }

  async function loadSocialLinks() {
    return loadSource("social_links");
  }

  async function loadReviews() {
    return loadSource("reviews");
  }

  async function loadContact() {
    return loadSource("contact");
  }

  async function loadKomConfig() {
    return loadSource("kom-config");
  }

  async function loadAllData(sources) {
    const sourceList = Array.isArray(sources) && sources.length
      ? sources
      : [
          "profile",
          "homepage",
          "projects",
          "knowledge",
          "ventures",
          "timeline",
          "notes",
          "skills",
          "social_links",
          "reviews",
          "contact",
          "kom-config"
        ];

    const entries = await Promise.all(
      sourceList.map(async(source) => {
        const data = await loadSource(source);
        return [source, data];
      })
    );

    return Object.fromEntries(entries);
  }

  window.DataLoader = {
    loadSource,
    loadAllData,
    loadProfile,
    loadHomepage,
    loadProjects,
    loadKnowledge,
    loadVentures,
    loadTimeline,
    loadNotes,
    loadSkills,
    loadSocialLinks,
    loadReviews,
    loadContact,
    loadKomConfig
  };
})();
