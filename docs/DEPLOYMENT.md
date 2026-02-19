# Deployment Guide

## Prerequisites

- Docker & Docker Compose v2
- Access to GitHub Container Registry (ghcr.io)

## Environment Variables

Create a `.env` file in the project root:

```env
POSTGRES_USER=agentpoker
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=agentpoker
```

## Quick Start (Docker Compose)

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Check service health
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

Services will be available at:
- Lobby API: http://localhost:8080
- Game Server (WS): ws://localhost:8081
- Admin UI: http://localhost:3000

## Using Pre-built Images (ghcr.io)

Images are automatically built and pushed on every push to `master`.

```bash
# Pull latest images
docker pull ghcr.io/<org>/agent-poker/lobby-api:latest
docker pull ghcr.io/<org>/agent-poker/game-server:latest
docker pull ghcr.io/<org>/agent-poker/admin-ui:latest

# Or use a specific commit SHA
docker pull ghcr.io/<org>/agent-poker/lobby-api:<sha>
```

To use pre-built images instead of building locally, update `docker-compose.prod.yml`:
replace the `build:` block with `image: ghcr.io/<org>/agent-poker/<service>:latest`.

## Manual Deployment Steps

1. **Provision infrastructure**: VM or container host with Docker installed.
2. **Clone repository**: `git clone` and `cd agent-poker`.
3. **Configure environment**: Copy `.env.example` to `.env` and fill in secrets.
4. **Start database first**: `docker compose -f docker-compose.prod.yml up -d postgres redis`
5. **Wait for healthy**: `docker compose -f docker-compose.prod.yml ps` (check health status).
6. **Start application**: `docker compose -f docker-compose.prod.yml up -d`
7. **Run migrations**: (if applicable) `docker compose -f docker-compose.prod.yml exec lobby-api node dist/migrate.js`
8. **Verify**: Curl `http://localhost:8080/health` and check WS connectivity on port 8081.

## Monitoring (Optional)

```bash
# Start Prometheus + Grafana
docker compose -f docker/docker-compose.monitoring.yml up -d

# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

## Stopping Services

```bash
docker compose -f docker-compose.prod.yml down

# To also remove volumes (WARNING: deletes database data):
docker compose -f docker-compose.prod.yml down -v
```
