# README Deploy - rasyid-puteraa.my.id

Dokumen ini menjelaskan operasional deployment website `rasyid-puteraa.my.id` di VPS.

## 1) Struktur Folder

- `/var/www/rasyid-puteraa/current`  
  Source code aktif yang dijalankan PM2.
- `/var/www/rasyid-puteraa/shared/.env`  
  Environment production (dipakai oleh PM2 melalui `env_file`).
- `/var/www/rasyid-puteraa/shared/uploads`  
  Penyimpanan file upload persisten.
- `/var/www/rasyid-puteraa/shared/logs`  
  Log aplikasi PM2 (`out.log` dan `error.log`).
- `/var/www/rasyid-puteraa/shared/docker-compose.db.yml`  
  Konfigurasi PostgreSQL khusus project ini.
- `/var/www/rasyid-puteraa/releases`  
  Cadangan lokasi release bila ingin dipakai strategi release-based deploy.
- `/var/www/rasyid-puteraa/backups`  
  Backup file sebelum perubahan penting.

## 2) Cara Update dari Git

Masuk ke folder app lalu pull terbaru:

```bash
cd /var/www/rasyid-puteraa/current
git pull --ff-only
```

## 3) Cara Restart PM2

Restart hanya app ini:

```bash
pm2 restart rasyid-puteraa --update-env
pm2 save
```

Cek status:

```bash
pm2 list
pm2 logs rasyid-puteraa --lines 50 --nostream
```

## 4) Lokasi Environment

- File utama: `/var/www/rasyid-puteraa/shared/.env`
- Symlink (di repo aktif): `/var/www/rasyid-puteraa/current/.env`

## 5) Lokasi Logs

- `/var/www/rasyid-puteraa/shared/logs/out.log`
- `/var/www/rasyid-puteraa/shared/logs/error.log`

## 6) Informasi Database Baru (Terpisah)

PostgreSQL project ini tidak memakai resource serbada.

- Container: `rasyid-postgres`
- Image: `postgres:16`
- Host port: `127.0.0.1:5433`
- Database: `rasyid_db`
- User: `rasyid_user`
- Volume: `rasyid_postgres_data`
- Compose file: `/var/www/rasyid-puteraa/shared/docker-compose.db.yml`

Perintah cek database:

```bash
docker ps --filter name=rasyid-postgres
docker exec rasyid-postgres pg_isready -U rasyid_user -d rasyid_db
```
