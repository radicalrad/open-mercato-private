#!/usr/bin/env bash
# PostgreSQL backup script for Open Mercato
# Usage: ./scripts/backup-postgres.sh [backup_dir]
set -euo pipefail

BACKUP_DIR="${1:-/opt/open-mercato/backups/postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
CONTAINER_NAME="open-mercato-postgres"

# Load environment
if [ -f /opt/open-mercato/.env ]; then
  export $(grep -v '^#' /opt/open-mercato/.env | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-open_mercato}"
POSTGRES_DB="${POSTGRES_DB:-open_mercato}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup..."

# Create backup
podman exec "$CONTAINER_NAME" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  | gzip > "$BACKUP_DIR/open_mercato_${TIMESTAMP}.sql.gz"

# Verify backup
if [ -f "$BACKUP_DIR/open_mercato_${TIMESTAMP}.sql.gz" ]; then
  SIZE=$(du -h "$BACKUP_DIR/open_mercato_${TIMESTAMP}.sql.gz" | cut -f1)
  echo "[$(date)] Backup completed: open_mercato_${TIMESTAMP}.sql.gz ($SIZE)"
else
  echo "[$(date)] ERROR: Backup file not created"
  exit 1
fi

# Clean old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
OLD_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)
echo "[$(date)] Retained $OLD_COUNT backups (retention: $RETENTION_DAYS days)"
