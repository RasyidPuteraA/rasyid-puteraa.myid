# rasyid-puteraa.my.id

Website personal profesional **Muhammad Rasyid Putera Agung** — diarahkan sebagai
**Engineering Portfolio & Living Knowledge Archive**.

> Electrical Engineer · Embedded & IoT System Builder · EV & Power Electronics —
> membangun sistem nyata *end-to-end*, dari power electronics & embedded hardware
> sampai web monitoring, data logging, dan VPS infrastructure.

**Status:** 🟢 Live di production pada [rasyid-puteraa.my.id](https://rasyid-puteraa.my.id).

---

## Konsep

Website ini **bukan sekadar CV**, melainkan:

- **Portfolio engineering** & featured projects
- **Knowledge archive** (catatan, review, pembelajaran)
- **Journey documentation** (timeline pengalaman)
- **Venture gateway** (Serbada, SAKMODUL, dll)
- Fondasi **KOM** — sistem eksplorasi pengetahuan (visi jangka panjang, bukan
  prioritas dekat)

Detail konsep & filosofi: [`docs/README.md`](docs/README.md) ·
[`docs/project-charter.md`](docs/project-charter.md).

---

## Stack saat ini

| Lapisan | Teknologi |
|---|---|
| Runtime | Node.js (`http` core, `server.js`) |
| Process manager | PM2 (`rasyid-puteraa`, port 4100) |
| Reverse proxy / edge | Nginx + Cloudflare Tunnel (TLS di edge) |
| Database | PostgreSQL 16 (Docker `rasyid-postgres`, DB `rasyid_db`) |
| Integrasi | Admin CMS, Spotify OAuth, Google Sheets (read-only) |
| Backup | `scripts/backup-postgres.sh` + cron harian 02:30 |

---

## Struktur folder (repo)

```text
.
├── server.js                 # aplikasi (Node http core, routing manual)
├── package.json
├── ecosystem.config.cjs      # konfigurasi PM2
├── deploy.sh                 # helper deploy (git pull + pm2 restart)
├── README.md                 # dokumen ini
├── README-DEPLOY.md          # operasional deploy & runtime
├── CHANGELOG.md              # histori fase
├── TODO.md                   # daftar kerja P0–P3
├── lib/                      # db-schema, env, sheets, default-data, model-utils
├── scripts/                  # init-db, seed-db, create-master-user, backup-postgres.sh
├── docs/                     # konsep, roadmap, status, decisions, dok fase
└── app/                      # frontend statis + data fallback
    ├── *.html                # index, projects, knowledge, ventures, kom, admin…
    ├── assets/               # css, js, img, vendor
    └── data/*.json           # konten fallback (sumber utama = PostgreSQL)
```

> Lokasi production di VPS: `/var/www/rasyid-puteraa/current` (source) &
> `/var/www/rasyid-puteraa/shared` (`.env`, uploads, logs, compose DB).

---

## Fase yang sudah selesai

- **Phase 1** — branding cleanup, domain `rasyid-puteraa.my.id`, cleanup template.
- **Runtime baseline** — `server.js`, `lib/`, `scripts/`, ecosystem & deploy docs masuk Git.
- **Phase 2** — admin login rate-limit, SEO/OG/Twitter card, JSON-LD Person, contact cleanup.
- **Phase 3A** — backup PostgreSQL (script + docs), cron 02:30 aktif, restore test berhasil.

Detail histori: [`CHANGELOG.md`](CHANGELOG.md) · Status terkini:
[`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

---

## Cara memahami repo (mulai dari sini)

1. [`README.md`](README.md) — entry point (dokumen ini).
2. [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — snapshot teknis terkini.
3. [`docs/roadmap.md`](docs/roadmap.md) — prioritas Near/Mid/Later + visi KOM.
4. [`docs/DECISIONS.md`](docs/DECISIONS.md) — keputusan penting & alasannya.
5. [`README-DEPLOY.md`](README-DEPLOY.md) — operasional runtime, DB, backup.
6. [`docs/backup-postgres.md`](docs/backup-postgres.md) — backup & restore DB.
7. `docs/phase-*.md` — catatan fase pembangunan (konteks sejarah).

---

## Keamanan & secret

**Tidak ada secret di repository.** Kredensial (`.env`, `.db_password`,
`credentials.json`, service-account, token) **tidak** di-commit dan diabaikan via
[`.gitignore`](.gitignore). File backup database (`*.sql.gz`) juga diabaikan.
Konfigurasi runtime berada di `/var/www/rasyid-puteraa/shared/.env` di server.
