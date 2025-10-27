# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# 1) Dependências (cache-friendly)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 2) Código
COPY . .

# 3) Vars de build (Vite lê VITE_* em tempo de build)
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

# servidor estático leve
RUN npm i -g serve@14

# artefatos apenas
COPY --from=build /app/dist ./dist

# porta/health
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

# SPA: -s (single page), bind no PORT do Railway
CMD ["sh", "-lc", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
