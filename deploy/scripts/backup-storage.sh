#!/usr/bin/env bash
# Storage backup script for Open Mercato
# Usage: ./scripts/backup-storage.sh [backup_dir]
set -euo pipefail

BACKUP_DIR="${1:-/opt/open-mercato/backups/storage}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
STORAGE_PATH="${STORAGE_PATH:-/opt/open-mercato/data/storage}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting storage backup..."

if [ ! -d "$STORAGE_PATH" ]; then
  echo "[$(date)] WARNING: Storage path $STORAGE_PATH does not exist, skipping"
  exit 0
fi

# Create backup
tar czf "$BACKUP_DIR/storage_${TIMESTAMP}.tar.gz" -C "$STORAGE_PATH" .

# Verify backup
if [ -f "$BACKUP_DIR/storage_${TIMESTAMP}.tar.gz" ]; then
  SIZE=$(du -h "$BACKUP_DIR/storage_${TIMESTAMP}.tar.gz" | cut -f1)
  echo "[$(date)] Backup completed: storage_${TIMESTAMP}.tar.gz ($SIZE)"
else
  echo "[$(date)] ERROR: Backup file not created"
  exit 1
fi

# Clean old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
OLD_COUNT=$(find "$BACKUP_DIR" -name "*.tar.gz" | wc -l)
echo "[$(date)] Retained $OLD_COUNT backups (retention: $RETENTION_DAYS days)"
