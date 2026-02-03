FROM node:20-alpine

WORKDIR /app/worker

RUN apk add --no-cache curl

COPY worker/package.json worker/package-lock.json* ./
RUN npm install

COPY worker/src ./src

# libs locais (mantém layout de monorepo)
COPY sap-connector ../sap-connector
COPY mappings ../mappings

ENV NODE_ENV=production

CMD ["./node_modules/.bin/tsx", "src/index.ts"]

