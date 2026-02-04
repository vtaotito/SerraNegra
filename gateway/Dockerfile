FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Copiar package.json do gateway
COPY gateway/package.json gateway/package-lock.json* ./
RUN npm install --omit=dev

# Copiar código do gateway
COPY gateway/tsconfig.json ./
COPY gateway/src ./src

# Copiar sap-connector (dependência)
COPY sap-connector ../sap-connector

RUN npm install --include=dev && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]

