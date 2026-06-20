#!/usr/bin/env node
"use strict";

const path = require("path");
const { Pool } = require("pg");
const { ensureSchema } = require("../lib/db-schema");
const { loadProjectEnv } = require("../lib/env");
const { loadDefaultSource } = require("../lib/default-data");
const {
  asArray,
  asObject,
  cleanString,
  normalizeArticleInput,
  normalizeExperienceInput,
  normalizeProfileInput,
  normalizeProjectInput,
  normalizeSkillInput,
  normalizeSocialLinkInput,
  normalizeVentureInput,
  slugify
} = require("../lib/model-utils");

const SETTING_SEED_KEYS = [
  "homepage",
  "contact",
  "kom-config",
  "notes",
  "reviews"
];

function uniqueBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

async function upsertProfile(client, profilePayload) {
  const payload = normalizeProfileInput(profilePayload);
  await client.query(
    `
      INSERT INTO profile (
        external_id, name, slug, headline, description, avatar_url,
        content_json, status, sort_order, is_published, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'active',0,TRUE,NOW())
      ON CONFLICT (external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        headline = EXCLUDED.headline,
        description = EXCLUDED.description,
        avatar_url = EXCLUDED.avatar_url,
        content_json = EXCLUDED.content_json,
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.name,
      slugify(payload.name || payload.id, payload.id),
      payload.headline,
      payload.description,
      payload.avatarUrl,
      JSON.stringify(payload.contentJson)
    ]
  );
}

async function upsertProject(client, sourcePayload, sortOrder) {
  const payload = normalizeProjectInput(sourcePayload, sourcePayload && sourcePayload.id ? sourcePayload.id : null);
  if (!payload.id || !payload.title) return;

  await client.query(
    `
      INSERT INTO projects (
        external_id, title, slug, project_type, category,
        description, content, status, cover_image, url,
        tags, related_ids, likes, sort_order,
        is_published, published_at, meta_json, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11::jsonb,$12::jsonb,$13,$14,
        $15,$16,$17::jsonb,NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        project_type = EXCLUDED.project_type,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        cover_image = EXCLUDED.cover_image,
        url = EXCLUDED.url,
        tags = EXCLUDED.tags,
        related_ids = EXCLUDED.related_ids,
        likes = EXCLUDED.likes,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        published_at = EXCLUDED.published_at,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.title,
      payload.slug,
      payload.projectType,
      payload.category,
      payload.description,
      payload.content,
      payload.status,
      payload.coverImage,
      payload.url,
      JSON.stringify(payload.tags),
      JSON.stringify(payload.relatedIds),
      payload.likes,
      Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : sortOrder,
      payload.isPublished,
      payload.publishedAt,
      JSON.stringify(payload.metaJson)
    ]
  );
}

async function upsertArticle(client, sourcePayload, sortOrder) {
  const payload = normalizeArticleInput(sourcePayload, sourcePayload && sourcePayload.id ? sourcePayload.id : null);
  if (!payload.id || !payload.title) return;

  await client.query(
    `
      INSERT INTO articles (
        external_id, title, slug, article_type, category,
        description, content, status, cover_image, url,
        tags, related_ids, likes, sort_order,
        is_published, published_at, meta_json, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11::jsonb,$12::jsonb,$13,$14,
        $15,$16,$17::jsonb,NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        article_type = EXCLUDED.article_type,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        status = EXCLUDED.status,
        cover_image = EXCLUDED.cover_image,
        url = EXCLUDED.url,
        tags = EXCLUDED.tags,
        related_ids = EXCLUDED.related_ids,
        likes = EXCLUDED.likes,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        published_at = EXCLUDED.published_at,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.title,
      payload.slug,
      payload.articleType,
      payload.category,
      payload.description,
      payload.content,
      payload.status,
      payload.coverImage,
      payload.url,
      JSON.stringify(payload.tags),
      JSON.stringify(payload.relatedIds),
      payload.likes,
      Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : sortOrder,
      payload.isPublished,
      payload.publishedAt,
      JSON.stringify(payload.metaJson)
    ]
  );
}

async function upsertExperience(client, sourcePayload, sortOrder) {
  const payload = normalizeExperienceInput(sourcePayload, sourcePayload && sourcePayload.id ? sourcePayload.id : null, sortOrder);
  if (!payload.id || !payload.title) return;

  await client.query(
    `
      INSERT INTO experiences (
        external_id, title, slug, organization, experience_type,
        location, period, description, status, tags,
        sort_order, is_published, meta_json, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10::jsonb,
        $11,$12,$13::jsonb,NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        organization = EXCLUDED.organization,
        experience_type = EXCLUDED.experience_type,
        location = EXCLUDED.location,
        period = EXCLUDED.period,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        tags = EXCLUDED.tags,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.title,
      payload.slug,
      payload.organization,
      payload.experienceType,
      payload.location,
      payload.period,
      payload.description,
      payload.status,
      JSON.stringify(payload.tags),
      payload.sortOrder,
      payload.isPublished,
      JSON.stringify(payload.metaJson)
    ]
  );
}

