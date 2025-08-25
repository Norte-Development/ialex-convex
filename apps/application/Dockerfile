# Multi-stage Dockerfile for React + Vite application
FROM node:20-slim as base

# Set working directory
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace configuration first
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Create directories for packages and apps
RUN mkdir -p packages/shared packages/database apps/application

# Copy all package.json files for workspace packages
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/

# Copy application package.json
COPY apps/application/package.json ./apps/application/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source code for all packages
COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/database/src ./packages/database/src/
COPY packages/database/tsconfig.json ./packages/database/

# Build workspace packages (especially @ialex/shared)
RUN pnpm --filter "@ialex/shared" build
RUN pnpm --filter "@ialex/database" build

# Copy application source code
COPY apps/application/src ./apps/application/src/
COPY apps/application/convex ./apps/application/convex/
COPY apps/application/public ./apps/application/public/
COPY apps/application/index.html ./apps/application/
COPY apps/application/vite.config.ts ./apps/application/
COPY apps/application/tsconfig.app.json ./apps/application/
COPY apps/application/tsconfig.node.json ./apps/application/

# Build the application
FROM base as build
WORKDIR /app/apps/application

# Build arguments for environment variables
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_DOCUMENT_PROCESSOR_URL

# Set environment variables for build
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_DOCUMENT_PROCESSOR_URL=$VITE_DOCUMENT_PROCESSOR_URL

RUN pnpm build

# Production stage - using Node.js with vite preview
FROM node:20-slim as production
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Create directories and copy package.json files
RUN mkdir -p packages/shared packages/database apps/application
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/application/package.json ./apps/application/

# Install dependencies including dev dependencies (needed for vite)
RUN pnpm install --frozen-lockfile

# Copy built application from build stage
COPY --from=build /app/apps/application/dist ./apps/application/dist

# Set working directory to application
WORKDIR /app/apps/application

# Expose port 80
EXPOSE 3000

# Use vite preview to serve the built application
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "3000"]