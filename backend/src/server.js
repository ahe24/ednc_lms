require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const moment = require('moment-timezone');

// 한국 시간대 설정
process.env.TZ = 'Asia/Seoul';
moment.tz.setDefault('Asia/Seoul');

const app = express();
const PORT = process.env.PORT || 3601;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`🌏 시간대 설정: ${process.env.TZ}`);
console.log(`📅 현재 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);

// 미들웨어 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS 설정 - 개발 환경에서는 모든 출처 허용
const frontendPort = process.env.FRONTEND_PORT || 3600;
const corsOptions = {
    origin: process.env.NODE_ENV === 'development'
        ? true
        : [
            `http://${process.env.SERVER_IP || 'localhost'}:${frontendPort}`,
            new RegExp(`^http:\\/\\/192\\.168\\.\\d{1,3}\\.\\d{1,3}:${frontendPort}$`),
            new RegExp(`^http:\\/\\/10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}:${frontendPort}$`)
        ],
    credentials: true
};
app.use(require('cors')(corsOptions));

// 정적 파일 서빙 (업로드된 파일)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// 데이터베이스 초기화
const DatabaseService = require('./services/database');
const { authenticate, requireAdmin, requireReadAccess } = require('./middleware/auth');
DatabaseService.initialize();

// 라우트 import
const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/licenses');
const dashboardRoutes = require('./routes/dashboard');

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/dashboard', requireReadAccess, dashboardRoutes);

// 헬스 체크 (한국어 응답)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        message: '시스템이 정상적으로 작동 중입니다',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        timezone: 'Asia/Seoul',
        server: `${HOST}:${PORT}`,
        uptime: Math.floor(process.uptime()),
        uptimeFormat: `${Math.floor(process.uptime() / 3600)}시간 ${Math.floor((process.uptime() % 3600) / 60)}분`
    });
});

// 시간 정보 API
app.get('/api/time', (req, res) => {
    const now = moment();
    res.json({
        current: now.format('YYYY-MM-DD HH:mm:ss'),
        formatted: now.format('YYYY년 MM월 DD일 dddd HH시 mm분'),
        timezone: 'Asia/Seoul',
        iso: now.toISOString()
    });
});

// 기본 라우트
app.get('/', (req, res) => {
    res.json({
        message: 'EDNC License 관리 시스템 백엔드 API',
        version: '1.0.0',
        time: moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')
    });
});

// 에러 핸들링 (한국어)
app.use((err, req, res, next) => {
    console.error('오류 발생:', err);
    res.status(500).json({ 
        error: '서버 내부 오류',
        message: process.env.NODE_ENV === 'development' ? err.message : '문제가 발생했습니다. 관리자에게 문의하세요.',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

// 404 핸들링 (한국어)
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'API 엔드포인트를 찾을 수 없습니다',
        path: req.originalUrl,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

app.listen(PORT, HOST, () => {
    console.log(`\n🚀 Siemens License 관리 시스템 백엔드`);
    console.log(`📍 서버 주소: http://${HOST}:${PORT}`);
    console.log(`🗄️  데이터베이스: ${process.env.DB_PATH || 'backend/database/licenses.db'}`);
    console.log(`📁 업로드 디렉토리: ${uploadDir}`);
    console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🕐 시작 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
    console.log(`🌏 시간대: ${moment.tz.guess()} (${process.env.TZ})\n`);
});

// 프로세스 종료 처리 (한국어)
process.on('SIGINT', () => {
    console.log('\n👋 시스템을 안전하게 종료합니다...');
    console.log(`🕐 종료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
    DatabaseService.close();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ 처리되지 않은 예외:', error);
    console.log(`🕐 오류 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
});

module.exports = app;