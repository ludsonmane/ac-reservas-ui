# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
ENV CI=true

# instala deps baseado no lockfile disponível
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN set -eux; \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable && corepack prepare pnpm@latest --activate && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    corepack enable && yarn install --frozen-lockfile; \
  else \
    npm ci --no-audit --no-fund; \
  fi

# copia o restante do app
COPY . .

# IMPORTANTE: Vite lê VITE_* no build.
# No Railway, as Variables do serviço são injetadas no build do Docker.
# Se você quiser forçar por ARG, descomente:
# ARG VITE_API_BASE_URL
# ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# build de produção
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# servidor estático leve
RUN npm i -g serve@14

# entrega apenas os arquivos estáticos
COPY --from=build /app/dist ./dist

EXPOSE 3000
# -s: SPA fallback; -l: escuta no 0.0.0.0:PORT (Railway define PORT)
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]
