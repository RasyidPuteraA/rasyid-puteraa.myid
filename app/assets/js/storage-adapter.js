(function() {
  "use strict";

  const SOURCE_PATHS = {
    profile: "data/profile.json",
    homepage: "data/homepage.json",
    projects: "data/projects.json",
    knowledge: "data/knowledge.json",
    ventures: "data/ventures.json",
    timeline: "data/timeline.json",
    notes: "data/notes.json",
    reviews: "data/reviews.json",
    contact: "data/contact.json",
    "kom-config": "data/kom-config.json"
  };

  const STORAGE_PREFIX = "mrp_data_";

  function resolvePath(source) {
    return SOURCE_PATHS[source] || source;
  }

  function storageKey(source) {
    return STORAGE_PREFIX + source;
  }

  async function loadDefault(source) {
    const path = resolvePath(source);
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load source: ${source}`);
    }
    return response.json();
  }

  async function getData(source) {
    try {
      const raw = localStorage.getItem(storageKey(source));
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      // Fallback to default file load below.
    }

    return loadDefault(source);
  }

  async function saveData(source, data) {
    if (typeof data === "undefined") {
      return getData(source);
    }
    const serialized = JSON.stringify(data);
    localStorage.setItem(storageKey(source), serialized);
    return data;
  }

  async function resetData(source) {
    localStorage.removeItem(storageKey(source));
    return loadDefault(source);
  }

  window.StorageAdapter = {
    getData,
    saveData,
    resetData,
    loadDefault,
    resolvePath,
    sourcePaths: SOURCE_PATHS
  };
})();
