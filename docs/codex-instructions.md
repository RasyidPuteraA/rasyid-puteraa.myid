File ini akan menjadi aturan kerja Codex agar saat kamu memberi perintah di VSCode, Codex selalu:

menaruh file di tempat yang benar

tidak merusak template

menjaga struktur project tetap deploy-friendly

mengikuti konsep website yang sudah kita tetapkan

Ini penting supaya project tetap rapi dan scalable.

codex-instructions.md
# Codex Development Instructions
mrasyid-puteraa.com

Dokumen ini berisi aturan kerja Codex saat mengembangkan website ini.

Tujuannya agar struktur project tetap rapi, konsisten, dan mudah dipindahkan ke server VPS di masa depan.

---

# 1. Project Root

Root project berada di:

codex/

Semua pekerjaan development dilakukan di dalam folder ini.

Template asli tidak boleh diubah secara langsung.

---

# 2. Folder Structure

Struktur folder utama:

codex/
│
├─ app/                 → website aktif
├─ docs/                → dokumentasi project
├─ scripts/             → script development
├─ backup-template/     → backup template asli
│
├─ README.md
├─ package.json
└─ .gitignore

---

# 3. Website Source

Semua file website harus berada di:

app/

Contoh struktur:

app/
│
├─ index.html
├─ about.html
├─ projects.html
├─ knowledge.html
├─ kom.html
├─ contact.html
│
├─ assets/
│   ├─ css/
│   ├─ js/
│   ├─ img/
│   └─ vendor/
│
└─ forms/

Jangan menaruh file website di luar folder app.

---

# 4. Template Usage

Template yang digunakan adalah iPortfolio.

Template asli disimpan di:

backup-template/

Codex harus bekerja menggunakan salinan template di folder:

app/

Jangan mengubah file di backup-template.

---

# 5. Development Environment

Website dikembangkan secara lokal.

Preview website menggunakan:

npx serve app

atau menggunakan VSCode Live Server.

Website harus bisa diakses melalui:

http://localhost:5500

---

# 6. Path Rules

Semua asset harus menggunakan path relatif.

Contoh yang benar:

assets/css/style.css

Contoh yang tidak boleh:

C:\Users\RASYID\...

atau

file:///...

Hal ini penting agar website bisa dipindahkan ke server VPS tanpa masalah.

---

# 7. Homepage Rules

Homepage harus berada di:

app/index.html

Homepage berfungsi sebagai portal utama.

Homepage tidak menampilkan semua konten, hanya preview dari:

- identity
- featured projects
- knowledge preview
- ventures
- website evolution map
- KOM preview

---

# 8. Archive Navigation

Konten lengkap website diakses melalui sistem archive.

Navigasi archive menggunakan sidebar yang dapat:

- hide
- expand
- collapse

Kategori utama archive:

- About
- Projects
- Knowledge
- Reviews
- Timeline
- Publications
- Ventures
- Resources
- Contact

---

# 9. KOM System

Website memiliki sistem eksplorasi pengetahuan bernama KOM.

Halaman utama KOM berada di:

app/kom.html

Fungsi KOM pada tahap awal:

- eksplorasi konten
- search system

Pada tahap berikutnya:

- AI knowledge assistant

---

# 10. Development Phases

Development mengikuti roadmap berikut:

Phase 1 — Foundation
Phase 2 — Content Archive
Phase 3 — Structured Knowledge
Phase 4 — KOM Search
Phase 5 — KOM AI

Codex harus mengikuti roadmap ini dan tidak langsung mengimplementasikan fitur kompleks sebelum fase sebelumnya selesai.

---

# 11. Documentation Rules

Semua dokumentasi project harus disimpan di:

docs/

Dokumen utama:

project-charter.md
roadmap.md
sitemap.md
kom-concept.md
codex-instructions.md

---

# 12. Deployment Preparation

Struktur project harus selalu menjaga kompatibilitas untuk deployment ke server VPS.

Prinsip utama:

- gunakan path relatif
- jangan gunakan path Windows
- jangan gunakan dependency lokal yang tidak portable

Folder app harus bisa langsung dipindahkan ke server web seperti:

/var/www/mrasyid-puteraa.com/

---

# 13. Coding Style

Gunakan struktur HTML yang rapi.

Gunakan indentasi konsisten.

Pisahkan:

HTML
CSS
JavaScript

Semua asset disimpan di folder assets.

---

# 14. Safety Rule

Jangan:

- menghapus template tanpa backup
- membuat struktur folder yang kompleks
- menaruh file di luar struktur project
- menggunakan path absolut

Jika melakukan perubahan besar, dokumentasikan di folder docs.
Sekarang kondisi project kamu sudah sangat solid

Kita sudah punya 4 dokumen penting untuk Codex:

docs/
│
├─ project-charter.md
├─ roadmap.md
├─ sitemap.md
└─ codex-instructions.md

Ini membuat Codex paham konteks project secara penuh.