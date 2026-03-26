FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy packages
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/
COPY apps/web/ ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build Next.js
RUN pnpm --filter web build

# Start script runs both server and web
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000 3001
CMD ["./start.sh"]
