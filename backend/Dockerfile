FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Prisma reads DATABASE_URL from prisma.config.ts during client generation.
# The URL is only validated at this build step; Compose supplies the real value.
ENV DATABASE_URL=postgresql://inventory:inventory@db:5432/inventory?schema=public

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# Prisma CLI initializes the schema in docker-entrypoint.sh.
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
