const express = require('express');
const moment = require('moment-timezone');
const DatabaseService = require('../services/database');
const LicenseParser = require('../services/licenseParser');

const router = express.Router();

// 대시보드 요약 정보
router.get('/summary', async (req, res) => {
    try {
        // 기본 통계 쿼리들을 병렬로 실행
        const [
            totalLicensesResult,
            totalFeaturesResult,
            activeSitesResult,
            departmentBreakdownResult,
            expiringIn30DaysResult,
            expiringIn7DaysResult,
            expiredResult
        ] = await Promise.all([
            // 총 License 수
            DatabaseService.get('SELECT COUNT(*) as count FROM licenses'),
            
            // 총 피처 수
            DatabaseService.get('SELECT COUNT(*) as count FROM license_features'),
            
            // 활성 사이트 수
            DatabaseService.get('SELECT COUNT(DISTINCT site_id) as count FROM licenses'),
            
            // 부서별 분포
            DatabaseService.all(`
                SELECT department, COUNT(*) as count 
                FROM licenses 
                WHERE department IS NOT NULL 
                GROUP BY department
            `),
            
            // 30일 내 만료 예정
            DatabaseService.get(`
                SELECT COUNT(DISTINCT l.id) as count 
                FROM licenses l
                LEFT JOIN license_features lf ON l.id = lf.license_id
                WHERE lf.expiry_date BETWEEN date('now') AND date('now', '+30 days')
            `),
            
            // 7일 내 만료 예정
            DatabaseService.get(`
                SELECT COUNT(DISTINCT l.id) as count 
                FROM licenses l
                LEFT JOIN license_features lf ON l.id = lf.license_id
                WHERE lf.expiry_date BETWEEN date('now') AND date('now', '+7 days')
            `),
            
            // 이미 만료된 것
            DatabaseService.get(`
                SELECT COUNT(DISTINCT l.id) as count 
                FROM licenses l
                LEFT JOIN license_features lf ON l.id = lf.license_id
                WHERE lf.expiry_date < date('now')
            `)
        ]);

        // 부서별 분포를 객체로 변환
        const departmentBreakdown = {};
        departmentBreakdownResult.forEach(item => {
            if (item.department) {
                departmentBreakdown[item.department] = item.count;
            }
        });

        // 최근 업로드 정보
        const recentUploads = await DatabaseService.all(`
            SELECT l.*, s.site_name 
            FROM licenses l
            LEFT JOIN sites s ON l.site_id = s.id
            ORDER BY l.upload_date DESC 
            LIMIT 5
        `);

        // 가장 빠른 만료일과 가장 늦은 만료일
        const expiryRange = await DatabaseService.get(`
            SELECT 
                MIN(expiry_date) as earliest_expiry,
                MAX(expiry_date) as latest_expiry
            FROM license_features
        `);

        const summary = {
            totalLicenses: totalLicensesResult.count,
            totalFeatures: totalFeaturesResult.count,
            activeSites: activeSitesResult.count,
            expiringIn30Days: expiringIn30DaysResult.count,
            expiringIn7Days: expiringIn7DaysResult.count,
            expired: expiredResult.count,
            departmentBreakdown: departmentBreakdown,
            recentUploads: recentUploads.map(upload => ({
                ...upload,
                uploadDate: DatabaseService.formatDateTimeForDisplay(upload.upload_date)
            })),
            expiryRange: {
                earliest: expiryRange.earliest_expiry ? DatabaseService.formatDateForDisplay(expiryRange.earliest_expiry) : null,
                latest: expiryRange.latest_expiry ? DatabaseService.formatDateForDisplay(expiryRange.latest_expiry) : null
            },
            systemInfo: {
                lastUpdated: moment().format('YYYY년 MM월 DD일 HH시 mm분'),
                timezone: 'Asia/Seoul',
                server: `${process.env.HOST || 'localhost'}:${process.env.PORT || 3601}`
            }
        };

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('대시보드 요약 정보 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '대시보드 요약 정보 조회 중 오류가 발생했습니다'
        });
    }
});

// 만료 상태별 차트 데이터
router.get('/expiry-chart', async (req, res) => {
    try {
        const chartData = await DatabaseService.all(`
            SELECT 
                CASE 
                    WHEN expiry_date < date('now') THEN 'expired'
                    WHEN expiry_date = date('now') THEN 'expires_today'
                    WHEN expiry_date BETWEEN date('now', '+1 day') AND date('now', '+7 days') THEN 'expires_soon'
                    WHEN expiry_date BETWEEN date('now', '+8 days') AND date('now', '+30 days') THEN 'expires_warning'
                    ELSE 'active'
                END as status,
                COUNT(*) as count
            FROM license_features
            GROUP BY 1
        `);

        // 한국어 라벨과 색상 추가
        const chartDataWithLabels = chartData.map(item => {
            const labels = {
                'expired': { name: '만료됨', color: '#ff4d4f' },
                'expires_today': { name: '오늘 만료', color: '#faad14' },
                'expires_soon': { name: '7일 내 만료', color: '#fa8c16' },
                'expires_warning': { name: '30일 내 만료', color: '#fadb14' },
                'active': { name: '정상', color: '#52c41a' }
            };

            return {
                status: item.status,
                count: item.count,
                name: labels[item.status]?.name || item.status,
                color: labels[item.status]?.color || '#d9d9d9'
            };
        });

        res.json({
            success: true,
            data: chartDataWithLabels
        });

    } catch (error) {
        console.error('만료 차트 데이터 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '만료 차트 데이터 조회 중 오류가 발생했습니다'
        });
    }
});

