# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Dependências
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Código
COPY . .

# Passar variáveis de build (Vite lê VITE_* em tempo de build)
ARG VITE_API_BASE_URL
ARG PUBLIC_APP_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV PUBLIC_APP_BASE_URL=${PUBLIC_APP_BASE_URL}

# Build
RUN npm run build

# ---------- run ----------
FROM node:20-alpine AS run
WORKDIR /app

# Servidor estático
RUN npm i -g serve@14

# Copia artefatos
COPY --from=build /app/dist ./dist

# Portas/ENV padrão Railway
ENV PORT=8080
EXPOSE 8080

# Healthcheck simples
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

# Sobe
CMD ["sh", "-lc", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
