# Decisions — rasyid-puteraa.my.id

Catatan keputusan penting (architecture/strategy) beserta alasannya. Format
ringkas ala ADR. Terbaru di atas.

---

## D-006 — Domain resmi: rasyid-puteraa.my.id
**Tanggal:** 2026-06-20 · **Status:** Diterima
**Keputusan:** Domain tunggal yang resmi & live adalah `rasyid-puteraa.my.id`.
Penyebutan lama `mrasyid-puteraa.com` / `mrasyidputeraa.com` dianggap usang.
**Alasan:** menghilangkan inkonsistensi branding di kode & dokumentasi.
**Catatan:** dok fase historis (`docs/phase-*.md`, `sitemap.md`,
`codex-instructions.md`, `template-analysis.md`) sengaja **tidak diubah** dan
dibiarkan sebagai konteks sejarah.

## D-005 — Website diarahkan sebagai Engineering Portfolio & Living Knowledge Archive
**Tanggal:** 2026-06-20 · **Status:** Diterima
**Keputusan:** Positioning utama = portfolio engineering + arsip pengetahuan
hidup, bukan sekadar CV. Fokus publik terdekat: featured projects, knowledge
archive, kredibilitas project.
**Alasan:** menonjolkan keunggulan rentang hardware↔software pemilik dan
memberi arah konten yang tajam untuk audiens recruiter/engineer/partner.

## D-004 — Backup DB diprioritaskan sebelum fitur baru
**Tanggal:** 2026-06-20 · **Status:** Diterima
**Keputusan:** Membangun backup PostgreSQL (Phase 3A) lebih dulu sebelum
menambah fitur produk.
**Alasan:** data adalah aset paling sulit dipulihkan; sebelumnya belum ada
backup terjadwal. Risiko kehilangan data > nilai fitur baru jangka pendek.

## D-003 — KOM AI ditunda
**Tanggal:** 2026-06-20 · **Status:** Diterima
**Keputusan:** KOM (smart search → AI assistant) tetap menjadi **visi jangka
panjang**, bukan prioritas dekat. Bila diperlukan, mulai dari search sederhana
(full-text) sebelum AI.
**Alasan:** kompleks & mahal; tidak kritis untuk audiens recruiter; menunda
"website siap dipublikasikan dengan percaya diri".

## D-002 — Deploy hardening di-skip sementara
**Tanggal:** 2026-06-20 · **Status:** Diterima (sementara)
**Keputusan:** Perbaikan besar pipeline deploy (atomic release/symlink,
penguncian origin 80, dsb.) ditunda; saat ini tetap `git pull --ff-only` +
`pm2 restart`.
**Alasan:** menghindari perubahan berisiko pada service live selama fokus pada
branding, hardening ringan, dan backup. **Tindak lanjut:** rapikan working tree
(commit) agar `git pull` tidak konflik; pertimbangkan hardening di fase khusus.

## D-001 — GitHub sebagai history & task memory
**Tanggal:** 2026-06-20 · **Status:** Diterima
**Keputusan:** Repository GitHub `RasyidPuteraA/rasyid-puteraa.myid` dipakai
sebagai sumber kebenaran histori (commit/CHANGELOG) dan task tracking (Issues +
template `.github/ISSUE_TEMPLATE/task.md`).
**Alasan:** menjaga konteks antar sesi/pengerjaan, memudahkan kolaborasi &
pelacakan pekerjaan, dan menghindari kehilangan keputusan.
