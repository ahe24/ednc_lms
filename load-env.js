// 루트 .env 파일을 process.env에 로드하는 공용 로더 (backend, frontend, PM2 공통 사용)
// - 의존성 없이 직접 파싱 (PM2 전역 컨텍스트에서도 동작)
// - 이미 설정된 환경변수는 덮어쓰지 않음 (PM2/셸에서 지정한 값이 우선)
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');

function loadRootEnv() {
  try {
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
          if (process.env[key] === undefined) process.env[key] = val;
        }
      }
    });
  } catch (e) { /* .env 파일 없으면 기본값 사용 */ }
  return process.env;
}

module.exports = loadRootEnv;
