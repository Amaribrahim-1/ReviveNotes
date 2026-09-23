# Express API only. Web stays on Vercel.
FROM node:22-bookworm-slim

WORKDIR /app

# Prisma needs OpenSSL on Debian slim images.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN corepack pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api

# prisma generate reads DATABASE_URL at build time; runtime env replaces this.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"

RUN corepack pnpm --filter @revivenotes/shared build \
  && corepack pnpm --filter @revivenotes/api build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "corepack pnpm --filter @revivenotes/api exec prisma migrate deploy && corepack pnpm --filter @revivenotes/api start"]
