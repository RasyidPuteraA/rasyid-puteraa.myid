(function() {
  "use strict";

  const SOURCE_CONFIG = {
    profile: {
      publicUrl: "/api/profile",
      adminUrl: "/api/admin/profile",
      adminMethod: "POST",
      fallbackPath: "data/profile.json"
    },
    homepage: {
      publicUrl: "/api/settings?key=homepage",
      adminUrl: "/api/admin/settings/homepage",
      adminMethod: "POST",
      fallbackPath: "data/homepage.json"
    },
    projects: {
      publicUrl: "/api/projects",
      adminUrl: "/api/admin/bulk/projects",
      adminMethod: "POST",
      fallbackPath: "data/projects.json"
    },
    knowledge: {
      publicUrl: "/api/articles",
      adminUrl: "/api/admin/bulk/knowledge",
      adminMethod: "POST",
      fallbackPath: "data/knowledge.json"
    },
    ventures: {
      publicUrl: "/api/ventures",
      adminUrl: "/api/admin/bulk/ventures",
      adminMethod: "POST",
      fallbackPath: "data/ventures.json"
    },
    timeline: {
      publicUrl: "/api/experiences",
      adminUrl: "/api/admin/settings/timeline",
      adminMethod: "POST",
      fallbackPath: "data/timeline.json"
    },
    notes: {
      publicUrl: "/api/settings?key=notes",
      adminUrl: "/api/admin/settings/notes",
      adminMethod: "POST",
      fallbackPath: "data/notes.json"
    },
    reviews: {
      publicUrl: "/api/settings?key=reviews",
      adminUrl: "/api/admin/settings/reviews",
      adminMethod: "POST",
      fallbackPath: "data/reviews.json"
    },
    contact: {
      publicUrl: "/api/settings?key=contact",
      adminUrl: "/api/admin/settings/contact",
      adminMethod: "POST",
      fallbackPath: "data/contact.json"
    },
    "kom-config": {
      publicUrl: "/api/settings?key=kom-config",
      adminUrl: "/api/admin/settings/kom-config",
      adminMethod: "POST",
      fallbackPath: "data/kom-config.json"
    },
    skills: {
      publicUrl: "/api/skills",
      adminUrl: "/api/admin/skills",
      adminMethod: "POST",
      fallbackPath: null
    },
    "social-links": {
      publicUrl: "/api/social-links",
      adminUrl: "/api/admin/social-links",
      adminMethod: "POST",
      fallbackPath: null
    }
  };

  function configFor(source) {
    return SOURCE_CONFIG[source] || null;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  async function loadDefault(source) {
    const cfg = configFor(source);
    const fallbackPath = cfg && cfg.fallbackPath ? cfg.fallbackPath : `data/${source}.json`;
    const response = await fetch(fallbackPath, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`Failed to load source: ${source}`);
    }
    return response.json();
  }

  function isEmptyData(value) {
    if (Array.isArray(value)) return value.length === 0;
    if (!value) return true;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  }

  async function getData(source) {
    const cfg = configFor(source);
    if (!cfg || !cfg.publicUrl) {
      return loadDefault(source);
    }

    try {
      const payload = await requestJson(cfg.publicUrl, { method: "GET" });
      if (typeof payload === "undefined" || payload === null) {
        return cfg.fallbackPath ? loadDefault(source) : payload;
      }

      if (isEmptyData(payload) && cfg.fallbackPath) {
        try {
          return await loadDefault(source);
        } catch {
          return payload;
        }
      }

      return payload;
    } catch (error) {
      if (!cfg.fallbackPath) {
        throw error;
      }
      return loadDefault(source);
    }
  }

  async function saveData(source, data) {
    const cfg = configFor(source);
    if (!cfg || !cfg.adminUrl) {
      throw new Error(`No admin endpoint configured for source: ${source}`);
    }

    const payload = await requestJson(cfg.adminUrl, {
      method: cfg.adminMethod || "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    });

    if (payload && Object.prototype.hasOwnProperty.call(payload, "data")) {
      return payload.data;
    }
    return payload;
  }

  async function resetData(source) {
    const defaults = await loadDefault(source);
    await saveData(source, defaults);
    return getData(source);
  }

  window.StorageAdapter = {
    getData,
    saveData,
    resetData,
    loadDefault,
    resolvePath: function(source) {
      const cfg = configFor(source);
      return cfg && cfg.fallbackPath ? cfg.fallbackPath : `data/${source}.json`;
    },
    sourcePaths: Object.keys(SOURCE_CONFIG).reduce((acc, key) => {
      acc[key] = SOURCE_CONFIG[key].fallbackPath;
      return acc;
    }, {})
  };
})();
