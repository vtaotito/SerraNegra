# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências
COPY web-next/package*.json ./
RUN npm ci

# Copiar código fonte
COPY web-next/ ./

# Variáveis de ambiente para build
ARG NEXT_PUBLIC_API_BASE_URL="/api"
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Garantir que public existe
RUN mkdir -p public

# Build da aplicação
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar arquivos necessários
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Instalar curl para healthcheck
RUN apk add --no-cache curl

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -fsS http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
