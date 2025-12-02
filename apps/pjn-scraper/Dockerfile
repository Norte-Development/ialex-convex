# ---- Builder Stage ----
FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.1.0

# Copy monorepo root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files ONLY for needed packages
COPY packages/shared/package.json ./packages/shared/
COPY apps/pjn-scraper/package.json ./apps/pjn-scraper/

# Install dependencies ONLY for pjn-scraper and its deps (shared)
RUN pnpm install --frozen-lockfile --filter pjn-scraper...

# Copy source code for shared packages (if needed)
COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/

# Build shared packages first (if they have build scripts)
# RUN pnpm --filter "@ialex/shared" build || true

# Copy service source
COPY apps/pjn-scraper ./apps/pjn-scraper

# Build service
RUN pnpm --filter pjn-scraper build

# ---- Runtime Stage ----
FROM node:22-slim AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.1.0

# Copy workspace files needed for pnpm deploy
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/pjn-scraper/package.json ./apps/pjn-scraper/

# Copy built artifacts from builder (shared dist files if they exist)
# COPY --from=builder /app/packages/shared/dist ./packages/shared/dist || true
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Install ONLY production dependencies for pjn-scraper
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod --filter pjn-scraper...

# Copy built pjn-scraper
COPY --from=builder /app/apps/pjn-scraper/dist ./apps/pjn-scraper/dist
COPY --from=builder /app/apps/pjn-scraper/package.json ./apps/pjn-scraper/

# Set working directory to the service
WORKDIR /app/apps/pjn-scraper

# Cloud Run will set PORT environment variable
# Default to 4002 for local development
ENV PORT=4002
ENV NODE_ENV=production
EXPOSE ${PORT}

# Start the application
CMD ["node", "dist/server.js"]

