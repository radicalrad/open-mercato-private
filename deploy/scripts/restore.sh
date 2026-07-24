#!/usr/bin/env bash
# Restore script for Open Mercato
# Usage: ./scripts/restore.sh <backup_file>
# Example: ./scripts/restore.sh backups/postgres/open_mercato_20260724_030000.sql.gz
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 backups/postgres/open_mercato_20260724_030000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load environment
if [ -f /opt/open-mercato/.env ]; then
  export $(grep -v '^#' /opt/open-mercato/.env | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-open_mercato}"
POSTGRES_DB="${POSTGRES_DB:-open_mercato}"
CONTAINER_NAME="open-mercato-postgres"

echo "[$(date)] Starting restore from $BACKUP_FILE..."

# Stop app services (keep postgres running)
echo "[$(date)] Stopping app services..."
podman-compose -f deploy/podman-compose.prod.yml stop app

# Restore PostgreSQL
echo "[$(date)] Restoring PostgreSQL..."
gunzip -c "$BACKUP_FILE" \
  | podman exec -i "$CONTAINER_NAME" \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists

# Restart app services
echo "[$(date)] Starting app services..."
podman-compose -f deploy/podman-compose.prod.yml start app

# Wait for health
echo "[$(date)] Waiting for app to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "[$(date)] App is healthy!"
    echo "[$(date)] Restore completed successfully"
    exit 0
  fi
  sleep 10
done

echo "[$(date)] WARNING: App health check failed after 5 minutes"
echo "[$(date)] Check logs with: podman-compose -f deploy/podman-compose.prod.yml logs app"
exit 1