async function upsertSkill(client, skillPayload, sortOrder) {
  const payload = normalizeSkillInput(skillPayload, sortOrder);
  if (!payload.name) return;

  await client.query(
    `
      INSERT INTO skills (
        external_id, name, slug, category, level,
        description, source, status, sort_order,
        is_published, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,NOW()
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        external_id = EXCLUDED.external_id,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        level = EXCLUDED.level,
        description = EXCLUDED.description,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        updated_at = NOW()
    `,
    [
      payload.externalId,
      payload.name,
      payload.slug,
      payload.category,
      payload.level,
      payload.description,
      payload.source,
      payload.status,
      payload.sortOrder,
      payload.isPublished
    ]
  );
}

async function upsertSocialLink(client, linkPayload, sortOrder) {
  const payload = normalizeSocialLinkInput(linkPayload, sortOrder);
  if (!payload.platform || !payload.url) return;

  await client.query(
    `
      INSERT INTO social_links (
        external_id, platform, label, url, icon,
        status, sort_order, is_published, meta_json,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9::jsonb,
        NOW()
      )
      ON CONFLICT (platform, url)
      DO UPDATE SET
        external_id = EXCLUDED.external_id,
        label = EXCLUDED.label,
        icon = EXCLUDED.icon,
        status = EXCLUDED.status,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      payload.externalId,
      payload.platform,
      payload.label,
      payload.url,
      payload.icon,
      payload.status,
      payload.sortOrder,
      payload.isPublished,
      JSON.stringify(payload.metaJson)
    ]
  );
}

async function upsertVenture(client, sourcePayload, sortOrder) {
  const payload = normalizeVentureInput(sourcePayload, sourcePayload && sourcePayload.id ? sourcePayload.id : null, sortOrder);
  if (!payload.id || !payload.title) return;

  await client.query(
    `
      INSERT INTO ventures (
        external_id, title, slug, role, description,
        status, image, url, tags, related_ids,
        sort_order, is_published, meta_json,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9::jsonb,$10::jsonb,
        $11,$12,$13::jsonb,
        NOW()
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        role = EXCLUDED.role,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        image = EXCLUDED.image,
        url = EXCLUDED.url,
        tags = EXCLUDED.tags,
        related_ids = EXCLUDED.related_ids,
        sort_order = EXCLUDED.sort_order,
        is_published = EXCLUDED.is_published,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.title,
      payload.slug,
      payload.role,
      payload.description,
      payload.status,
      payload.image,
      payload.url,
      JSON.stringify(payload.tags),
      JSON.stringify(payload.relatedIds),
      payload.sortOrder,
      payload.isPublished,
      JSON.stringify(payload.metaJson)
    ]
  );
}

async function upsertSiteSetting(client, key, value, sortOrder) {
  const title = key.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  await client.query(
    `
      INSERT INTO site_settings (
        key, title, slug, description, value_json,
        status, sort_order, is_published, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5::jsonb,
        'active',$6,TRUE,NOW()
      )
      ON CONFLICT (key)
      DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        value_json = EXCLUDED.value_json,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `,
    [
      key,
      title,
      slugify(key, key),
      `${title} setting`,
      JSON.stringify(value),
      sortOrder
    ]
  );
}

