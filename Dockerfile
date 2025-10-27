# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# deps
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# código
COPY . .

# Vite lê VITE_* em build (ok manter), mas vamos também injetar em runtime
ARG VITE_API_BASE_URL
ARG PUBLIC_APP_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV PUBLIC_APP_BASE_URL=${PUBLIC_APP_BASE_URL}

RUN npm run build

# ---------- run ----------
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# servidor estático
RUN npm i -g serve@14 && apk add --no-cache bash

# artefatos
COPY --from=build /app/dist ./dist

# entrypoint: gera __cfg.js com API_BASE_URL e sobe o server
RUN printf '%s\n' '#!/usr/bin/env bash
set -euo pipefail

# API_BASE_URL vem do ambiente do Railway
: "${API_BASE_URL:=}"
if [ -z "$API_BASE_URL" ]; then
  # fallback para VITE_API_BASE_URL se esquecer de setar em runtime
  API_BASE_URL="${VITE_API_BASE_URL:-}"
fi

echo "[entry] API_BASE_URL=${API_BASE_URL:-<vazio>}"

# gera /dist/__cfg.js para o client ler em runtime
cat > /app/dist/__cfg.js <<EOF
window.__CFG = Object.assign({}, window.__CFG, {
  API_BASE_URL: ${API_BASE_URL:+\"$API_BASE_URL\"}
});
EOF

# sobe SPA
exec serve -s dist -l "tcp://0.0.0.0:${PORT}"
' > /app/entry.sh && chmod +x /app/entry.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

CMD ["/app/entry.sh"]
