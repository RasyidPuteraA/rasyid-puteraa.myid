# rasyid-puteraa.my.id — Konsep & Filosofi

> Dokumen ini menjelaskan **konsep, visi, dan filosofi** website (sengaja
> dipertahankan dari desain awal). Untuk status teknis terkini lihat
> [`PROJECT_STATUS.md`](PROJECT_STATUS.md), arah pengembangan di
> [`roadmap.md`](roadmap.md), dan entry point repo di [`../README.md`](../README.md).
>
> **Status (Juni 2026):** website sudah **live di production** pada domain
> `rasyid-puteraa.my.id` (Node.js + PM2 + Nginx + Cloudflare Tunnel + PostgreSQL).
> Narasi awal "dikembangkan lokal di laptop Windows / migrasi ke VPS nanti" sudah
> tidak berlaku dan dibiarkan hanya sebagai konteks sejarah.

Website personal profesional yang berfungsi sebagai portfolio, knowledge archive, dokumentasi perjalanan, dan fondasi sistem eksplorasi pengetahuan bernama **KOM**.

---

## Project Vision

Website ini tidak hanya menjadi portfolio statis, tetapi berkembang menjadi **living knowledge archive** yang menyimpan:

- karya dan project
- pembelajaran dan pengetahuan
- dokumentasi perjalanan
- publikasi tulisan
- venture / business gateway
- sistem eksplorasi pengetahuan melalui **KOM**

---

## Core Concept

### Website Role
Website ini berfungsi sebagai:

- personal professional portfolio
- project archive
- knowledge archive
- publication hub
- venture gateway
- future AI-based knowledge system

### KOM
KOM adalah sistem internal website untuk eksplorasi pengetahuan.

Tahap perkembangan KOM:

1. arsip terstruktur
2. internal search engine
3. simple AI knowledge assistant

Makna filosofis KOM:

**KOM — Kill of Memory**

Bukan berarti menghapus ingatan secara literal, tetapi membongkar, menguji, dan memahami ulang ingatan, pengalaman, dan pengetahuan agar maknanya lebih dalam dan tidak diterima secara mentah sebagai kebenaran absolut.

---

## Development Status

Website sudah **live di production**. Fase yang sudah selesai:

- **Phase 1** — branding cleanup, domain `rasyid-puteraa.my.id`, cleanup template.
- **Runtime baseline** — `server.js`, `lib/`, `scripts/`, `package.json`, ecosystem, deploy docs masuk Git.
- **Phase 2** — admin login rate-limit, SEO/OG/Twitter card, JSON-LD Person, contact flow cleanup.
- **Phase 3A** — script backup PostgreSQL + docs, backup manual & restore test berhasil, cron 02:30 aktif.

Snapshot teknis terkini: [`PROJECT_STATUS.md`](PROJECT_STATUS.md) · Prioritas berikutnya: [`roadmap.md`](roadmap.md).

---

## Folder Structure

```text
codex/
│
├── app/                  # website aktif
├── docs/                 # dokumentasi project
├── scripts/              # helper scripts untuk development
├── backup-template/      # backup template asli
│
├── .vscode/              # pengaturan VSCode
├── .gitignore
├── package.json
└── README.md
Keterangan folder
app/

Semua file website aktif berada di sini.

Contoh:

index.html

about.html

projects.html

knowledge.html

kom.html

contact.html

assets/

docs/

Berisi dokumentasi konsep dan aturan kerja project.

Isi penting:

project-charter.md

roadmap.md

sitemap.md

codex-instructions.md

scripts/

Berisi script bantuan untuk development lokal.

backup-template/

Berisi salinan template mentah yang tidak boleh diubah langsung.

Development Rules

Semua pengembangan website dilakukan di folder app/

Template asli tidak diubah langsung

Semua asset menggunakan relative path

Jangan gunakan absolute path Windows

Struktur file harus tetap mudah dipindahkan ke VPS Linux

Local Development

Project dikembangkan dan dipreview secara lokal terlebih dahulu.

Opsi 1 — Menggunakan Node.js

Jalankan dari root project:

npx serve app -l 5500

Lalu buka di browser:

http://localhost:5500
Opsi 2 — Menggunakan VSCode Live Server

Buka folder project di VSCode, lalu jalankan preview dari folder app.

Recommended Setup

Pastikan environment berikut tersedia:

VSCode

Node.js

npm

Git

Codex / assistant workflow di editor

Cek versi:

node -v
npm -v
git --version
Homepage Concept

Homepage berfungsi sebagai public portal, bukan full archive.

Section utama homepage:

Hero / Introduction

Identity Snapshot

Featured Projects

Website Evolution Map

Knowledge Preview

Ventures

KOM Preview

Contact

Homepage harus terasa:

clean

profesional

ringkas

visual

Archive Concept

Konten lengkap website diakses melalui sidebar navigation yang bisa hide/unhide.

Kategori utama archive:

About

Projects

Knowledge

Reviews

Timeline

Publications

Ventures

Resources

Contact

Website Evolution Roadmap

Website dirancang berkembang dalam fase berikut:

Phase 1 — Foundation

Portfolio dasar dan identitas website.

Phase 2 — Content Archive

Mulai mengisi dokumentasi project, knowledge, dan review.

Phase 3 — Structured Knowledge

Kategori, tag, dan relasi antar konten.

Phase 4 — KOM Search

Implementasi internal search engine.

Phase 5 — KOM AI

Pengembangan simple AI knowledge assistant.

Deployment (sudah berjalan di production)

Project sudah dideploy ke VPS. Lokasi production saat ini:

/var/www/rasyid-puteraa/current/   # source aktif (dijalankan PM2 sebagai "rasyid-puteraa")
/var/www/rasyid-puteraa/shared/    # .env, uploads, logs, docker-compose.db.yml

Prinsip yang tetap dipertahankan: source aktif di `app/`, asset path relatif, tidak
bergantung path lokal Windows. Detail operasional ada di
[`../README-DEPLOY.md`](../README-DEPLOY.md).
Main Documentation

Baca file berikut sebelum development lanjutan:

docs/project-charter.md

docs/roadmap.md

docs/sitemap.md

docs/codex-instructions.md