async function upsertMediaAsset(client, fileUrl, index) {
  const url = cleanString(fileUrl);
  if (!url) return;

  const assetType = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url) ? "image" : "file";
  const title = path.basename(url).replace(/\.[^.]+$/, "") || `asset-${index + 1}`;
  const slug = slugify(`${title}-${index + 1}`, `asset-${index + 1}`);

  await client.query(
    `
      INSERT INTO media_assets (
        title, slug, description, asset_type, file_url,
        status, sort_order, is_published, meta_json,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,
        'active',$6,TRUE,$7::jsonb,
        NOW()
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        asset_type = EXCLUDED.asset_type,
        file_url = EXCLUDED.file_url,
        sort_order = EXCLUDED.sort_order,
        meta_json = EXCLUDED.meta_json,
        updated_at = NOW()
    `,
    [
      title,
      slug,
      `Seeded from static source: ${url}`,
      assetType,
      url,
      index,
      JSON.stringify({ seeded: true })
    ]
  );
}

async function upsertSpotifySettings(client, allowedUserId, allowedEmail) {
  const userId = cleanString(allowedUserId);
  const email = cleanString(allowedEmail).toLowerCase();
  if (!userId && !email) return false;

  await client.query(
    `
      INSERT INTO spotify_settings (
        id, allowed_spotify_user_id, allowed_email, created_at, updated_at
      ) VALUES (
        1, $1, $2, NOW(), NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        allowed_spotify_user_id = EXCLUDED.allowed_spotify_user_id,
        allowed_email = EXCLUDED.allowed_email,
        updated_at = NOW()
    `,
    [userId || null, email || null]
  );

  return true;
}

