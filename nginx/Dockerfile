FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY nginx/nginx.conf /etc/nginx/nginx.conf

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -fsS http://localhost/health || exit 1

EXPOSE 80
