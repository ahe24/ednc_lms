const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const DatabaseService = require('../services/database');
const LicenseParser = require('../services/licenseParser');

const router = express.Router();

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, `${basename}_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.lic', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('허용되지 않는 파일 형식입니다. .lic 또는 .txt 파일만 업로드 가능합니다.'));
        }
    }
});

// License 파일 업로드
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: '파일이 업로드되지 않았습니다',
                message: 'License 파일을 선택해주세요'
            });
        }

        const { managerName, department, clientName } = req.body;
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // 파일 유효성 검사
        const validation = LicenseParser.validateLicenseFile(fileContent);
        
        if (!validation.isValid) {
            // 업로드된 파일 삭제
            fs.unlinkSync(filePath);
            return res.status(400).json({
                error: '유효하지 않은 License 파일',
                message: validation.errors.join(', ')
            });
        }

        // License 파일 파싱
        const parsedData = LicenseParser.parseLicenseFile(fileContent);
        
        // 트랜잭션 시작
        await DatabaseService.run('BEGIN TRANSACTION');

        try {
            // Site 정보 저장/조회
            let site = await DatabaseService.get(
                'SELECT * FROM sites WHERE site_number = ?',
                [parsedData.siteInfo.siteNumber]
            );

            if (!site) {
                const siteResult = await DatabaseService.run(
                    'INSERT INTO sites (site_name, site_number) VALUES (?, ?)',
                    [parsedData.siteInfo.siteName, parsedData.siteInfo.siteNumber]
                );
                site = { id: siteResult.id };
            }

            // License 정보 저장
            const licenseResult = await DatabaseService.run(`
                INSERT INTO licenses (
                    site_id, host_id, part_number, part_name, file_name, 
                    manager_name, department, client_name, upload_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
            `, [
                site.id,
                parsedData.siteInfo.hostId,
                parsedData.partInfo.partNumber,
                parsedData.partInfo.partName,
                req.file.filename,
                managerName || null,
                department || null,
                clientName || null
            ]);

            // Feature 정보 저장
            for (const feature of parsedData.features) {
                await DatabaseService.run(`
                    INSERT INTO license_features (
                        license_id, feature_name, version, start_date, 
                        expiry_date, serial_number, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    licenseResult.id,
                    feature.featureName,
                    feature.version,
                    feature.startDate,
                    feature.expiryDate,
                    feature.serialNumber,
                    'ACTIVE'
                ]);
            }

            await DatabaseService.run('COMMIT');

            // License 요약 정보 생성
            const summary = LicenseParser.generateLicenseSummary(parsedData);

            res.json({
                success: true,
                message: 'License 파일이 성공적으로 업로드되었습니다',
                data: {
                    licenseId: licenseResult.id,
                    fileName: req.file.filename,
                    uploadTime: moment().format('YYYY년 MM월 DD일 HH시 mm분'),
                    summary: summary
                }
            });

        } catch (dbError) {
            await DatabaseService.run('ROLLBACK');
            throw dbError;
        }

    } catch (error) {
        console.error('License 업로드 오류:', error);
        
        // 업로드된 파일 정리
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: '파일 크기가 너무 큽니다',
                message: '최대 10MB까지 업로드 가능합니다'
            });
        }

        res.status(500).json({
            error: '서버 오류',
            message: 'License 파일 업로드 중 오류가 발생했습니다'
        });
    }
});

