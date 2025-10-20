# ---- Builder Stage ----
FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.1.0

# Copy monorepo root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files ONLY for needed packages
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/document-processor/package.json ./apps/document-processor/

# Install dependencies ONLY for document-processor and its deps (shared, database)
# This skips application and other unneeded packages
RUN pnpm install --frozen-lockfile --filter document-processor...

# Copy source code for shared packages
COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/database/src ./packages/database/src/
COPY packages/database/tsconfig.json ./packages/database/

# Build shared packages first
RUN pnpm --filter "@ialex/shared" build
RUN pnpm --filter "@ialex/database" build

# Copy service source
COPY apps/document-processor ./apps/document-processor

# Build service
RUN pnpm --filter document-processor build

# ---- Runtime Stage ----
FROM node:22-slim AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.1.0

# Copy workspace files needed for pnpm deploy
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/document-processor/package.json ./apps/document-processor/

# Copy built artifacts from builder (shared & database dist files)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/

# Install ONLY production dependencies for document-processor
# Using pnpm deploy creates a production-ready deployment
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod --filter document-processor...

# Copy built document-processor
COPY --from=builder /app/apps/document-processor/dist ./apps/document-processor/dist
COPY --from=builder /app/apps/document-processor/package.json ./apps/document-processor/

# Set working directory to the service
WORKDIR /app/apps/document-processor

# Cloud Run will set PORT environment variable
# Default to 4001 for local development
ENV PORT=4001
ENV NODE_ENV=production
EXPOSE ${PORT}

# Start the application
CMD ["node", "dist/app.js"]