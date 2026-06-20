# Changelog

Semua perubahan penting pada project `rasyid-puteraa.my.id`.
Format longgar mengikuti [Keep a Changelog](https://keepachangelog.com/).

> Catatan: beberapa fase terbaru mungkin masih berupa perubahan working tree yang
> belum di-commit. Lihat `git log` untuk riwayat commit aktual.

## Phase 3A — Backup PostgreSQL — 2026-06-20
### Added
- `scripts/backup-postgres.sh`: backup `pg_dump` dari container `rasyid-postgres`
  → `<db>_<timestamp>.sql.gz`, atomic write, env-configurable
  (`POSTGRES_CONTAINER/DB/USER`, `BACKUP_DIR`, `RETENTION_DAYS`), retensi 14 hari,
  tanpa password hardcoded.
- `docs/backup-postgres.md`: panduan backup manual, uji integritas gzip, cron
  harian, restore ke database test, dan peringatan restore production.
- `.gitignore`: pola artefak backup (`*.sql.gz`, `*.dump.gz`, `*.partial`).
### Changed
- `README-DEPLOY.md`: tambah section "Backup Database".
### Ops
- Cron backup harian **02:30** aktif; backup manual & restore test terverifikasi.

## Phase 2 — Hardening & SEO — 2026-06-20
### Added
- Rate-limit login admin (in-memory, per-IP, 5 gagal/10 mnt → lock 15 mnt,
  respons generik `429` + `Retry-After`).
- SEO dasar di 7 halaman publik: `canonical`, Open Graph, Twitter card; JSON-LD
  `Person` di homepage; update canonical/OG per-item di halaman detail.
### Changed
- Title halaman dibuat konsisten & branded.
- Contact flow: form `mailto:` fungsional menggantikan endpoint PHP yang hilang.
### Removed
- Referensi mati `php-email-form/validate.js` di 7 halaman.

## Ignore AI workspace — 2026-06-20
### Changed
- `.gitignore`: abaikan workspace agent lokal (`.codex/`, `.codex`).

## Runtime baseline — 2026-06
### Added
- Source runtime masuk Git: `server.js`, `lib/`, `scripts/`, `package.json`,
  `ecosystem.config.cjs`, dan dokumentasi deploy.

## Phase 1 — Branding & Cleanup — 2026-06-20
### Changed
- Domain diseragamkan ke **rasyid-puteraa.my.id** (title, footer, meta, JS).
- Title & meta description homepage di-branding; perbaikan mojibake hero;
  fallback hero diselaraskan dengan positioning.
- `.gitignore`: tambah `credentials.json`, service-account JSON, `.DS_Store`.
### Removed
- Sisa template iPortfolio yang tidak dipakai: `service-details.html`,
  `portfolio-details.html`, `starter-page.html`, `forms/contact.php`,
  `forms/Readme.txt`, file `.DS_Store`.

## Initial commit — 2026-03
### Added
- Website awal berbasis template iPortfolio yang diadaptasi: frontend `app/`,
  backend `server.js` (Node http core), PostgreSQL + admin CMS, integrasi Spotify
  & Google Sheets, dokumentasi konsep fase (`docs/phase-*.md`), charter, roadmap.
