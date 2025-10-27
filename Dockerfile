# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# 1) Dependências (cache-friendly)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 2) Código
COPY . .

# 3) Vars de build (Vite lê VITE_* em build)
ARG VITE_API_BASE_URL
ARG PUBLIC_APP_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV PUBLIC_APP_BASE_URL=${PUBLIC_APP_BASE_URL}

# 4) Falhe cedo se esquecer o VITE_API_BASE_URL
RUN sh -lc 'test -n "$VITE_API_BASE_URL" || { echo "❌ VITE_API_BASE_URL não definido (Build Arg)"; exit 1; }'
RUN echo "🔧 VITE_API_BASE_URL=$VITE_API_BASE_URL" && \
    echo "🔧 PUBLIC_APP_BASE_URL=${PUBLIC_APP_BASE_URL:-<vazio>}"

# 5) Build do Vite
RUN npm run build

# ---------- run ----------
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# servidor estático
RUN npm i -g serve@14

# artefatos do build
COPY --from=build /app/dist ./dist

# ENTRYPOINT: gera __cfg.js em runtime com API_BASE_URL (override opcional)
# Requer que seu index.html tenha: <script src="/__cfg.js"></script>
RUN printf '%s\n' '#!/bin/sh
set -eu

# Preferir API_BASE_URL do ambiente (Railway). Fallback: VITE_API_BASE_URL embutido no build.
API_BASE="${API_BASE_URL:-${VITE_API_BASE_URL:-}}"
echo "[entry] API_BASE_URL=${API_BASE:-<vazio>}"

# Gera /dist/__cfg.js para o client ler em runtime
# Se API_BASE estiver vazio, fica como undefined (não quebra chamadas relativas)
{
  echo "window.__CFG = Object.assign({}, window.__CFG, {"
  if [ -n "${API_BASE}" ]; then
    echo "  API_BASE_URL: \"${API_BASE}\""
  fi
  echo "});"
} > /app/dist/__cfg.js

# Sobe SPA
exec serve -s dist -l tcp://0.0.0.0:${PORT}
' > /app/entry.sh && chmod +x /app/entry.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

CMD ["/app/entry.sh"]
