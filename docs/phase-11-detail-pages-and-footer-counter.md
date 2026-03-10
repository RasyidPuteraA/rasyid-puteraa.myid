# Phase 11 - Detail Pages and Footer Counter

Tanggal: 2026-03-09

## Tujuan
Phase 11 mengubah archive listing menjadi navigasi detail nyata (blog/article style), menambahkan metadata detail content (date/likes/cover/content/sections), serta menambahkan visitor counter prototype berbasis localStorage.

## Ringkasan Hasil
1. Ditambahkan halaman detail baru:
   - `app/project-detail.html`
   - `app/knowledge-detail.html`
2. Ditambahkan JavaScript baru:
   - `app/assets/js/detail-render.js`
   - `app/assets/js/visitor-counter.js`
3. Skema data `projects.json` dan `knowledge.json` diperluas secara non-breaking dengan field:
   - `date`
   - `likes`
   - `cover_image`
   - `content`
   - `sections`
   - `author`
4. Tombol archive sekarang mengarah ke detail page:
   - Project: `project-detail.html?id=<project-id>`
   - Knowledge: `knowledge-detail.html?id=<knowledge-id>`
5. Ditambahkan likes prototype berbasis localStorage per item ID.
6. Ditambahkan visitor counter prototype pada footer halaman publik (local browser counter).

## Perubahan Teknis
### 1) Detail Pages
- `project-detail.html`
  - Layout article-style: title area, metadata, cover image, content body, sections, related knowledge, back link.
- `knowledge-detail.html`
  - Layout article-style: title, metadata, cover image, summary/content, key insights sections, related projects, back link.

### 2) Renderer Detail
- `assets/js/detail-render.js`
  - Membaca query param `id`.
  - Membaca data source dari `DataLoader` (`profile`, `projects`, `knowledge`) dengan fallback fetch.
  - Merender detail content berdasarkan tipe halaman (`project-detail-page` / `knowledge-detail-page`).
  - Menangani:
    - metadata row
    - tags
    - structured sections (paragraph/list/steps)
    - related references
    - not-found state
  - Menyimpan likes per item ke localStorage key `mrp_detail_likes_v1`.

### 3) Visitor Counter
- `assets/js/visitor-counter.js`
  - Menghitung total view + per-page view menggunakan localStorage key `mrp_visitor_counter_v1`.
  - Menampilkan text di footer:
    - `Visitor counter: ... views (... on this page, local browser).`
  - Scope hanya halaman publik (admin pages di-skip).

### 4) Data Schema Upgrade
- `data/projects.json`
  - Semua entry project kini memiliki field detail (date/likes/cover_image/content/sections/author).
  - `url` diarahkan ke `project-detail.html?id=<id>`.
- `data/knowledge.json`
  - Semua entry knowledge kini memiliki field detail (date/likes/cover_image/content/sections/author).
  - `url` diarahkan ke `knowledge-detail.html?id=<id>`.

### 5) Public Navigation Update
- `assets/js/public-render.js`
  - CTA projects archive diarahkan ke detail page.
  - CTA knowledge archive diarahkan ke detail page.
- `visitor-counter.js` di-include ke halaman publik:
  - `index.html`
  - `projects.html`
  - `knowledge.html`
  - `ventures.html`
  - `kom.html`
  - plus halaman detail baru.

### 6) Styling
- `assets/css/main.css`
  - Ditambahkan style section:
    - `Detail Pages + Visitor Counter`
  - Menjaga visual tetap konsisten dengan palette dan typography template publik.

## Validasi
Endpoint berikut terverifikasi `200 OK` di localhost:
- `/project-detail.html?id=prj-ev-001`
- `/knowledge-detail.html?id=knw-tech-001`
- `/assets/js/detail-render.js`
- `/assets/js/visitor-counter.js`
- `/projects.html`
- `/knowledge.html`

## Catatan
- Semua fitur tetap local-first dan static-site compatible.
- Likes dan visitor counter adalah prototype browser-local; data tidak sinkron antar device/browser.

## Update Lanjutan (Admin + Share)
1. Admin dashboard (`admin.html` + `admin-panel.js`) sekarang mendukung edit field detail untuk Projects dan Knowledge:
   - `date`, `likes`, `cover_image`, `author`, `content`, `sections`
2. Field `sections` pada admin memakai format satu baris per section:
   - `Title | paragraph | text`
   - `Title | list | item1; item2; item3`
   - `Title | steps | step1; step2`
3. Detail pages sekarang memiliki tombol:
   - `Share` (Web Share API jika tersedia)
   - `Copy Link` (clipboard fallback)
4. Jika URL dikosongkan pada form admin:
   - project otomatis ke `project-detail.html?id=<id>`
   - knowledge otomatis ke `knowledge-detail.html?id=<id>`
