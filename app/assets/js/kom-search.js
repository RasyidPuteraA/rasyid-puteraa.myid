/**
 * KOM Smart Search (Client-side)
 * Search and ranking over unified static JSON archives.
 */
(function() {
  "use strict";

  const queryInput = document.getElementById("kom-search-input");
  const searchBtn = document.getElementById("kom-search-btn");
  const clearBtn = document.getElementById("kom-search-clear-btn");
  const promptButtons = document.querySelectorAll(".kom-prompt-btn");
  const topicContainer = document.getElementById("kom-topic-clusters");
  const filterButtons = document.querySelectorAll(".kom-filter-btn");

  const summaryEl = document.getElementById("kom-result-summary");
  const initialStateEl = document.getElementById("kom-initial-state");
  const initialTextEl = document.getElementById("kom-initial-text");
  const emptyStateEl = document.getElementById("kom-empty-state");
  const groupedResultsEl = document.getElementById("kom-grouped-results");

  const projectGroupEl = document.getElementById("kom-project-group");
  const knowledgeGroupEl = document.getElementById("kom-knowledge-group");

  const projectsCountEl = document.getElementById("kom-project-count");
  const knowledgeCountEl = document.getElementById("kom-knowledge-count");
  const projectsResultEl = document.getElementById("kom-project-results");
  const knowledgeResultEl = document.getElementById("kom-knowledge-results");

  if (!queryInput || !searchBtn || !clearBtn) return;

  const DEFAULT_WEIGHTS = {
    title_exact: 140,
    title_prefix: 100,
    title_contains: 75,
    tag_match: 70,
    category_match: 45,
    type_status_match: 30,
    summary_match: 18,
    title_word_match: 48,
    title_partial_match: 34,
    tag_partial_match: 30,
    category_word_match: 24,
    category_partial_match: 20,
    type_status_term_match: 14,
    summary_term_match: 8,
    full_term_coverage_bonus: 24,
    matched_field_bonus: 3
  };

  const state = {
    projects: [],
    knowledge: [],
    projectMap: {},
    knowledgeMap: {},
    sources: {
      profile: null,
      homepage: null,
      projects: [],
      knowledge: [],
      ventures: [],
      timeline: [],
      notes: [],
      reviews: [],
      contact: null,
      komConfig: null
    },
    sourceCatalog: {},
    loaded: false,
    activeFilter: "all",
    lastQuery: "",
    lastProjectMatches: [],
    lastKnowledgeMatches: [],
    hasSearched: false
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .trim();
  }

  function ensureArrayData(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function containsWord(text, word) {
    if (!text || !word) return false;
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
    return regex.test(text);
  }

  function toTerms(query) {
    const tokens = normalize(query).match(/[a-z0-9-]+/g);
    return tokens || [];
  }

  function toTitleCase(text) {
    return text
      .split(" ")
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function simplifyCategory(category) {
    return normalize(category)
      .replace(/\//g, " ")
      .replace(/projects|notes|reviews/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getWeights() {
    const configWeights = state.sources.komConfig && state.sources.komConfig.search
      ? state.sources.komConfig.search.weights
      : null;
    return Object.assign({}, DEFAULT_WEIGHTS, configWeights || {});
  }

  function relevanceLabel(score) {
    if (score >= 130) return "High";
    if (score >= 80) return "Medium";
    return "Low";
  }

  function relevanceClass(score) {
    if (score >= 130) return "kom-relevance-high";
    if (score >= 80) return "kom-relevance-medium";
    return "kom-relevance-low";
  }

  function scoreMatch(item, query, terms, kind) {
    const weights = getWeights();
    const title = normalize(item.title);
    const category = normalize(item.category);
    const summary = normalize(item.summary);
    const tags = (item.tags || []).map(tag => normalize(tag).replace(/-/g, " "));
    const typeOrStatus = normalize(kind === "knowledge" ? item.type : item.status);

    let score = 0;
    let matchedTermCount = 0;
    const matchedFields = new Set();

    if (query) {
      if (title === query) {
        score += weights.title_exact;
        matchedFields.add("title");
      } else if (title.startsWith(query)) {
        score += weights.title_prefix;
        matchedFields.add("title");
      } else if (title.includes(query)) {
        score += weights.title_contains;
        matchedFields.add("title");
      }

      if (tags.includes(query)) {
        score += weights.tag_match;
        matchedFields.add("tags");
      }

      if (category.includes(query)) {
        score += weights.category_match;
        matchedFields.add("category");
      }

      if (typeOrStatus && typeOrStatus.includes(query)) {
        score += weights.type_status_match;
        matchedFields.add("type-status");
      }

      if (summary.includes(query)) {
        score += weights.summary_match;
        matchedFields.add("summary");
      }
    }

    terms.forEach(term => {
      let termMatched = false;

      if (containsWord(title, term)) {
        score += weights.title_word_match;
        termMatched = true;
        matchedFields.add("title");
      } else if (title.includes(term)) {
        score += weights.title_partial_match;
        termMatched = true;
        matchedFields.add("title");
      }

      if (tags.includes(term)) {
        score += weights.tag_match;
        termMatched = true;
        matchedFields.add("tags");
      } else if (tags.some(tag => tag.includes(term))) {
        score += weights.tag_partial_match;
        termMatched = true;
        matchedFields.add("tags");
      }

      if (containsWord(category, term)) {
        score += weights.category_word_match;
        termMatched = true;
        matchedFields.add("category");
      } else if (category.includes(term)) {
        score += weights.category_partial_match;
        termMatched = true;
        matchedFields.add("category");
      }

      if (typeOrStatus && typeOrStatus.includes(term)) {
        score += weights.type_status_term_match;
        termMatched = true;
        matchedFields.add("type-status");
      }

      if (summary.includes(term)) {
        score += weights.summary_term_match;
        termMatched = true;
        matchedFields.add("summary");
      }

      if (termMatched) matchedTermCount += 1;
    });

    if (terms.length > 0 && matchedTermCount === terms.length) {
      score += weights.full_term_coverage_bonus;
    }

    score += matchedFields.size * weights.matched_field_bonus;

    return score;
  }

  function searchCollection(items, query, terms, kind) {
    return items
      .map(item => {
        const score = scoreMatch(item, query, terms, kind);
        return {
          item,
          score,
          relevance: relevanceLabel(score),
          relevanceClass: relevanceClass(score)
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  }

  function renderTags(tags) {
    if (!tags || !tags.length) return '<span class="badge border text-dark">#placeholder</span>';
    return tags
      .map(tag => `<span class="badge border text-dark">#${escapeHtml(String(tag).replace(/\s+/g, "-"))}</span>`)
      .join("");
  }

  function relatedBadgeList(ids, map) {
    if (!ids || !ids.length) {
      return '<span class="badge border text-dark">No related refs</span>';
    }

    return ids.map(id => {
      const ref = map[id];
      if (!ref) {
        return `<span class="badge border text-dark">${escapeHtml(id)}</span>`;
      }
      return `<a class="badge border text-dark text-decoration-none" href="${escapeHtml(ref.url || "#")}">${escapeHtml(ref.title)}</a>`;
    }).join("");
  }

  function renderProjectResults(entries) {
    if (!entries.length) {
      return '<div class="kom-result-empty small text-muted">No project matches for this query.</div>';
    }

    return entries.map(entry => {
      const item = entry.item;
      return `
        <article class="card border-0 shadow-sm kom-result-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
              <h4 class="h6 mb-0">${escapeHtml(item.title)}</h4>
              <span class="badge ${entry.relevanceClass}">${entry.relevance} (${entry.score})</span>
            </div>

            <div class="d-flex flex-wrap gap-2 mb-2">
              <span class="badge text-bg-light border text-dark">${escapeHtml(item.category)}</span>
              <span class="badge text-bg-primary">${escapeHtml(item.status || "Status")}</span>
            </div>

            <p class="mb-3">${escapeHtml(item.summary)}</p>
            <div class="d-flex flex-wrap gap-2 mb-3">${renderTags(item.tags)}</div>

            <div class="kom-related-block mb-3">
              <p class="small mb-1"><strong>Related Knowledge</strong></p>
              <div class="d-flex flex-wrap gap-2">${relatedBadgeList(item.related_knowledge, state.knowledgeMap)}</div>
            </div>

            <a class="btn btn-outline-primary btn-sm" href="${escapeHtml(item.url || "#")}">Open Project Placeholder</a>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderKnowledgeResults(entries) {
    if (!entries.length) {
      return '<div class="kom-result-empty small text-muted">No knowledge matches for this query.</div>';
    }

    return entries.map(entry => {
      const item = entry.item;
      return `
        <article class="card border-0 shadow-sm kom-result-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
              <h4 class="h6 mb-0">${escapeHtml(item.title)}</h4>
              <span class="badge ${entry.relevanceClass}">${entry.relevance} (${entry.score})</span>
            </div>

            <div class="d-flex flex-wrap gap-2 mb-2">
              <span class="badge text-bg-light border text-dark">${escapeHtml(item.category)}</span>
              <span class="badge text-bg-secondary">${escapeHtml((item.type || "type").toUpperCase())}</span>
            </div>

            <p class="mb-3">${escapeHtml(item.summary)}</p>
            <div class="d-flex flex-wrap gap-2 mb-3">${renderTags(item.tags)}</div>

            <div class="kom-related-block mb-3">
              <p class="small mb-1"><strong>Related Projects</strong></p>
              <div class="d-flex flex-wrap gap-2">${relatedBadgeList(item.related_projects, state.projectMap)}</div>
            </div>

            <a class="btn btn-outline-primary btn-sm" href="${escapeHtml(item.url || "#")}">Open Knowledge Placeholder</a>
          </div>
        </article>
      `;
    }).join("");
  }

  function setFilterButtonState() {
    filterButtons.forEach(btn => {
      const active = btn.getAttribute("data-filter") === state.activeFilter;
      btn.classList.toggle("active", active);
    });
  }

  function applyFilterLayout() {
    const filter = state.activeFilter;

    projectGroupEl.hidden = false;
    knowledgeGroupEl.hidden = false;

    projectGroupEl.classList.remove("col-lg-12");
    knowledgeGroupEl.classList.remove("col-lg-12");
    projectGroupEl.classList.add("col-lg-6");
    knowledgeGroupEl.classList.add("col-lg-6");

    if (filter === "projects") {
      knowledgeGroupEl.hidden = true;
      projectGroupEl.classList.remove("col-lg-6");
      projectGroupEl.classList.add("col-lg-12");
    } else if (filter === "knowledge") {
      projectGroupEl.hidden = true;
      knowledgeGroupEl.classList.remove("col-lg-6");
      knowledgeGroupEl.classList.add("col-lg-12");
    }
  }

  function updateSummary(query, projectEntries, knowledgeEntries) {
    const pCount = projectEntries.length;
    const kCount = knowledgeEntries.length;
    const total = pCount + kCount;

    if (state.activeFilter === "projects") {
      summaryEl.innerHTML = `Results for <strong>${escapeHtml(query)}</strong>: showing Projects (${pCount} match(es)).`;
      return;
    }

    if (state.activeFilter === "knowledge") {
      summaryEl.innerHTML = `Results for <strong>${escapeHtml(query)}</strong>: showing Knowledge (${kCount} match(es)).`;
      return;
    }

    summaryEl.innerHTML = `Results for <strong>${escapeHtml(query)}</strong>: ${total} match(es) - Projects ${pCount}, Knowledge ${kCount}.`;
  }

  function showInitialState(message) {
    groupedResultsEl.hidden = true;
    emptyStateEl.hidden = true;
    initialStateEl.hidden = false;
    initialTextEl.textContent = message;
  }

  function showEmptyState(query) {
    groupedResultsEl.hidden = true;
    initialStateEl.hidden = true;
    emptyStateEl.hidden = false;
    summaryEl.innerHTML = `No results found for <strong>${escapeHtml(query)}</strong>.`;
  }

  function renderCurrentResults() {
    const projectEntries = state.lastProjectMatches;
    const knowledgeEntries = state.lastKnowledgeMatches;

    projectsCountEl.textContent = projectEntries.length;
    knowledgeCountEl.textContent = knowledgeEntries.length;
    projectsResultEl.innerHTML = renderProjectResults(projectEntries);
    knowledgeResultEl.innerHTML = renderKnowledgeResults(knowledgeEntries);

    updateSummary(state.lastQuery, projectEntries, knowledgeEntries);
    applyFilterLayout();

    initialStateEl.hidden = true;
    emptyStateEl.hidden = true;
    groupedResultsEl.hidden = false;
  }

  function runSearch(rawQuery) {
    if (!state.loaded) {
      summaryEl.textContent = "Archive is still loading. Please try again.";
      return;
    }

    const query = normalize(rawQuery);
    if (!query) {
      state.hasSearched = false;
      state.lastQuery = "";
      state.lastProjectMatches = [];
      state.lastKnowledgeMatches = [];
      summaryEl.textContent = "Search is ready.";
      showInitialState("Type a keyword and click Search to explore Projects and Knowledge.");
      return;
    }

    const terms = toTerms(query);
    const projectEntries = searchCollection(state.projects, query, terms, "project");
    const knowledgeEntries = searchCollection(state.knowledge, query, terms, "knowledge");

    state.hasSearched = true;
    state.lastQuery = rawQuery;
    state.lastProjectMatches = projectEntries;
    state.lastKnowledgeMatches = knowledgeEntries;

    if (!projectEntries.length && !knowledgeEntries.length) {
      showEmptyState(rawQuery);
      return;
    }

    renderCurrentResults();
  }

  function clearSearch() {
    queryInput.value = "";
    state.hasSearched = false;
    state.lastQuery = "";
    state.lastProjectMatches = [];
    state.lastKnowledgeMatches = [];
    summaryEl.textContent = "Search is ready.";
    showInitialState("Type a keyword and click Search to explore Projects and Knowledge.");
    queryInput.focus();
  }

  function buildTopicClusters() {
    const clusters = [];
    const used = new Set();

    const tagFreq = {};
    const corpus = new Set();

    function addTag(raw) {
      const normalized = normalize(raw).replace(/-/g, " ").trim();
      if (!normalized) return;
      tagFreq[normalized] = (tagFreq[normalized] || 0) + 1;
      corpus.add(normalized);
    }

    [
      ...state.projects,
      ...state.knowledge,
      ...ensureArrayData(state.sources.ventures),
      ...ensureArrayData(state.sources.notes),
      ...ensureArrayData(state.sources.reviews)
    ].forEach(item => {
      (item.tags || []).forEach(addTag);
      addTag(simplifyCategory(item.category));
      if (item.category) addTag(item.category);
    });

    const preferred = state.sources.komConfig && state.sources.komConfig.ui && Array.isArray(state.sources.komConfig.ui.topic_clusters)
      ? state.sources.komConfig.ui.topic_clusters
      : [
        { label: "Embedded Systems", query: "embedded systems" },
        { label: "Motor Control", query: "motor control" },
        { label: "Product Development", query: "product development" },
        { label: "Research", query: "research" },
        { label: "Journal Review", query: "journal review" },
        { label: "Software", query: "software" }
      ];

    preferred.forEach(topic => {
      const topicQuery = normalize(topic.query).replace(/-/g, " ");
      const exists = Array.from(corpus).some(term => term.includes(topicQuery));
      if (exists && !used.has(topicQuery)) {
        clusters.push({ label: topic.label, query: topic.query });
        used.add(topicQuery);
      }
    });

    Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .forEach(([term]) => {
        if (clusters.length >= 12) return;
        if (used.has(term)) return;
        if (term.length < 3) return;
        clusters.push({ label: toTitleCase(term), query: term });
        used.add(term);
      });

    return clusters;
  }

  function renderTopicClusters() {
    if (!topicContainer) return;
    const clusters = buildTopicClusters();

    topicContainer.innerHTML = clusters
      .map(topic => `<button type="button" class="btn btn-outline-secondary btn-sm kom-topic-btn" data-query="${escapeHtml(topic.query)}">${escapeHtml(topic.label)}</button>`)
      .join("");

    topicContainer.querySelectorAll(".kom-topic-btn").forEach(button => {
      button.addEventListener("click", function() {
        const query = this.getAttribute("data-query") || "";
        queryInput.value = query;
        runSearch(query);
      });
    });
  }

  function attachEvents() {
    searchBtn.addEventListener("click", function() {
      runSearch(queryInput.value);
    });

    clearBtn.addEventListener("click", function() {
      clearSearch();
    });

    queryInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch(queryInput.value);
      }
    });

    promptButtons.forEach(button => {
      button.addEventListener("click", function() {
        const prompt = this.getAttribute("data-query") || "";
        queryInput.value = prompt;
        runSearch(prompt);
      });
    });

    filterButtons.forEach(button => {
      button.addEventListener("click", function() {
        state.activeFilter = this.getAttribute("data-filter") || "all";
        setFilterButtonState();

        if (!state.hasSearched) return;
        if (!state.lastProjectMatches.length && !state.lastKnowledgeMatches.length) return;

        renderCurrentResults();
      });
    });
  }

  async function loadUnifiedSources() {
    if (window.DataLoader && typeof window.DataLoader.loadAllData === "function") {
      return window.DataLoader.loadAllData([
        "profile",
        "homepage",
        "projects",
        "knowledge",
        "ventures",
        "timeline",
        "notes",
        "reviews",
        "contact",
        "kom-config"
      ]);
    }

    const [projectsRes, knowledgeRes] = await Promise.all([
      fetch("data/projects.json"),
      fetch("data/knowledge.json")
    ]);

    if (!projectsRes.ok || !knowledgeRes.ok) {
      throw new Error("Failed to load search data.");
    }

    return {
      projects: await projectsRes.json(),
      knowledge: await knowledgeRes.json()
    };
  }

  function applyLoadedSources(allSources) {
    state.sourceCatalog = allSources || {};

    state.sources.profile = allSources.profile || null;
    state.sources.homepage = allSources.homepage || null;
    state.sources.projects = ensureArrayData(allSources.projects);
    state.sources.knowledge = ensureArrayData(allSources.knowledge);
    state.sources.ventures = ensureArrayData(allSources.ventures);
    state.sources.timeline = ensureArrayData(allSources.timeline);
    state.sources.notes = ensureArrayData(allSources.notes);
    state.sources.reviews = ensureArrayData(allSources.reviews);
    state.sources.contact = allSources.contact || null;
    state.sources.komConfig = allSources["kom-config"] || allSources.komConfig || null;

    state.projects = state.sources.projects;
    state.knowledge = state.sources.knowledge;
    state.loaded = true;

    state.projectMap = state.projects.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    state.knowledgeMap = state.knowledge.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }

  async function loadData() {
    try {
      const allSources = await loadUnifiedSources();
      applyLoadedSources(allSources);

      renderTopicClusters();

      summaryEl.textContent = `Search is ready. Loaded ${state.projects.length} projects and ${state.knowledge.length} knowledge entries.`;
      showInitialState("Type a keyword and click Search to explore Projects and Knowledge.");
    } catch (error) {
      summaryEl.textContent = "Search data could not be loaded. Check data endpoints.";
      showInitialState("Data load failed. Please verify JSON data sources in /data.");
    }
  }

  setFilterButtonState();
  attachEvents();
  loadData();
})();
