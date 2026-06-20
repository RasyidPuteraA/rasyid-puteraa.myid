# Roadmap — rasyid-puteraa.my.id

> Domain resmi: **rasyid-puteraa.my.id** (live di production).
> Dokumen ini menggabungkan **prioritas pengembangan terkini** dengan **visi
> produk jangka panjang (KOM)** yang dipertahankan dari desain awal.

## Konsep yang dipertahankan

**Engineering Portfolio & Living Knowledge Archive** — website ini bukan sekadar
CV, melainkan arsip project, pengetahuan, perjalanan, *venture gateway*, dan
fondasi sistem eksplorasi pengetahuan **KOM**. KOM tetap menjadi visi jangka
panjang, **bukan** prioritas dekat.

Fokus publik terdekat: **portfolio engineering, featured projects, knowledge
archive, dan kredibilitas project**.

---

## Prioritas Pengembangan

### 🟢 Near-term (sekarang)
Mempertajam kualitas publik & menutup utang operasional ringan.

- [ ] **Update hero live via admin** — ganti teks hero produksi (sumber DB)
  melalui admin panel agar konsisten dengan positioning baru.
- [ ] **Kurasi featured projects** — pilih 6–8 project terbaik dari arsip,
  lengkapi hasil/metrik & media.
- [ ] **Cleanup profile placeholder** — isi telepon/email/role yang masih
  placeholder (`hello@example.com`, `+62-8xx`, "Placeholder Role") via admin.
- [ ] **GitHub Issues / task tracking** — gunakan Issues + template task sebagai
  task memory (lihat [`DECISIONS.md`](DECISIONS.md)).
- [ ] **Contact endpoint Node** — ganti form `mailto:` dengan `POST /api/contact`
  (rate-limit + anti-spam), tanpa membangun sistem email berat.
- [ ] **Backup monitoring** — verifikasi cron 02:30 berjalan, cek umur/ukuran
  file backup, notifikasi bila gagal.

### 🟡 Mid-term
Maintainability & kualitas produk.

- [ ] **Refactor `server.js` bertahap** — pecah monolith ke modul `routes/`
  tanpa rewrite framework.
- [ ] **Project detail polish** — tampilan, media, related content.
- [ ] **SEO / prerender improvement** — perbaiki konten yang dirender JS agar
  terbaca crawler (mis. prerender/SSR ringan untuk halaman utama).
- [ ] **Admin UX improvement** — kemudahan editing konten & media.

### 🔵 Later (visi jangka panjang — KOM)
Jangan diprioritaskan sebelum Near/Mid stabil.

- [ ] **KOM smart search** — internal full-text search lintas project & knowledge.
- [ ] **KOM AI assistant** — natural language query + knowledge synthesis.
- [ ] **Live project dashboard integration** — embed monitoring (mis. SAKMONITOR/IoT)
  sebagai technical showcase.

---

## Visi Produk Jangka Panjang (KOM)

Evolusi sistem (mind map, bukan timeline tanggal):

```
Website Foundation
      ↓
Content Archive
      ↓
Structured Knowledge
      ↓
KOM Search System
      ↓
KOM AI
```

**Makna KOM — "Kill of Memory":** bukan menghapus ingatan, melainkan membongkar,
menguji, dan memahami ulang ingatan, pengalaman, dan pengetahuan agar maknanya
lebih dalam dan tidak diterima mentah sebagai kebenaran absolut.

Dalam jangka panjang website ini diharapkan menjadi: portfolio profesional, arsip
pengetahuan personal, dokumentasi perjalanan, pusat publikasi karya, dan sistem
eksplorasi pengetahuan melalui KOM — sebuah **living archive** yang terus
berkembang.

> Catatan: rincian fase produk awal (Foundation → Content Archive → Structured
> Knowledge → KOM Search → KOM AI) ada di histori commit dan dokumen fase
> `docs/phase-*.md` sebagai konteks sejarah.