async function seed() {
  const projectRoot = path.resolve(__dirname, "..");
  loadProjectEnv(projectRoot);
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak ditemukan. Pastikan .env project tersedia.");
  }

  const profile = asObject(loadDefaultSource(projectRoot, "profile"));
  const homepage = asObject(loadDefaultSource(projectRoot, "homepage"));
  const projects = asArray(loadDefaultSource(projectRoot, "projects"));
  const knowledge = asArray(loadDefaultSource(projectRoot, "knowledge"));
  const ventures = asArray(loadDefaultSource(projectRoot, "ventures"));
  const timeline = asArray(loadDefaultSource(projectRoot, "timeline"));
  const contact = asObject(loadDefaultSource(projectRoot, "contact"));
  const notes = asArray(loadDefaultSource(projectRoot, "notes"));
  const reviews = asArray(loadDefaultSource(projectRoot, "reviews"));
  const komConfig = asObject(loadDefaultSource(projectRoot, "kom-config"));
  const spotifyAllowedUserId = cleanString(process.env.SPOTIFY_ALLOWED_USER_ID || "");
  const spotifyAllowedEmail = cleanString(process.env.SPOTIFY_ALLOWED_EMAIL || "");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const counts = {
    profile: 0,
    projects: 0,
    articles: 0,
    experiences: 0,
    skills: 0,
    social_links: 0,
    ventures: 0,
    settings: 0,
    media_assets: 0,
    spotify_settings: 0
  };

  try {
    await ensureSchema(client);
    await client.query("BEGIN");

    await upsertProfile(client, profile);
    counts.profile += 1;

    for (let i = 0; i < projects.length; i += 1) {
      await upsertProject(client, projects[i], i);
      counts.projects += 1;
    }

    for (let i = 0; i < knowledge.length; i += 1) {
      await upsertArticle(client, knowledge[i], i);
      counts.articles += 1;
    }

    for (let i = 0; i < timeline.length; i += 1) {
      await upsertExperience(client, timeline[i], i);
      counts.experiences += 1;
    }

    for (let i = 0; i < ventures.length; i += 1) {
      await upsertVenture(client, ventures[i], i);
      counts.ventures += 1;
    }

    const seededSkills = [];
    asArray(profile.skills).forEach((name) => seededSkills.push({ name, category: "skills", source: "profile" }));
    asArray(profile.hard_skills).forEach((name) => seededSkills.push({ name, category: "hard_skills", source: "profile" }));
    asArray(profile.soft_skills).forEach((name) => seededSkills.push({ name, category: "soft_skills", source: "profile" }));
    asArray(profile.tools).forEach((name) => seededSkills.push({ name, category: "tools", source: "profile" }));
    asArray(profile.focus_areas).forEach((name) => seededSkills.push({ name, category: "focus_areas", source: "profile" }));
    asArray(profile.languages).forEach((item) => {
      const language = asObject(item);
      seededSkills.push({
        name: language.name,
        level: language.level,
        category: "language",
        source: "profile"
      });
    });

    const uniqueSkills = uniqueBy(
      seededSkills.filter((item) => cleanString(item.name)),
      (item) => slugify(item.name)
    );

    for (let i = 0; i < uniqueSkills.length; i += 1) {
      await upsertSkill(client, uniqueSkills[i], i);
      counts.skills += 1;
    }

    const socialCandidates = [];
    asArray(profile.social_links).forEach((item) => socialCandidates.push(item));
    asArray(contact.social_links).forEach((item) => socialCandidates.push(item));

    const profileContacts = asObject(profile.contacts);
    ["linkedin", "github", "instagram", "youtube", "x", "twitter", "website"].forEach((platform) => {
      if (profileContacts[platform]) {
        socialCandidates.push({ platform, url: profileContacts[platform], source: "profile.contacts" });
      }
      if (contact[platform]) {
        socialCandidates.push({ platform, url: contact[platform], source: "contact" });
      }
    });

    const uniqueLinks = uniqueBy(
      socialCandidates
        .map((item) => {
          const normalized = normalizeSocialLinkInput(item);
          if (!normalized.platform || !normalized.url) return null;
          return normalized;
        })
        .filter(Boolean),
      (item) => `${item.platform}|${item.url}`
    );

    for (let i = 0; i < uniqueLinks.length; i += 1) {
      await upsertSocialLink(client, uniqueLinks[i], i);
      counts.social_links += 1;
    }

    const settingsMap = {
      homepage,
      contact,
      "kom-config": komConfig,
      notes,
      reviews
    };

    for (let i = 0; i < SETTING_SEED_KEYS.length; i += 1) {
      const key = SETTING_SEED_KEYS[i];
      await upsertSiteSetting(client, key, settingsMap[key], i);
      counts.settings += 1;
    }

    const mediaCandidates = [];
    if (profile.profile_image) mediaCandidates.push(profile.profile_image);
    if (homepage.hero_background_image) mediaCandidates.push(homepage.hero_background_image);
    if (homepage.about_profile_image) mediaCandidates.push(homepage.about_profile_image);
    projects.forEach((item) => {
      if (item.cover_image) mediaCandidates.push(item.cover_image);
    });
    knowledge.forEach((item) => {
      if (item.cover_image) mediaCandidates.push(item.cover_image);
    });
    ventures.forEach((item) => {
      if (item.image) mediaCandidates.push(item.image);
      if (item.cover_image) mediaCandidates.push(item.cover_image);
    });

    const uniqueMedia = uniqueBy(
      mediaCandidates.filter((url) => cleanString(url)),
      (url) => cleanString(url)
    );

    for (let i = 0; i < uniqueMedia.length; i += 1) {
      await upsertMediaAsset(client, uniqueMedia[i], i);
      counts.media_assets += 1;
    }

    if (await upsertSpotifySettings(client, spotifyAllowedUserId, spotifyAllowedEmail)) {
      counts.spotify_settings = 1;
    }

    await client.query("COMMIT");

    console.log("[seed-db] Seed selesai (idempotent). Ringkasan:");
    console.log(JSON.stringify(counts, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("[seed-db] Gagal:", error.message);
  process.exit(1);
});
