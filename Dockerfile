ARG PLAYWRIGHT_VERSION=1.49.0
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy

# Instalamos FFmpeg en el sistema del contenedor
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod
COPY src ./src



ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]

# Debe coincidir EXACTO con la versión de "playwright" en package.json
ARG PLAYWRIGHT_VERSION=1.49.0

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy AS base

# Instalamos FFmpeg en el sistema del contenedor
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
    
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Todas las dependencias (para compilar)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Compila TypeScript → dist/
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# Solo dependencias de producción
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Imagen final
FROM base AS runtime
ENV NODE_ENV=production \
    SESSIONS_DIR=/app/sessions
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Aseguramos que la carpeta de videos exista en el runtime
RUN mkdir -p src/application/storage/videos

EXPOSE 3000
CMD ["node", "dist/main.js"]