# Template Analysis - iPortfolio (codex/app)

## 1) Struktur Folder Template (`codex/app`)

```text
codex/app/
|- index.html
|- portfolio-details.html
|- service-details.html
|- starter-page.html
|- Readme.txt
|- forms/
|  |- contact.php
|  |- Readme.txt
|- assets/
   |- css/
   |  |- main.css
   |- js/
   |  |- main.js
   |- img/
   |  |- hero-bg.jpg, my-profile-img.jpg, services.jpg, favicon, dll
   |  |- portfolio/ (12 gambar portfolio)
   |  |- testimonials/ (5 gambar testimonial)
   |- vendor/
   |  |- bootstrap/
   |  |- bootstrap-icons/
   |  |- aos/
   |  |- typed.js/
   |  |- purecounter/
   |  |- waypoints/
   |  |- glightbox/
   |  |- imagesloaded/
   |  |- isotope-layout/
   |  |- swiper/
   |  |- php-email-form/
   |- scss/
      |- Readme.txt
```

## 2) File Utama Website

- `index.html`
  - Halaman landing utama one-page (sidebar nav + section lengkap).
- `portfolio-details.html`
  - Halaman detail project portfolio (slider + info project + breadcrumbs).
- `service-details.html`
  - Halaman detail layanan (deskripsi service + list layanan + breadcrumbs).
- `starter-page.html`
  - Template kosong dasar untuk membuat halaman baru custom.
- Catatan:
  - File `inner-page.html` tidak ada pada paket ini; penggantinya adalah `starter-page.html`.

## 3) Fungsi Folder Penting

- `codex/app/assets/css`
  - Menyimpan stylesheet utama: `main.css` (global style, warna, layout, section style).
- `codex/app/assets/js`
  - Menyimpan JavaScript utama template: `main.js` (orchestrator interaksi UI).
- `codex/app/assets/vendor`
  - Library pihak ketiga (Bootstrap, AOS, Swiper, Isotope, GLightbox, dll).
- `codex/app/assets/img`
  - Asset visual statis: foto profil, hero background, portfolio images, testimonial images.
- `codex/app/forms`
  - Endpoint form kontak (`contact.php`) + petunjuk penggunaan.
  - Bergantung pada library `assets/vendor/php-email-form/php-email-form.php` (pro-only).

## 4) Analisis `codex/app/index.html`

### Struktur Umum

- `<head>`
  - Meta viewport + title template.
  - Load font Google: Roboto, Poppins, Raleway.
  - Load CSS vendor: Bootstrap, Bootstrap Icons, AOS, GLightbox, Swiper.
  - Load CSS utama: `assets/css/main.css`.
- `<body class="index-page">`
  - `header#header`: sidebar profil + social + navmenu.
  - `<main class="main">`: berisi seluruh section konten one-page.
  - `footer#footer`: copyright + credit.
  - Komponen utilitas:
    - tombol `#scroll-top`
    - `#preloader`
  - Script load di akhir body:
    - vendor JS + `assets/js/main.js`

### Section di `index.html` (berdasarkan `id`)

- `hero`
- `about`
- `stats`
- `skills`
- `resume`
- `portfolio`
- `services`
- `testimonials`
- `contact`

### Poin Fungsional Penting

- Hero menggunakan `typed.js` lewat elemen `.typed` + `data-typed-items`.
- Portfolio menggunakan struktur Isotope:
  - `.isotope-layout`
  - `.isotope-filters`
  - `.isotope-container` dan item `.isotope-item`
- Preview portfolio memakai `glightbox`.
- Testimonials memakai `swiper` dengan konfigurasi JSON inline (`.swiper-config`).
- Contact form:
  - `<form class="php-email-form" action="forms/contact.php">`
  - diproses oleh `assets/vendor/php-email-form/validate.js`.

## 5) Section Utama Template

Section yang Anda minta dan tersedia di `index.html`:

- `hero`
- `about`
- `resume`
- `portfolio`
- `services`
- `contact`

Section tambahan bawaan template:

- `stats`
- `skills`
- `testimonials`

## 6) Sistem Navigasi Template

- Tipe navigasi:
  - Sidebar vertikal (`nav#navmenu`) dengan anchor hash (`#hero`, `#about`, dst).
- Desktop:
  - Sidebar fixed di kiri.
- Mobile:
  - Tombol `.header-toggle` membuka/menutup sidebar (class `header-show`).
- Dropdown:
  - Mendukung multi-level dropdown di dalam nav.
- Active state:
  - Scrollspy JS menandai link aktif sesuai posisi scroll.
- Perilaku tambahan:
  - Klik nav link pada mode mobile otomatis menutup sidebar.
  - Saat load URL dengan hash, posisi scroll dikoreksi agar sesuai offset section.

## 7) File JavaScript Utama dan Kontrol Interaksi

File utama kontrol UI:

- `codex/app/assets/js/main.js`

Kontrol fitur:

- Animasi:
  - `AOS.init(...)` untuk animation on scroll.
  - `Typed` untuk animasi teks di hero.
  - `Waypoint` untuk animasi progress bar di section skills.
  - `Swiper` untuk slider (testimonials dan portfolio details).
- Scrolling:
  - Tombol scroll-to-top (`.scroll-top`).
  - Hash-scroll correction saat page load.
  - Scrollspy active nav (`navmenuScrollspy`).
- Navigation:
  - Toggle sidebar mobile (`headerToggle`).
  - Toggle dropdown nav mobile (`.toggle-dropdown`).
- Portfolio filter:
  - `imagesLoaded(...)` + `new Isotope(...)` pada `.isotope-layout`.
  - Event klik filter `.isotope-filters li` untuk `arrange({ filter })`.

Vendor JS yang dipakai bersama `main.js`:

- `bootstrap.bundle.min.js`
- `aos.js`
- `typed.umd.js`
- `purecounter_vanilla.js`
- `noframework.waypoints.js`
- `glightbox.min.js`
- `imagesloaded.pkgd.min.js`
- `isotope.pkgd.min.js`
- `swiper-bundle.min.js`
- `php-email-form/validate.js`

## 8) Komponen Reusable untuk Project `mrasyid-puteraa.com`

- Sidebar profile + social links + navmenu.
- Komponen `section-title` (judul + deskripsi per section).
- Layout section siap pakai:
  - About, Resume timeline, Services cards, Portfolio grid, Contact block.
- Portfolio module lengkap:
  - filter + lightbox + detail page link.
- Testimonials module berbasis Swiper (config JSON inline).
- Page title + breadcrumbs untuk halaman internal.
- Contact form UI + status states (`loading`, `error-message`, `sent-message`).
- Utility global:
  - preloader, scroll-top button, dark/light section presets.
- Design token via CSS custom properties (font/color variables di `:root`).

## 9) Catatan Implementasi

- `forms/contact.php` belum benar-benar siap dipakai production tanpa file library pro:
  - membutuhkan `assets/vendor/php-email-form/php-email-form.php`.
- Folder `assets/scss` pada paket ini hanya berisi info, bukan source SCSS penuh (pro-only).
- Untuk kustomisasi aman, pusat perubahan nanti umumnya ada di:
  - `index.html`
  - `assets/css/main.css`
  - `assets/js/main.js`
