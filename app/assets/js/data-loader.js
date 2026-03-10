(function() {
  "use strict";

  const ADAPTER = () => window.StorageAdapter;

  async function loadSource(source) {
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
      : ["profile", "homepage", "projects", "knowledge", "ventures", "timeline", "notes", "reviews", "contact", "kom-config"];

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
    loadReviews,
    loadContact,
    loadKomConfig
  };
})();
