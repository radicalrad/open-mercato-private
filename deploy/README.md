# Open Mercato Deployment Guide

## Overview

This guide covers deploying Open Mercato using Podman (not Docker Compose) with a private GitHub fork and CI/CD pipeline.

## Prerequisites

- Podman installed on the target server
- podman-compose installed (`pip3 install podman-compose`)
- GitHub account with access to `radicalrad/open-mercato-private`
- SSH access to deployment server

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/radicalrad/open-mercato-private.git
cd open-mercato-private

# Copy environment template
cp deploy/env/.env.production.template .env

# Generate strong secrets and fill the placeholders in .env
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # MEILISEARCH_MASTER_KEY
openssl rand -base64 24   # OM_INIT_SUPERADMIN_PASSWORD
# Replace each <GENERATE_*> placeholder in .env with one of the above.

# Edit .env with your values
nano .env
```

**Required variables in .env for `podman-compose.prod.yml`:**
`POSTGRES_PASSWORD`, `MEILISEARCH_MASTER_KEY`, `SESSION_SECRET`, `JWT_SECRET`, `OM_INIT_SUPERADMIN_PASSWORD`.

If any of these is missing, `podman-compose up` will fail with a clear error like `variable is required`. This is intentional — no default credentials.

### 2. First Deployment

```bash
# Pull the latest image
podman pull ghcr.io/radicalrad/open-mercato-app:latest

# Start all services
podman-compose -f deploy/podman-compose.prod.yml up -d

# Check status
podman-compose -f deploy/podman-compose.prod.yml ps

# View logs
podman-compose -f deploy/podman-compose.prod.yml logs -f app
```

**Default superadmin credentials** (set during first run from `OM_INIT_SUPERADMIN_EMAIL` / `OM_INIT_SUPERADMIN_PASSWORD`):
- Email: `superadmin@acme.com` (override via `OM_INIT_SUPERADMIN_EMAIL`)
- Password: the value of `OM_INIT_SUPERADMIN_PASSWORD` in `.env`

Log in at <http://localhost:3000>, then change the password from the admin UI and remove `OM_INIT_SUPERADMIN_*` from `.env` for subsequent restarts.

### 3. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Check all services
podman-compose -f deploy/podman-compose.prod.yml ps
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:

1. **Build**: Multi-stage Docker build, push to GHCR
2. **Security Scan**: Trivy vulnerability scanning
3. **Staging Deploy**: Automatic deployment to staging server
4. **Production Deploy**: Manual approval required, deploys to production

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `STAGING_HOST` | Staging server IP/hostname |
| `PRODUCTION_HOST` | Production server IP/hostname |
| `DEPLOY_USER` | SSH user for deployment |
| `DEPLOY_SSH_KEY` | SSH private key for deployment |

### Manual Deployment

```bash
# Deploy specific version
gh workflow run deploy.yml -f image_tag=abc1234

# Or trigger manually
gh workflow run deploy.yml
```

## Backup and Restore

### Backup

```bash
# Backup PostgreSQL
./deploy/scripts/backup-postgres.sh

# Backup storage
./deploy/scripts/backup-storage.sh
```

### Restore

```bash
# Restore from backup
./deploy/scripts/restore.sh backups/postgres/open_mercato_20260724_030000.sql.gz
```

## Monitoring

### Health Checks

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| App | GET /api/health | 200 OK |
| PostgreSQL | pg_isready | ready to accept connections |
| Redis | redis-cli ping | PONG |
| Meilisearch | GET /health | 200 OK |

### Logs

```bash
# View app logs
podman-compose -f deploy/podman-compose.prod.yml logs -f app

# View all logs
podman-compose -f deploy/podman-compose.prod.yml logs -f

# View specific service
podman logs open-mercato-postgres
podman logs open-mercato-redis
```

## Rollback

### Application Rollback

```bash
# Set image tag to previous version
export IMAGE_TAG=<previous-tag>
podman-compose -f deploy/podman-compose.prod.yml pull
podman-compose -f deploy/podman-compose.prod.yml up -d
```

### Full Stack Rollback

```bash
# Restore database
./deploy/scripts/restore.sh backups/postgres/<timestamp>.sql.gz

# Restore storage
tar xzf backups/storage/<timestamp>.tar.gz -C /opt/open-mercato/data/storage

# Deploy known good version
export IMAGE_TAG=<known-good-tag>
podman-compose -f deploy/podman-compose.prod.yml up -d --force-recreate
```

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
podman logs open-mercato-app

# Check container status
podman ps -a

# Restart specific service
podman-compose -f deploy/podman-compose.prod.yml restart app
```

### Database Connection Issues

```bash
# Check PostgreSQL status
podman exec open-mercato-postgres pg_isready

# Check connection from app
podman exec open-mercato-app curl -f http://postgres:5432

# Print the resolved DATABASE_URL the app container sees
podman exec open-mercato-app env | grep DATABASE_URL
```

**`DATABASE_URL` looks wrong / has `***` in it:** the placeholder in `.env` was not replaced, or the compose file's `DATABASE_URL` line is malformed. The expected pattern is:

```yaml
DATABASE_URL: postgresql://${POSTGRES_USER:-open_mercato}:${POSTGRES_PASSWORD}@postgres:5432/open_mercato
```

If you see `***` literally in the env inside the container, you are running an older compose file — re-pull with `podman-compose -f deploy/podman-compose.prod.yml pull && podman-compose -f deploy/podman-compose.prod.yml up -d`.

### Health Check Failures

```bash
# Check app logs
podman logs open-mercato-app | tail -100

# Check if all dependencies are running
podman-compose -f deploy/podman-compose.prod.yml ps

# Manually test health endpoint
curl -v http://localhost:3000/api/health
```

**Compose refuses to start with "variable is required":** one of the required secrets is missing from `.env`. See the `Required variables in .env` list in step 1 above. The most common culprit is `OM_INIT_SUPERADMIN_PASSWORD` after a fresh clone.

**Cannot log in with `superadmin@acme.com` after a fresh deploy:** the `OM_INIT_SUPERADMIN_*` env vars were not set on first run, so no superadmin was created. Set them in `.env`, then run `podman-compose -f deploy/podman-compose.prod.yml up -d --force-recreate app`. Re-creating only the `app` service after a clean database will trigger the init path.

## Security Notes

- All containers run as non-root users
- PostgreSQL and Redis are only accessible from within the container network
- Use strong passwords and rotate them regularly
- Enable HTTPS in production (use a reverse proxy like Traefik or nginx)
- Review Trivy scan results in GitHub Actions

## Support

For issues or questions, refer to:
- Open Mercato Documentation: https://docs.open-mercato.com
- GitHub Issues: https://github.com/radicalrad/open-mercato-private/issues
