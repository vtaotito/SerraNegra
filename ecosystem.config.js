// PM2 Ecosystem Configuration
// Para iniciar: pm2 start ecosystem.config.js
// Para ver status: pm2 status
// Para ver logs: pm2 logs

module.exports = {
  apps: [
    {
      name: 'wms-api',
      script: './api/dist/server.js',
      cwd: '/home/wms/wms',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        API_PORT: 8000
      },
      error_file: '/home/wms/logs/api-error.log',
      out_file: '/home/wms/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      watch: false,
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'wms-gateway',
      script: './gateway/dist/index.js',
      cwd: '/home/wms/wms',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 3000
      },
      error_file: '/home/wms/logs/gateway-error.log',
      out_file: '/home/wms/logs/gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '300M',
      watch: false,
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
