const path = require('path');

// 로그 디렉토리 설정 - 권한에 따라 동적으로 결정
const projectRoot = '/home/csjo/a3_claude/lms_ednc';
let logDir = './log/license-system';

// /var/log 권한 체크
try {
  const fs = require('fs');
  fs.accessSync('/var/log', fs.constants.W_OK);
} catch (err) {
  logDir = path.join(projectRoot, 'logs');
}

module.exports = {
  apps: [
    {
      name: 'license-backend',
      cwd: `${projectRoot}/backend`,
      script: 'src/server.js',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.BACKEND_PORT || 3601,
        HOST: '0.0.0.0',
        DB_PATH: `${projectRoot}/backend/database/licenses.db`,
        UPLOAD_DIR: `${projectRoot}/backend/uploads`,
        JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-please-change-this',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '70998',
        TZ: 'Asia/Seoul',
        LANG: 'ko_KR.UTF-8',
        LC_TIME: 'ko_KR.UTF-8'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: `${logDir}/backend-error.log`,
      out_file: `${logDir}/backend-out.log`,
      log_file: `${logDir}/backend.log`,
      time: true
    },
    {
      name: 'license-frontend',
      cwd: `${projectRoot}/frontend`,
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.FRONTEND_PORT || 3600,
        HOST: '0.0.0.0',
        REACT_APP_API_BASE_URL: 'http://192.168.10.105:3601',
        REACT_APP_SERVER_IP: '192.168.10.105'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: `${logDir}/frontend-error.log`,
      out_file: `${logDir}/frontend-out.log`,
      log_file: `${logDir}/frontend.log`,
      time: true
    }
  ]
};