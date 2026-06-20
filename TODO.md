# TODO — rasyid-puteraa.my.id

Daftar kerja ringkas. Detail arah ada di [`docs/roadmap.md`](docs/roadmap.md).
Prioritas: **P0** kritis · **P1** tinggi · **P2** sedang · **P3** nanti.

## P0 — Kritis
- [ ] Commit working tree lintas-fase (Phase 1/2/3A) ke Git; pastikan `deploy.sh`
      (`git pull --ff-only`) tidak konflik.
- [ ] Aktifkan rate-limit login (reload PM2 agar `server.js` baru termuat).
- [ ] Verifikasi cron backup 02:30 benar-benar menghasilkan file & retensi jalan.

## P1 — Tinggi
- [ ] Update hero **live** via admin (sumber DB), selaraskan dengan positioning.
- [ ] Cleanup profile placeholder (email/telepon/role) via admin.
- [ ] Kurasi 6–8 featured projects (hasil/metrik + media).
- [ ] Setup GitHub Issues + template task sebagai task memory.
- [ ] Backup monitoring (alert bila gagal / file basi).

## P2 — Sedang
- [ ] Contact endpoint Node `POST /api/contact` (rate-limit + anti-spam),
      ganti `mailto:`.
- [ ] SEO: pre-render/perbaiki konten yang dirender JS untuk crawler.
- [ ] Refactor `server.js` bertahap ke modul `routes/` (tanpa ganti framework).
- [ ] Selesaikan dualitas sumber data `app/data/*.json` vs PostgreSQL (satu sumber kebenaran).

## P3 — Nanti
- [ ] Project detail polish & admin UX improvement.
- [ ] KOM smart search (full-text internal).
- [ ] KOM AI assistant.
- [ ] Live project dashboard integration (mis. SAKMONITOR/IoT).
