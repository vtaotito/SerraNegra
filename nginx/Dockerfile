FROM nginx:1.27-alpine

# Incluir a configuração diretamente na imagem
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -fsS http://localhost/health || exit 1

EXPOSE 80
