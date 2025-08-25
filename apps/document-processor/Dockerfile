# ---- Builder Stage ----
    FROM node:20-slim AS builder
    WORKDIR /app
    
    # Install pnpm
    RUN npm install -g pnpm@9.1.0
    
    # Copy monorepo root manifests
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
    
    # Copy the service manifest
    COPY apps/document-processor/package.json ./apps/document-processor/
    
    # Install all dependencies including devDeps
    RUN pnpm install --frozen-lockfile
    
    # Copy service source
    COPY apps/document-processor ./apps/document-processor
    
    # Build service
    RUN pnpm --filter document-processor build
    
    # ---- Runtime Stage ----
    FROM node:20-slim AS runner
    WORKDIR /app
    
    # Install pnpm (optional if you want to install prod deps via pnpm)
    RUN npm install -g pnpm@9.1.0
    
    # Copy root + service manifests (+ workspace file for lockfile resolution)
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
    COPY apps/document-processor/package.json ./apps/document-processor/
    
    # Install production dependencies for the service
    WORKDIR /app/apps/document-processor
    RUN pnpm install --prod --frozen-lockfile
    
    # Copy built files from builder
    COPY --from=builder /app/apps/document-processor/dist ./dist
    
    EXPOSE 4001
    CMD ["node", "dist/app.js"]