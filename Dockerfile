# Dockerfile
# Constrói o frontend (React/Vite) e o backend (Node/Express) e roda os dois
# juntos num container só: o Express serve tanto a API (/api/...) quanto os
# arquivos estáticos do frontend. Pensado pra rodar no EasyPanel (build method
# = "Dockerfile") ou em qualquer outro lugar que suporte Docker.

# ---------- Etapa 1: build do frontend ----------
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Vazio de propósito: backend e frontend ficam na mesma origem em produção
# (ver comentário em src/api.js).
ENV VITE_API_URL=""
RUN npm run build

# ---------- Etapa 2: backend + frontend já buildado ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# python3/make/g++ são necessários pra compilar o better-sqlite3 (código nativo)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public

# Onde o banco SQLite fica salvo. Monte um volume persistente aqui no
# EasyPanel (Storage/Volumes do serviço), senão os dados somem a cada deploy.
ENV DB_PATH=/app/data/associacao.db
RUN mkdir -p /app/data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