// 만료 예정 License 조회 (이 라우트는 '/' 보다 먼저 와야 함)
router.get('/expiring', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const futureDate = moment().add(parseInt(days), 'days').format('YYYY-MM-DD');
        const today = moment().format('YYYY-MM-DD');

        const expiringLicenses = await DatabaseService.all(`
            SELECT 
                l.*,
                s.site_name,
                s.site_number,
                COUNT(lf.id) as feature_count,
                MIN(lf.expiry_date) as earliest_expiry,
                MAX(lf.expiry_date) as latest_expiry,
                SUM(CASE WHEN lf.expiry_date < date('now') THEN 1 ELSE 0 END) as expired_count,
                SUM(CASE WHEN lf.expiry_date = date('now') THEN 1 ELSE 0 END) as expiring_today_count,
                SUM(CASE WHEN lf.expiry_date BETWEEN date('now', '+1 day') AND date('now', '+7 days') THEN 1 ELSE 0 END) as expiring_week_count,
                SUM(CASE WHEN lf.expiry_date BETWEEN date('now', '+8 days') AND date('now', '+30 days') THEN 1 ELSE 0 END) as expiring_month_count,
                SUM(CASE WHEN lf.expiry_date > date('now', '+30 days') THEN 1 ELSE 0 END) as active_count
            FROM licenses l
            LEFT JOIN sites s ON l.site_id = s.id
            LEFT JOIN license_features lf ON l.id = lf.license_id
            WHERE EXISTS (
                SELECT 1 FROM license_features lf5 
                WHERE lf5.license_id = l.id 
                AND lf5.expiry_date BETWEEN ? AND ?
            )
            GROUP BY l.id
            ORDER BY earliest_expiry ASC
        `, [today, futureDate]);

        // 만료 상태 추가
        const licensesWithStatus = expiringLicenses.map(license => ({
            ...license,
            status: LicenseParser.calculateLicenseStatus(license.earliest_expiry),
            daysUntilExpiry: moment(license.earliest_expiry).diff(moment(), 'days')
        }));

        res.json({
            success: true,
            data: licensesWithStatus,
            summary: {
                total: licensesWithStatus.length,
                expiredCount: licensesWithStatus.filter(l => l.status.status === 'EXPIRED').length,
                expiringTodayCount: licensesWithStatus.filter(l => l.status.status === 'EXPIRES_TODAY').length,
                expiringSoonCount: licensesWithStatus.filter(l => l.status.status === 'EXPIRES_SOON').length
            }
        });

    } catch (error) {
        console.error('만료 예정 License 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '만료 예정 License 조회 중 오류가 발생했습니다'
        });
    }
});

// License 목록 조회
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, siteId, department, status, search } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (siteId) {
            whereClause += ' AND l.site_id = ?';
            params.push(siteId);
        }

        if (department) {
            whereClause += ' AND l.department = ?';
            params.push(department);
        }

        if (search) {
            whereClause += ' AND (l.part_name LIKE ? OR l.client_name LIKE ? OR l.manager_name LIKE ? OR s.site_name LIKE ? OR s.site_number LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // 상태 필터링 조건 추가
        if (status) {
            const today = moment().format('YYYY-MM-DD');
            const thirtyDaysFromNow = moment().add(30, 'days').format('YYYY-MM-DD');
            
            if (status === 'expired') {
                whereClause += ' AND EXISTS (SELECT 1 FROM license_features lf_status WHERE lf_status.license_id = l.id AND lf_status.expiry_date < ?)';
                params.push(today);
            } else if (status === 'expiring') {
                whereClause += ' AND EXISTS (SELECT 1 FROM license_features lf_status WHERE lf_status.license_id = l.id AND lf_status.expiry_date >= ? AND lf_status.expiry_date < ?)';
                params.push(today, thirtyDaysFromNow);
            } else if (status === 'active') {
                whereClause += ' AND EXISTS (SELECT 1 FROM license_features lf_status WHERE lf_status.license_id = l.id AND lf_status.expiry_date >= ?)';
                params.push(thirtyDaysFromNow);
            }
        }

        const query = `
            SELECT 
                l.*,
                s.site_name,
                s.site_number,
                COUNT(lf.id) as feature_count,
                MIN(lf.expiry_date) as earliest_expiry,
                MAX(lf.expiry_date) as latest_expiry,
                SUM(CASE WHEN lf.expiry_date < date('now') THEN 1 ELSE 0 END) as expired_count,
                SUM(CASE WHEN lf.expiry_date = date('now') THEN 1 ELSE 0 END) as expiring_today_count,
                SUM(CASE WHEN lf.expiry_date BETWEEN date('now', '+1 day') AND date('now', '+7 days') THEN 1 ELSE 0 END) as expiring_week_count,
                SUM(CASE WHEN lf.expiry_date BETWEEN date('now', '+8 days') AND date('now', '+30 days') THEN 1 ELSE 0 END) as expiring_month_count,
                SUM(CASE WHEN lf.expiry_date > date('now', '+30 days') THEN 1 ELSE 0 END) as active_count
            FROM licenses l
            LEFT JOIN sites s ON l.site_id = s.id
            LEFT JOIN license_features lf ON l.id = lf.license_id
            ${whereClause}
            GROUP BY l.id
            ORDER BY l.upload_date DESC
            LIMIT ? OFFSET ?
        `;

        const licenses = await DatabaseService.all(query, [...params, parseInt(limit), offset]);

        // 총 개수 조회
        const countQuery = `
            SELECT COUNT(DISTINCT l.id) as total
            FROM licenses l
            LEFT JOIN sites s ON l.site_id = s.id
            ${whereClause}
        `;
        const countResult = await DatabaseService.get(countQuery, params);

        res.json({
            success: true,
            data: {
                licenses: licenses,
                totalCount: countResult.total,
                currentPage: parseInt(page),
                totalPages: Math.ceil(countResult.total / limit),
                hasNext: offset + licenses.length < countResult.total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('License 목록 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: 'License 목록 조회 중 오류가 발생했습니다'
        });
    }
});

