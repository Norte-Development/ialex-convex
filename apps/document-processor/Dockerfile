FROM node:20-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 4001
CMD ["node", "dist/app.js"]

