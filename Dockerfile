# Express API only. Web stays on Vercel.
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN corepack pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN corepack pnpm --filter @revivenotes/shared build \
  && corepack pnpm --filter @revivenotes/api build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "corepack pnpm --filter @revivenotes/api exec prisma migrate deploy && corepack pnpm --filter @revivenotes/api start"]
