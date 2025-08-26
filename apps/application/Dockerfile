# Build stage
FROM node:20-slim as build
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Create dirs
RUN mkdir -p packages/shared packages/database apps/application

# Copy package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/application/package.json ./apps/application/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY apps/application ./apps/application

# Build the app
WORKDIR /app/apps/application
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_DOCUMENT_PROCESSOR_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_DOCUMENT_PROCESSOR_URL=$VITE_DOCUMENT_PROCESSOR_URL
RUN pnpm build

# Production stage - Nginx
FROM nginx:alpine as production
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built app from build stage
COPY --from=build /app/apps/application/dist ./

# Copy custom nginx config (optional, see below)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]