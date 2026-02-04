FROM node:20-alpine AS build

WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./

ARG VITE_API_BASE_URL
ARG VITE_USE_MOCK=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
