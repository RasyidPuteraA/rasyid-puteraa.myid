# Project Status — rasyid-puteraa.my.id

Snapshot kondisi project. **Terakhir diperbarui: 2026-06-20.**

## Ringkasan
🟢 **Live di production.** Website personal (Engineering Portfolio & Living
Knowledge Archive) berjalan stabil di VPS.

## Domain & edge
- Domain: **rasyid-puteraa.my.id** (+ `www`)
- Edge: **Cloudflare Tunnel** (TLS diterminasi di edge) → **Nginx** → app
- TLS origin: tidak (HTTP lokal via tunnel)

## Stack & service
| Komponen | Detail |
|---|---|
| Runtime | Node.js, `server.js` (http core, routing manual) |
| Process manager | PM2 `rasyid-puteraa`, `127.0.0.1:4100`, `NODE_ENV=production` |
| Reverse proxy | Nginx (`sites-enabled/rasyid-puteraa.my.id`) |
| Database | PostgreSQL 16, Docker `rasyid-postgres`, `127.0.0.1:5433`, DB `rasyid_db`, user `rasyid_user` |
| CMS | Admin panel (`/admin`) dengan login role `master` (bcrypt) |
| Integrasi | Spotify OAuth (now-playing), Google Sheets (read-only) |

## Database
- 14 tabel (users, profile, projects, articles, experiences, skills,
  social_links, ventures, site_settings, media_assets, activity_logs,
  spotify_settings, spotify_tokens, page_views).
- Sumber kebenaran konten = PostgreSQL; `app/data/*.json` = fallback/seed.

## Backup
- Script: `scripts/backup-postgres.sh` → `<db>_<ts>.sql.gz`, retensi 14 hari.
- Cron harian **02:30** aktif. Backup manual & restore ke DB test terverifikasi.
- Panduan: [`backup-postgres.md`](backup-postgres.md).

## Security improvements (sudah ada)
- Rate-limit login admin (per-IP, lock sementara, respons generik).
- Static path-traversal terjaga; cookie `HttpOnly`/`SameSite`/`Secure` (kondisional).
- Spotify OAuth: CSRF `state` + allowlist pemilik.
- Query parameterized (anti SQL injection).
- Secret tidak ada di repo; file backup di-`gitignore`.
- SEO/OG/JSON-LD pada halaman publik.

## Known limitations
- `server.js` monolith (~3.5k baris) — maintainability menengah.
- Session admin in-memory (hilang saat restart PM2).
- Hero & beberapa konten publik masih placeholder (perlu diisi via admin).
- Contact form memakai fallback `mailto:` (belum ada endpoint Node).
- Working tree punya perubahan lintas-fase yang mungkin belum di-commit.
- Backup belum ada monitoring/alert otomatis.
- Origin Nginx terbuka di `0.0.0.0:80` (pertimbangkan batasi ke range Cloudflare — di luar scope dok ini).

## Next recommended work
Lihat [`roadmap.md`](roadmap.md) (Near-term) & [`../TODO.md`](../TODO.md):
update hero live, kurasi featured projects, cleanup placeholder, GitHub Issues,
contact endpoint Node, backup monitoring.