// 월별 업로드 통계
router.get('/upload-trend', async (req, res) => {
    try {
        const { months = 12 } = req.query;
        
        const trendData = await DatabaseService.all(`
            SELECT 
                strftime('%Y-%m', upload_date) as month,
                COUNT(*) as count
            FROM licenses
            WHERE upload_date >= date('now', '-${parseInt(months)} months')
            GROUP BY strftime('%Y-%m', upload_date)
            ORDER BY month
        `);

        // 한국어 월 형식으로 변환
        const trendDataFormatted = trendData.map(item => ({
            month: moment(item.month + '-01').format('YYYY년 MM월'),
            count: item.count,
            rawMonth: item.month
        }));

        res.json({
            success: true,
            data: trendDataFormatted
        });

    } catch (error) {
        console.error('업로드 트렌드 데이터 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '업로드 트렌드 데이터 조회 중 오류가 발생했습니다'
        });
    }
});

// 사이트별 통계
router.get('/sites-summary', async (req, res) => {
    try {
        const sitesData = await DatabaseService.all(`
            SELECT 
                s.id,
                s.site_name,
                s.site_number,
                COUNT(DISTINCT l.id) as license_count,
                COUNT(lf.id) as feature_count,
                MIN(lf.expiry_date) as earliest_expiry,
                MAX(lf.expiry_date) as latest_expiry,
                SUM(CASE WHEN lf.expiry_date < date('now') THEN 1 ELSE 0 END) as expired_count,
                SUM(CASE WHEN lf.expiry_date BETWEEN date('now') AND date('now', '+30 days') THEN 1 ELSE 0 END) as expiring_soon_count
            FROM sites s
            LEFT JOIN licenses l ON s.id = l.site_id
            LEFT JOIN license_features lf ON l.id = lf.license_id
            GROUP BY s.id, s.site_name, s.site_number
            HAVING license_count > 0
            ORDER BY license_count DESC
        `);

        // 만료 상태 추가
        const sitesWithStatus = sitesData.map(site => ({
            ...site,
            earliestExpiryFormatted: site.earliest_expiry ? DatabaseService.formatDateForDisplay(site.earliest_expiry) : null,
            latestExpiryFormatted: site.latest_expiry ? DatabaseService.formatDateForDisplay(site.latest_expiry) : null,
            healthStatus: site.expired_count > 0 ? 'critical' : 
                         site.expiring_soon_count > 0 ? 'warning' : 'healthy'
        }));

        res.json({
            success: true,
            data: sitesWithStatus
        });

    } catch (error) {
        console.error('사이트별 요약 정보 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '사이트별 요약 정보 조회 중 오류가 발생했습니다'
        });
    }
});

// 시스템 상태 정보
router.get('/system-status', async (req, res) => {
    try {
        // 데이터베이스 파일 크기 확인
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../database/licenses.db');
        let dbSize = 0;
        try {
            const stats = require('fs').statSync(dbPath);
            dbSize = Math.round(stats.size / 1024 / 1024 * 100) / 100; // MB 단위
        } catch (err) {
            console.warn('데이터베이스 파일 크기 확인 실패:', err.message);
        }

        // 업로드 디렉토리 크기 확인
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        let uploadSize = 0;
        let fileCount = 0;
        try {
            const files = require('fs').readdirSync(uploadDir);
            fileCount = files.length;
            files.forEach(file => {
                const filePath = path.join(uploadDir, file);
                const stats = require('fs').statSync(filePath);
                uploadSize += stats.size;
            });
            uploadSize = Math.round(uploadSize / 1024 / 1024 * 100) / 100; // MB 단위
        } catch (err) {
            console.warn('업로드 디렉토리 크기 확인 실패:', err.message);
        }

        const systemStatus = {
            server: {
                uptime: Math.floor(process.uptime()),
                uptimeFormatted: `${Math.floor(process.uptime() / 3600)}시간 ${Math.floor((process.uptime() % 3600) / 60)}분`,
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
                },
                nodeVersion: process.version,
                platform: process.platform
            },
            database: {
                size: `${dbSize} MB`,
                path: dbPath,
                status: 'connected'
            },
            uploads: {
                fileCount: fileCount,
                totalSize: `${uploadSize} MB`,
                directory: uploadDir
            },
            time: {
                current: moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초'),
                timezone: 'Asia/Seoul',
                iso: moment().toISOString()
            }
        };

        res.json({
            success: true,
            data: systemStatus
        });

    } catch (error) {
        console.error('시스템 상태 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '시스템 상태 조회 중 오류가 발생했습니다'
        });
    }
});

module.exports = router;