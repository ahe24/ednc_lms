const DatabaseService = require('../src/services/database');

console.log('🚀 데이터베이스 초기화 시작...');

// 데이터베이스 초기화
DatabaseService.initialize();

// 5초 후 종료 (테이블 생성 완료 대기)
setTimeout(() => {
    console.log('📊 데이터베이스 초기화 완료');
    DatabaseService.close();
    process.exit(0);
}, 5000);