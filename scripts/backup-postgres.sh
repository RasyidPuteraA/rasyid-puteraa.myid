#!/usr/bin/env bash
#
# backup-postgres.sh — Backup PostgreSQL untuk rasyid-puteraa.my.id
#
# Aman & sederhana:
#   - Tidak ada password yang di-hardcode.
#   - Auth memakai local socket di DALAM container (default postgres image: trust),
#     sehingga pg_dump tidak butuh password. Bila pg_hba Anda menuntut password,
#     set variabel PGPASSWORD di environment (TIDAK pernah di-echo oleh script ini).
#   - Output: <BACKUP_DIR>/<DB>_<timestamp>.sql.gz (atomic via .partial -> mv).
#   - Retention: hapus backup lebih lama dari RETENTION_DAYS.
#
# Script ini TIDAK mengubah database, schema, atau service. Hanya membaca (pg_dump)
# dan menulis file backup.
#
set -euo pipefail

# File backup bersifat sensitif (berisi data) -> buat dengan permission 600 / dir 700.
umask 077

# --- Konfigurasi (semua bisa di-override lewat environment) ---
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-rasyid-postgres}"
POSTGRES_DB="${POSTGRES_DB:-rasyid_db}"
POSTGRES_USER="${POSTGRES_USER:-rasyid_user}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rasyid-puteraa/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="${BACKUP_DIR}/${POSTGRES_DB}_${timestamp}.sql.gz"
tmp_file="${backup_file}.partial"

log() { printf '[backup-postgres] %s\n' "$*"; }

log "START $(date '+%F %T %Z')"
log "container=${POSTGRES_CONTAINER} db=${POSTGRES_DB} user=${POSTGRES_USER}"
log "target=${backup_file} retention=${RETENTION_DAYS}d"

# --- Prasyarat: docker tersedia & container berjalan ---
if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: 'docker' tidak ditemukan di PATH."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${POSTGRES_CONTAINER}"; then
  log "ERROR: container '${POSTGRES_CONTAINER}' tidak berjalan."
  exit 1
fi

# --- Pastikan folder backup ada & writable ---
if ! mkdir -p "${BACKUP_DIR}" 2>/dev/null; then
  log "ERROR: gagal membuat ${BACKUP_DIR}."
  log "       Buat sekali secara manual (lihat docs/backup-postgres.md), contoh:"
  log "       sudo mkdir -p ${BACKUP_DIR} && sudo chown \"\$(id -un)\":\"\$(id -gn)\" ${BACKUP_DIR}"
  log "       atau jalankan dengan BACKUP_DIR=<folder yang writable>."
  exit 1
fi
if [ ! -w "${BACKUP_DIR}" ]; then
  log "ERROR: ${BACKUP_DIR} tidak writable oleh user $(id -un)."
  exit 1
fi

# --- Teruskan PGPASSWORD HANYA bila sudah ada di environment (tanpa menampilkannya) ---
pw_args=()
if [ -n "${PGPASSWORD:-}" ]; then
  pw_args=(-e "PGPASSWORD=${PGPASSWORD}")
  log "info: PGPASSWORD terdeteksi dari environment (nilainya tidak ditampilkan)."
fi

# --- Dump -> gzip. set -o pipefail memastikan kegagalan pg_dump terdeteksi. ---
if docker exec "${pw_args[@]}" "${POSTGRES_CONTAINER}" \
      pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-privileges \
    | gzip -c > "${tmp_file}"; then
  mv -f "${tmp_file}" "${backup_file}"
  size="$(du -h "${backup_file}" | cut -f1)"
  log "SUCCESS file=${backup_file} size=${size}"
else
  rm -f "${tmp_file}"
  log "ERROR: pg_dump gagal. Tidak ada file backup yang dibuat."
  exit 1
fi

# --- Retention: hapus backup lama (>RETENTION_DAYS) milik DB ini saja ---
deleted_count=0
while IFS= read -r old; do
  [ -n "${old}" ] || continue
  rm -f "${old}"
  deleted_count=$((deleted_count + 1))
done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${POSTGRES_DB}_*.sql.gz" -mtime "+${RETENTION_DAYS}" 2>/dev/null)
log "RETENTION removed=${deleted_count} (lebih lama dari ${RETENTION_DAYS} hari)"

log "DONE $(date '+%F %T %Z')"
