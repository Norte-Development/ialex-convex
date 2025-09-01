# ---- Builder Stage ----
FROM node:20-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.1.0

# Copy only what's needed for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/document-processor/package.json ./apps/document-processor/

# Install dependencies (this layer will be cached unless package.json changes)
RUN pnpm install --frozen-lockfile

# Copy shared packages (only rebuild if shared code changes)
COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/database/src ./packages/database/src/
COPY packages/database/tsconfig.json ./packages/database/

# Build shared packages (cached unless shared code changes)
RUN pnpm --filter "@ialex/shared" build
RUN pnpm --filter "@ialex/database" build

# Copy only document processor source (this is the key change)
COPY apps/document-processor/src ./apps/document-processor/src/
COPY apps/document-processor/tsconfig.json ./apps/document-processor/
COPY apps/document-processor/package.json ./apps/document-processor/

# Build service (only rebuilds if document-processor or shared code changes)
RUN pnpm --filter document-processor build

# ---- Runtime Stage ----
FROM node:20-slim AS runner
WORKDIR /app

# Install pnpm (optional if you want to install prod deps via pnpm)
RUN npm install -g pnpm@9.1.0

# Copy root + service manifests (+ workspace file for lockfile resolution)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/document-processor/package.json ./apps/document-processor/

# Install production dependencies for the service
WORKDIR /app/apps/document-processor
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/apps/document-processor/dist ./dist

EXPOSE 4001
CMD ["node", "dist/app.js"]