// 특정 License 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const license = await DatabaseService.get(`
            SELECT 
                l.*,
                s.site_name,
                s.site_number
            FROM licenses l
            LEFT JOIN sites s ON l.site_id = s.id
            WHERE l.id = ?
        `, [id]);

        if (!license) {
            return res.status(404).json({
                error: 'License를 찾을 수 없습니다'
            });
        }

        const features = await DatabaseService.all(
            'SELECT * FROM license_features WHERE license_id = ? ORDER BY expiry_date',
            [id]
        );

        // 각 feature에 만료 상태 추가
        const featuresWithStatus = features.map(feature => ({
            ...feature,
            status: LicenseParser.calculateLicenseStatus(feature.expiry_date)
        }));

        res.json({
            success: true,
            data: {
                license: license,
                features: featuresWithStatus
            }
        });

    } catch (error) {
        console.error('License 상세 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: 'License 상세 정보 조회 중 오류가 발생했습니다'
        });
    }
});


// License 파일 원본 내용 조회
router.get('/:id/content', async (req, res) => {
    try {
        const { id } = req.params;

        const license = await DatabaseService.get('SELECT * FROM licenses WHERE id = ?', [id]);
        if (!license) {
            return res.status(404).json({
                error: 'License를 찾을 수 없습니다'
            });
        }

        const filePath = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), license.file_name);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: 'License 파일을 찾을 수 없습니다'
            });
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');

        res.json({
            success: true,
            data: {
                fileName: license.file_name,
                content: fileContent
            }
        });

    } catch (error) {
        console.error('License 파일 내용 조회 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: 'License 파일 내용 조회 중 오류가 발생했습니다'
        });
    }
});

// License 업데이트 (담당자, 고객명, 메모)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { manager_name, client_name, memo } = req.body;

        // License 존재 확인
        const license = await DatabaseService.get('SELECT * FROM licenses WHERE id = ?', [id]);
        if (!license) {
            return res.status(404).json({
                error: 'License를 찾을 수 없습니다'
            });
        }

        // License 업데이트
        await DatabaseService.run(`
            UPDATE licenses 
            SET manager_name = ?, client_name = ?, memo = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
        `, [manager_name || null, client_name || null, memo || null, id]);

        res.json({
            success: true,
            message: 'License 정보가 성공적으로 업데이트되었습니다',
            data: {
                id: id,
                manager_name: manager_name,
                client_name: client_name,
                memo: memo
            }
        });

    } catch (error) {
        console.error('License 업데이트 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: 'License 정보 업데이트 중 오류가 발생했습니다'
        });
    }
});

// License 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // License 존재 확인
        const license = await DatabaseService.get('SELECT * FROM licenses WHERE id = ?', [id]);
        if (!license) {
            return res.status(404).json({
                error: 'License를 찾을 수 없습니다'
            });
        }

        await DatabaseService.run('BEGIN TRANSACTION');

        try {
            // Features 삭제
            await DatabaseService.run('DELETE FROM license_features WHERE license_id = ?', [id]);
            
            // License 삭제
            await DatabaseService.run('DELETE FROM licenses WHERE id = ?', [id]);

            // 파일 삭제
            const filePath = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), license.file_name);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await DatabaseService.run('COMMIT');

            res.json({
                success: true,
                message: 'License가 성공적으로 삭제되었습니다'
            });

        } catch (dbError) {
            await DatabaseService.run('ROLLBACK');
            throw dbError;
        }

    } catch (error) {
        console.error('License 삭제 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: 'License 삭제 중 오류가 발생했습니다'
        });
    }
});

module.exports = router;