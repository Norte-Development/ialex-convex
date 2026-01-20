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
# This skips application and other unneeded packages
RUN pnpm install --frozen-lockfile --filter pjn-scraper...

# Copy source code for shared packages
COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/

# Build shared packages first
RUN pnpm --filter "@ialex/shared" build

# Copy service source
COPY apps/pjn-scraper ./apps/pjn-scraper

# Build service
RUN pnpm --filter pjn-scraper build

# ---- Runtime Stage ----
FROM node:22-slim AS runner
WORKDIR /app

# Install system dependencies required for Playwright/Chromium
# These are needed for headless browser operation in Cloud Run
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.1.0

# Copy workspace files needed for pnpm deploy
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/pjn-scraper/package.json ./apps/pjn-scraper/

# Copy built artifacts from builder (shared dist files)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Install ONLY production dependencies for pjn-scraper
# Using pnpm deploy creates a production-ready deployment
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod --filter pjn-scraper...

# Install Playwright browsers (Chromium) - required for scraping
# This must be done after installing dependencies
WORKDIR /app/apps/pjn-scraper
RUN pnpm exec playwright install chromium

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
