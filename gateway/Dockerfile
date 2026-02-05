FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Copiar package.json do gateway
COPY gateway/package.json gateway/package-lock.json* ./

# Instalar todas as dependências (inclui tsx para runtime)
RUN npm install

# Copiar código do gateway
COPY gateway/tsconfig.json ./
COPY gateway/src ./src

# Copiar sap-connector (dependência via import relativo)
COPY sap-connector ../sap-connector

ENV NODE_ENV=production
EXPOSE 3000

# Usar tsx para executar TypeScript diretamente (como o worker faz)
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
