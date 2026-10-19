// 루트 .env를 로드한 뒤 react-scripts(start/build)를 실행
// 사용법: node scripts/with-root-env.js start | build
require('../../load-env')();

const env = process.env;
env.PORT = env.FRONTEND_PORT || env.PORT || '3600';
env.REACT_APP_BACKEND_PORT = env.BACKEND_PORT || '3601';
if (env.HOST === undefined) env.HOST = '0.0.0.0';
if (env.BROWSER === undefined) env.BROWSER = 'none';

const script = process.argv[2];
if (!['start', 'build', 'test'].includes(script)) {
  console.error(`알 수 없는 스크립트: ${script} (start | build | test)`);
  process.exit(1);
}
require(`react-scripts/scripts/${script}`);
