#!/usr/bin/env bash
# Database backup script for agent-poker.
# Creates timestamped pg_dump backups with configurable retention.
#
# Usage:
#   ./scripts/backup-db.sh                    # Backup with defaults
#   ./scripts/backup-db.sh --retain 30        # Keep 30 days of backups
#   ./scripts/backup-db.sh --restore <file>   # Restore from backup file
#
# Environment variables:
#   POSTGRES_USER     (default: agentpoker)
#   POSTGRES_DB       (default: agentpoker)
#   POSTGRES_HOST     (default: localhost)
#   POSTGRES_PORT     (default: 5432)
#   BACKUP_DIR        (default: ./backups)
#   BACKUP_RETAIN_DAYS (default: 14)

set -euo pipefail

# Configuration
POSTGRES_USER="${POSTGRES_USER:-agentpoker}"
POSTGRES_DB="${POSTGRES_DB:-agentpoker}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

# Parse arguments
RESTORE_FILE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --retain)
      BACKUP_RETAIN_DAYS="$2"
      shift 2
      ;;
    --restore)
      RESTORE_FILE="$2"
      shift 2
      ;;
    --help)
      head -15 "$0" | tail -12
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Restore mode
if [ -n "${RESTORE_FILE}" ]; then
  if [ ! -f "${RESTORE_FILE}" ]; then
    echo "ERROR: Backup file not found: ${RESTORE_FILE}"
    exit 1
  fi

  echo "WARNING: This will overwrite the '${POSTGRES_DB}' database on ${POSTGRES_HOST}:${POSTGRES_PORT}."
  echo "Press Ctrl+C within 5 seconds to cancel..."
  sleep 5

  echo "Restoring from: ${RESTORE_FILE}"
  if [[ "${RESTORE_FILE}" == *.gz ]]; then
    gunzip -c "${RESTORE_FILE}" | psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
  else
    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${RESTORE_FILE}"
  fi
  echo "Restore complete."
  exit 0
fi

# Backup mode
mkdir -p "${BACKUP_DIR}"

echo "Starting backup of ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}..."

# Use docker exec if running in Docker context, otherwise direct pg_dump
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "agent-poker-postgres"; then
  echo "Using Docker container for pg_dump..."
  docker exec agent-poker-postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"
else
  pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"
fi

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "Backup created: ${BACKUP_FILE} (${FILESIZE})"

# Cleanup old backups
if [ "${BACKUP_RETAIN_DAYS}" -gt 0 ]; then
  DELETED=$(find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.sql.gz" -mtime +"${BACKUP_RETAIN_DAYS}" -print -delete | wc -l)
  if [ "${DELETED}" -gt 0 ]; then
    echo "Cleaned up ${DELETED} backup(s) older than ${BACKUP_RETAIN_DAYS} days."
  fi
fi

echo "Backup complete. Retention: ${BACKUP_RETAIN_DAYS} days."
