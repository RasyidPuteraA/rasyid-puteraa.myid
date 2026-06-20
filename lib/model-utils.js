"use strict";

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function slugify(value, fallback = "item") {
  const slug = cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function parseDateToIso(value) {
  const raw = cleanString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function jsonValue(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function normalizeProfileInput(payload) {
  const source = asObject(payload);
  const id = cleanString(source.id) || "profile-main";
  const bio = cleanString(source.bio || source.summary || source.description);
  return {
    id,
    name: cleanString(source.name),
    headline: cleanString(source.headline || source.role),
    description: bio,
    avatarUrl: cleanString(source.profile_image || source.avatar_url),
    contentJson: source
  };
}

function normalizeProjectInput(payload, fallbackId) {
  const source = asObject(payload);
  const id = cleanString(source.id || fallbackId);
  const meta = {
    sections: asArray(source.sections),
    author: cleanString(source.author),
    date: cleanString(source.date),
    year: source.year == null ? null : source.year
  };

  return {
    id,
    title: cleanString(source.title),
    slug: cleanString(source.slug) || slugify(source.title || id, id || "project"),
    projectType: cleanString(source.type),
    category: cleanString(source.category),
    description: cleanString(source.summary || source.description),
    content: cleanString(source.content),
    status: cleanString(source.status) || "draft",
    coverImage: cleanString(source.cover_image),
    url: cleanString(source.url) || (id ? `project-detail.html?id=${encodeURIComponent(id)}` : ""),
    tags: asArray(source.tags),
    relatedIds: asArray(source.related_knowledge),
    likes: Number.isFinite(Number(source.likes)) ? Math.max(0, Number(source.likes)) : 0,
    sortOrder: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : 0,
    isPublished: source.is_published !== false,
    publishedAt: parseDateToIso(source.date || source.published_at),
    metaJson: meta
  };
}

function normalizeArticleInput(payload, fallbackId) {
  const source = asObject(payload);
  const id = cleanString(source.id || fallbackId);
  const meta = {
    sections: asArray(source.sections),
    author: cleanString(source.author),
    date: cleanString(source.date),
    source: cleanString(source.source)
  };

  return {
    id,
    title: cleanString(source.title),
    slug: cleanString(source.slug) || slugify(source.title || id, id || "article"),
    articleType: cleanString(source.type || source.article_type || "article"),
    category: cleanString(source.category),
    description: cleanString(source.summary || source.description),
    content: cleanString(source.content),
    status: cleanString(source.status) || "published",
    coverImage: cleanString(source.cover_image),
    url: cleanString(source.url) || (id ? `knowledge-detail.html?id=${encodeURIComponent(id)}` : ""),
    tags: asArray(source.tags),
    relatedIds: asArray(source.related_projects),
    likes: Number.isFinite(Number(source.likes)) ? Math.max(0, Number(source.likes)) : 0,
    sortOrder: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : 0,
    isPublished: source.is_published !== false,
    publishedAt: parseDateToIso(source.date || source.published_at),
    metaJson: meta
  };
}

function normalizeExperienceInput(payload, fallbackId, fallbackSort = 0) {
  const source = asObject(payload);
  const id = cleanString(source.id || fallbackId);
  return {
    id,
    title: cleanString(source.title),
    slug: cleanString(source.slug) || slugify(source.title || id, id || "experience"),
    organization: cleanString(source.organization),
    experienceType: cleanString(source.category || source.phase || source.experience_type),
    location: cleanString(source.location),
    period: cleanString(source.period || source.target_window),
    description: cleanString(source.summary || source.description),
    status: cleanString(source.status) || "draft",
    tags: asArray(source.tags),
    sortOrder: Number.isFinite(Number(source.order))
      ? Number(source.order)
      : (Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : fallbackSort),
    isPublished: source.is_published !== false,
    metaJson: source
  };
}

function normalizeSkillInput(payload, fallbackSort = 0) {
  if (typeof payload === "string") {
    const name = cleanString(payload);
    return {
      externalId: slugify(name || `skill-${fallbackSort + 1}`),
      name,
      slug: slugify(name || `skill-${fallbackSort + 1}`),
      category: "skill",
      level: "",
      description: "",
      source: "profile",
      status: "active",
      sortOrder: fallbackSort,
      isPublished: true
    };
  }

  const source = asObject(payload);
  const name = cleanString(source.name || source.title || source.skill);
  const slug = cleanString(source.slug) || slugify(name || `skill-${fallbackSort + 1}`);

  return {
    externalId: cleanString(source.id || source.external_id) || slug,
    name,
    slug,
    category: cleanString(source.category) || "skill",
    level: cleanString(source.level),
    description: cleanString(source.description),
    source: cleanString(source.source) || "manual",
    status: cleanString(source.status) || "active",
    sortOrder: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : fallbackSort,
    isPublished: source.is_published !== false
  };
}

function normalizeSocialLinkInput(payload, fallbackSort = 0) {
  const source = asObject(payload);
  const platform = cleanString(source.platform || source.name).toLowerCase();
  const url = cleanString(source.url);
  const id = cleanString(source.id || source.external_id) || `${platform || "link"}-${fallbackSort + 1}`;

  return {
    externalId: id,
    platform,
    label: cleanString(source.label || source.name || platform),
    url,
    icon: cleanString(source.icon),
    status: cleanString(source.status) || "active",
    sortOrder: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : fallbackSort,
    isPublished: source.is_published !== false,
    metaJson: source
  };
}

function normalizeVentureInput(payload, fallbackId, fallbackSort = 0) {
  const source = asObject(payload);
  const id = cleanString(source.id || fallbackId);
  return {
    id,
    title: cleanString(source.title),
    slug: cleanString(source.slug) || slugify(source.title || id, id || "venture"),
    role: cleanString(source.role),
    description: cleanString(source.description || source.summary),
    status: cleanString(source.status) || "draft",
    image: cleanString(source.image || source.cover_image),
    url: cleanString(source.link || source.url),
    tags: asArray(source.tags),
    relatedIds: asArray(source.related_projects),
    sortOrder: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : fallbackSort,
    isPublished: source.is_published !== false,
    metaJson: source
  };
}

function projectRowToPublic(row) {
  const meta = asObject(jsonValue(row.meta_json, {}));
  return {
    id: row.external_id,
    title: row.title,
    type: row.project_type || meta.type || "",
    year: meta.year == null ? null : meta.year,
    category: row.category || "",
    summary: row.description || "",
    status: row.status || "",
    tags: asArray(jsonValue(row.tags, [])),
    related_knowledge: asArray(jsonValue(row.related_ids, [])),
    date: meta.date || (row.published_at ? new Date(row.published_at).toISOString().slice(0, 10) : ""),
    likes: Number(row.likes || 0),
    cover_image: row.cover_image || "",
    content: row.content || "",
    sections: asArray(meta.sections),
    author: meta.author || "",
    url: row.url || `project-detail.html?id=${encodeURIComponent(row.external_id)}`,
    sort_order: Number(row.sort_order || 0),
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function articleRowToPublic(row) {
  const meta = asObject(jsonValue(row.meta_json, {}));
  return {
    id: row.external_id,
    title: row.title,
    type: row.article_type || "article",
    category: row.category || "",
    summary: row.description || "",
    tags: asArray(jsonValue(row.tags, [])),
    related_projects: asArray(jsonValue(row.related_ids, [])),
    date: meta.date || (row.published_at ? new Date(row.published_at).toISOString().slice(0, 10) : ""),
    likes: Number(row.likes || 0),
    cover_image: row.cover_image || "",
    content: row.content || "",
    sections: asArray(meta.sections),
    author: meta.author || "",
    url: row.url || `knowledge-detail.html?id=${encodeURIComponent(row.external_id)}`,
    sort_order: Number(row.sort_order || 0),
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function experienceRowToPublic(row) {
  const meta = asObject(jsonValue(row.meta_json, {}));
  return {
    id: row.external_id,
    phase: meta.phase || "",
    title: row.title,
    summary: row.description || "",
    category: row.experience_type || "",
    organization: row.organization || "",
    period: row.period || "",
    location: row.location || "",
    status: row.status || "",
    tags: asArray(jsonValue(row.tags, [])),
    order: Number(row.sort_order || 0),
    target_window: meta.target_window || "",
    sort_order: Number(row.sort_order || 0),
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function skillRowToPublic(row) {
  return {
    id: row.external_id || row.slug || String(row.id),
    name: row.name,
    slug: row.slug,
    category: row.category || "",
    level: row.level || "",
    description: row.description || "",
    source: row.source || "manual",
    status: row.status || "active",
    sort_order: Number(row.sort_order || 0),
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function socialLinkRowToPublic(row) {
  return {
    id: row.external_id || String(row.id),
    platform: row.platform,
    label: row.label || row.platform,
    url: row.url,
    icon: row.icon || "",
    status: row.status || "active",
    sort_order: Number(row.sort_order || 0),
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function ventureRowToPublic(row) {
  const meta = asObject(jsonValue(row.meta_json, {}));
  return {
    id: row.external_id,
    title: row.title,
    description: row.description || "",
    summary: row.description || "",
    status: row.status || "",
    role: row.role || "",
    tags: asArray(jsonValue(row.tags, [])),
    related_projects: asArray(jsonValue(row.related_ids, [])),
    link: row.url || "",
    url: row.url || "",
    image: row.image || "",
    cover_image: row.image || "",
    sort_order: Number(row.sort_order || 0),
    is_published: Boolean(row.is_published),
    meta
  };
}

module.exports = {
  articleRowToPublic,
  asArray,
  asObject,
  cleanString,
  experienceRowToPublic,
  jsonValue,
  normalizeArticleInput,
  normalizeExperienceInput,
  normalizeProfileInput,
  normalizeProjectInput,
  normalizeSkillInput,
  normalizeSocialLinkInput,
  normalizeVentureInput,
  parseDateToIso,
  projectRowToPublic,
  skillRowToPublic,
  slugify,
  socialLinkRowToPublic,
  todayIsoDate,
  ventureRowToPublic
};
