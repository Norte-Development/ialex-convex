# IALEX Docker Setup Guide

This guide explains how to run the IALEX application using Docker Compose. The setup includes the frontend React application, document processor service, and Redis for job queuing.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development)
- External services already configured:
  - Convex backend
  - Qdrant vector database

## Quick Start

1. **Clone the repository and navigate to the project root**

2. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```

   Edit the `.env.local` file and fill in your actual values:
   - `VITE_CONVEX_URL`: Your Convex deployment URL
   - `QDRANT_URL`: Your Qdrant instance URL
   - `QDRANT_API_KEY`: Your Qdrant API key
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `MISTRAL_API_KEY`: Your Mistral API key
   - `DEEPGRAM_API_KEY`: Your Deepgram API key
   - `HMAC_SECRET`: A secure secret key for HMAC signing

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Document Processor API: http://localhost:4001

## Development Workflow

### Using Docker Compose for Development

The setup includes hot reload capabilities for both frontend and document processor:

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build
```

### Local Development (Alternative)

If you prefer to run some services locally:

```bash
# Run Redis with Docker
docker-compose up redis -d

# Run frontend locally
cd apps/application
pnpm dev

# Run document processor locally
cd apps/document-processor
pnpm dev
```

## Services Overview

### Frontend Service
- **Image**: Custom Node.js 20 with Vite
- **Port**: 5173 (development), 4173 (preview)
- **Features**:
  - Hot reload in development
  - React + TypeScript + Vite
  - Connected to external Convex backend

### Document Processor Service
- **Image**: Custom Node.js 20
- **Port**: 4001
- **Features**:
  - Document processing and AI integration
  - Uses Redis for job queuing (BullMQ)
  - Connected to external Qdrant for vector storage
  - Health check endpoint: `/health`

### Redis Service
- **Image**: Redis 7 Alpine
- **Port**: 6379
- **Features**:
  - Persistent storage with AOF
  - Used by document processor for job queuing
  - Health checks enabled

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CONVEX_URL` | Convex backend URL | `https://your-project.convex.cloud` |
| `QDRANT_URL` | Qdrant instance URL | `https://your-qdrant-instance.com` |
| `QDRANT_API_KEY` | Qdrant API key | `your-api-key` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-your-key` |
| `MISTRAL_API_KEY` | Mistral API key | `your-key` |
| `DEEPGRAM_API_KEY` | Deepgram API key | `your-key` |
| `HMAC_SECRET` | HMAC secret for security | `secure-random-string` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `WORKER_CONCURRENCY` | `2` | Number of worker processes |

## Docker Compose Commands

### Common Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Rebuild specific service
docker-compose build [service-name]
docker-compose up -d [service-name]

# Execute commands in running containers
docker-compose exec frontend sh
docker-compose exec document-processor sh

# Scale services
docker-compose up -d --scale document-processor=3
```

### Service-Specific Commands

```bash
# Frontend development
docker-compose exec frontend pnpm install
docker-compose exec frontend pnpm build

# Document processor
docker-compose exec document-processor pnpm install
docker-compose exec document-processor pnpm build

# Redis
docker-compose exec redis redis-cli ping
```

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check if ports are in use
   lsof -i :5173
   lsof -i :4001
   lsof -i :6379

   # Change ports in docker-compose.override.yml if needed
   ```

2. **Environment variables not loaded**
   ```bash
   # Ensure .env.local file exists in project root
   ls -la .env.local

   # Check if variables are set
   docker-compose config
   ```

3. **Build failures**
   ```bash
   # Clear Docker cache
   docker system prune -f

   # Rebuild without cache
   docker-compose build --no-cache
   ```

4. **Permission issues**
   ```bash
   # Fix permissions on mounted volumes
   sudo chown -R $USER:$USER .
   ```

### Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# View health status
docker inspect <container-name> | grep -A 10 Health
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# Follow specific service logs
docker-compose logs -f frontend
docker-compose logs -f document-processor

# View last N lines
docker-compose logs --tail=100 frontend
```

## Production Deployment

For production deployment:

1. **Use production environment file**
   ```bash
   cp docker-env.example .env.production
   # Edit with production values
   ```

2. **Use production Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

3. **Consider using Docker secrets for sensitive data**
   ```bash
   echo "your-secret" | docker secret create qdrant_api_key -
   ```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │ Document        │
│   (React +      │    │ Processor       │
│   Vite)         │    │ (Node.js)       │
│                 │    │                 │
│   Port: 5173    │◄──►│   Port: 4001    │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Convex        │    │     Redis       │
│   Backend       │    │   (Queue)       │
│   (External)    │    │                 │
└─────────────────┘    │   Port: 6379   │
                      └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │    Qdrant       │
                    │   Vector DB     │
                    │  (External)     │
                    └─────────────────┘
```

## Security Considerations

1. **Never commit .env.local files** to version control
2. **Use strong HMAC secrets** for production
3. **Keep API keys secure** and rotate regularly
4. **Use Docker secrets** for production deployments
5. **Regularly update** base images

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify environment variables are set correctly
3. Ensure external services (Convex, Qdrant) are accessible
4. Check Docker and Docker Compose versions
5. Verify network connectivity between containers
