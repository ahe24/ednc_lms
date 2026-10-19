const path = require('path');

// 루트 .env 로드 (호스트/포트/보안 설정은 루트 .env 한 곳에서만 관리)
require('./load-env')();

// 로그 디렉토리 설정 - 권한에 따라 동적으로 결정
const projectRoot = __dirname;

const SERVER_IP = process.env.SERVER_IP || 'localhost';
const BACKEND_PORT = process.env.BACKEND_PORT || 3601;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3600;
let logDir = './logs/license-system';

// /var/log 권한 체크
try {
  const fs = require('fs');
  fs.accessSync('./logs', fs.constants.W_OK);
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
        PORT: BACKEND_PORT,
        HOST: '0.0.0.0',
        SERVER_IP: SERVER_IP,
        FRONTEND_PORT: FRONTEND_PORT,
        DB_PATH: `${projectRoot}/backend/database/licenses.db`,
        UPLOAD_DIR: `${projectRoot}/backend/uploads`,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
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
        PORT: FRONTEND_PORT,
        HOST: '0.0.0.0',
        BROWSER: 'none',
        // API 주소는 브라우저 접속 주소(window.location.hostname) + 백엔드 포트로 자동 결정
        // → LAN IP / DDNS 어느 쪽으로 접속해도 동작
        REACT_APP_BACKEND_PORT: BACKEND_PORT
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
