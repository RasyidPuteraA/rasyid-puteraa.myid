# Backup PostgreSQL — rasyid-puteraa.my.id

Panduan backup & restore database PostgreSQL (`rasyid_db`) yang berjalan di
container Docker `rasyid-postgres`.

Script: [`scripts/backup-postgres.sh`](../scripts/backup-postgres.sh)

> **Prinsip aman**
> - Tidak ada password di-hardcode. `pg_dump` dijalankan di dalam container via
>   local socket (default postgres image: `trust`), jadi tidak butuh password.
> - Script **hanya membaca** database (pg_dump) dan menulis file backup.
>   Tidak mengubah schema/data, tidak me-restart service.
> - File backup dibuat dengan `umask 077` (file `600`, folder `700`).

---

## 1. Variabel environment yang didukung

| Variabel | Default | Keterangan |
|---|---|---|
| `POSTGRES_CONTAINER` | `rasyid-postgres` | Nama container Docker PostgreSQL |
| `POSTGRES_DB` | `rasyid_db` | Nama database |
| `POSTGRES_USER` | `rasyid_user` | User database |
| `BACKUP_DIR` | `/var/backups/rasyid-puteraa/postgres` | Folder output backup |
| `RETENTION_DAYS` | `14` | Hapus backup lebih lama dari N hari |
| `PGPASSWORD` | _(tidak diset)_ | Opsional. Hanya bila pg_hba Anda menuntut password. Tidak pernah ditampilkan. |

---

## 2. Setup folder backup (sekali saja)

Default `/var/backups` dimiliki `root`, sehingga user biasa tidak bisa membuat
subfolder di sana tanpa `sudo`. Pilih salah satu:

**Opsi A — pakai default `/var/backups` (disarankan, sekali pakai sudo):**

```bash
sudo mkdir -p /var/backups/rasyid-puteraa/postgres
sudo chown "$(id -un)":"$(id -gn)" /var/backups/rasyid-puteraa/postgres
sudo chmod 700 /var/backups/rasyid-puteraa/postgres
```

**Opsi B — tanpa sudo, pakai folder milik project:**

```bash
export BACKUP_DIR=/var/www/rasyid-puteraa/backups/postgres
mkdir -p "$BACKUP_DIR"
```

> Jika folder belum siap/writable, script akan berhenti dengan pesan jelas dan
> **tidak** membuat file backup.

---

## 3. Menjalankan backup manual

```bash
cd /var/www/rasyid-puteraa/current
bash scripts/backup-postgres.sh
```

Dengan override environment (contoh folder project + retensi 30 hari):

```bash
BACKUP_DIR=/var/www/rasyid-puteraa/backups/postgres RETENTION_DAYS=30 \
  bash scripts/backup-postgres.sh
```

Contoh output ringkas:

```
[backup-postgres] START 2026-06-20 09:00:00 WIB
[backup-postgres] container=rasyid-postgres db=rasyid_db user=rasyid_user
[backup-postgres] target=/var/backups/rasyid-puteraa/postgres/rasyid_db_20260620-090000.sql.gz retention=14d
[backup-postgres] SUCCESS file=.../rasyid_db_20260620-090000.sql.gz size=128K
[backup-postgres] RETENTION removed=0 (lebih lama dari 14 hari)
[backup-postgres] DONE 2026-06-20 09:00:01 WIB
```

---

## 4. Cek file backup

```bash
ls -lh /var/backups/rasyid-puteraa/postgres
# atau, bila pakai Opsi B:
ls -lh /var/www/rasyid-puteraa/backups/postgres
```

---

## 5. Uji integritas gzip

Pastikan file backup tidak korup (uji dekompresi tanpa menulis output):

```bash
gzip -t /var/backups/rasyid-puteraa/postgres/rasyid_db_YYYYMMDD-HHMMSS.sql.gz \
  && echo "gzip OK"

# (opsional) lihat 20 baris awal isi dump untuk sanity check
zcat /var/backups/rasyid-puteraa/postgres/rasyid_db_YYYYMMDD-HHMMSS.sql.gz | head -20
```

---

## 6. Menambahkan cron harian

Backup harian jam 02:30 + log ke file (cron diedit manual; script ini tidak
menyentuh crontab):

```bash
crontab -e
```

Tambahkan baris:

```cron
30 2 * * * BACKUP_DIR=/var/backups/rasyid-puteraa/postgres RETENTION_DAYS=14 /usr/bin/bash /var/www/rasyid-puteraa/current/scripts/backup-postgres.sh >> /var/log/rasyid-pg-backup.log 2>&1
```

> Pastikan file log writable oleh user cron, atau arahkan ke folder yang
> writable, mis. `>> /var/www/rasyid-puteraa/shared/logs/pg-backup.log 2>&1`.

Verifikasi cron terpasang:

```bash
crontab -l | grep backup-postgres
```

---

## 7. Restore ke database TEST (aman)

> **JANGAN** restore langsung ke `rasyid_db` (production). Selalu uji ke database
> test terlebih dahulu.

Buat database test di container yang sama, lalu restore ke sana:

```bash
# 1) Buat database test (sekali). Aman: terpisah dari production.
docker exec rasyid-postgres createdb -U rasyid_user rasyid_db_test

# 2) Restore dump terpilih ke database test
gunzip -c /var/backups/rasyid-puteraa/postgres/rasyid_db_YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i rasyid-postgres psql -U rasyid_user -d rasyid_db_test

# 3) Verifikasi isi (contoh: hitung jumlah tabel & baris users)
docker exec rasyid-postgres psql -U rasyid_user -d rasyid_db_test \
  -c "\dt" -c "SELECT count(*) FROM users;"

# 4) (opsional) bersihkan database test setelah selesai
docker exec rasyid-postgres dropdb -U rasyid_user rasyid_db_test
```

---

## 8. Restore ke PRODUCTION (manual, hati-hati)

**Lakukan manual, sadar penuh, dan idealnya di luar jam sibuk.** Ringkasan
langkah (TIDAK diotomasi):

1. Ambil backup **baru** terlebih dahulu (lihat bagian 3) sebagai titik aman.
2. Hentikan/percayakan bahwa aplikasi tidak menulis saat restore (mis.
   `pm2 stop rasyid-puteraa`) — keputusan operator.
3. Restore ke database production hanya setelah Anda yakin dump benar (sudah lolos
   uji di database test pada bagian 7).
4. Pertimbangkan strategi restore yang sesuai (drop+recreate DB, atau restore ke
   DB baru lalu repoint `DATABASE_URL`). Ini keputusan manual; jangan jalankan
   sembarang perintah destruktif tanpa backup terbaru.
5. Start kembali aplikasi dan verifikasi.

> Catatan: dump dibuat dengan `--no-owner --no-privileges` agar mudah di-restore
> ke DB/role yang berbeda (mis. database test).
