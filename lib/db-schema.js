"use strict";

const schemaStatements = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
  `,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,

  `
  CREATE TABLE IF NOT EXISTS site_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    title TEXT,
    slug TEXT,
    description TEXT,
    value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS profile (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    name TEXT,
    slug TEXT,
    headline TEXT,
    description TEXT,
    avatar_url TEXT,
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    slug TEXT,
    project_type TEXT,
    category TEXT,
    description TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    cover_image TEXT,
    url TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    likes INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS articles (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    slug TEXT,
    article_type TEXT,
    category TEXT,
    description TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    cover_image TEXT,
    url TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    likes INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS experiences (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    slug TEXT,
    organization TEXT,
    experience_type TEXT,
    location TEXT,
    period TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS skills (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    category TEXT,
    level TEXT,
    description TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS social_links (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT UNIQUE,
    platform TEXT NOT NULL,
    label TEXT,
    url TEXT NOT NULL,
    icon TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT social_links_platform_url_unique UNIQUE(platform, url)
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS media_assets (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    slug TEXT UNIQUE,
    description TEXT,
    asset_type TEXT,
    file_url TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS ventures (
    id BIGSERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    slug TEXT,
    role TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    image TEXT,
    url TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS spotify_settings (
    id BIGSERIAL PRIMARY KEY,
    allowed_spotify_user_id TEXT,
    allowed_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS spotify_tokens (
    id BIGSERIAL PRIMARY KEY,
    spotify_user_id TEXT NOT NULL UNIQUE,
    spotify_email TEXT,
    spotify_display_name TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scope TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS page_views (
    id BIGSERIAL PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    view_count BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,

  `CREATE INDEX IF NOT EXISTS idx_projects_status_published ON projects(status, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_experiences_sort_order ON experiences(sort_order, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_skills_sort_order ON skills(sort_order, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_social_links_sort_order ON social_links(sort_order, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_ventures_sort_order ON ventures(sort_order, is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_spotify_tokens_active_updated ON spotify_tokens(is_active, updated_at DESC)`
];

async function ensureSchema(db) {
  for (const statement of schemaStatements) {
    await db.query(statement);
  }
}

module.exports = {
  ensureSchema,
  schemaStatements
};
