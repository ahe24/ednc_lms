const fs = require('fs');
const path = require('path');
const DatabaseService = require('../src/services/database');
const LicenseParser = require('../src/services/licenseParser');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Seoul');

class ProductionMigration {
    constructor() {
        this.backupPath = path.join(__dirname, '../database/backup');
        this.uploadsPath = path.join(__dirname, '../uploads');
    }

    async run() {
        try {
            console.log('🚀 시작: 프로덕션 데이터베이스 마이그레이션');
            console.log(`📅 시작 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
            
            // Step 1: 백업 생성
            await this.createBackup();
            
            // Step 2: 새 테이블 생성
            await this.createNewTables();
            
            // Step 3: 기존 데이터 마이그레이션
            await this.migrateExistingData();
            
            // Step 4: 검증
            await this.validateMigration();
            
            console.log('🎉 프로덕션 마이그레이션 완료!');
            console.log(`📅 완료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
            
        } catch (error) {
            console.error('❌ 마이그레이션 실패:', error);
            console.log('💾 백업에서 복원하려면 restore-backup.js를 실행하세요');
            throw error;
        }
    }

    async createBackup() {
        console.log('💾 1단계: 데이터베이스 백업 생성 중...');
        
        // 백업 디렉토리 생성
        if (!fs.existsSync(this.backupPath)) {
            fs.mkdirSync(this.backupPath, { recursive: true });
        }
        
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const backupFile = path.join(this.backupPath, `licenses_backup_${timestamp}.db`);
        
        // SQLite 백업 명령 실행
        const { execSync } = require('child_process');
        const dbPath = path.join(__dirname, '../database/licenses.db');
        
        try {
            execSync(`cp "${dbPath}" "${backupFile}"`);
            console.log(`✅ 백업 완료: ${backupFile}`);
        } catch (error) {
            throw new Error(`백업 실패: ${error.message}`);
        }
    }

    async createNewTables() {
        console.log('🔧 2단계: 새 테이블 구조 생성 중...');
        
        // Initialize database connection
        DatabaseService.initialize();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create products table
        await DatabaseService.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_id INTEGER NOT NULL,
            part_number TEXT NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            earliest_expiry_date DATE,
            latest_expiry_date DATE,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (license_id) REFERENCES licenses(id)
        )`);

        // Add product_id column to license_features if not exists
        try {
            await DatabaseService.run('ALTER TABLE license_features ADD COLUMN product_id INTEGER');
            console.log('✅ license_features에 product_id 컬럼 추가 완료');
        } catch (error) {
            if (error.message.includes('duplicate column')) {
                console.log('✅ product_id 컬럼이 이미 존재합니다');
            } else {
                throw error;
            }
        }

        // Create indexes
        await DatabaseService.run(`CREATE INDEX IF NOT EXISTS idx_products_license_expiry 
            ON products(license_id, earliest_expiry_date)`);
        await DatabaseService.run(`CREATE INDEX IF NOT EXISTS idx_features_product_expiry 
            ON license_features(product_id, expiry_date)`);

        console.log('✅ 새 테이블 구조 생성 완료');
    }

    async migrateExistingData() {
        console.log('📊 3단계: 기존 데이터 마이그레이션 중...');
        
        // 기존 라이선스 목록 조회
        const licenses = await DatabaseService.all(`
            SELECT l.*, COUNT(lf.id) as feature_count
            FROM licenses l
            LEFT JOIN license_features lf ON l.id = lf.license_id
            WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.license_id = l.id)
            GROUP BY l.id
        `);

        console.log(`📝 마이그레이션할 라이선스: ${licenses.length}개`);

        for (const license of licenses) {
            try {
                console.log(`🔄 처리 중: ${license.file_name}`);
                
                // 원본 파일 읽기
                const filePath = path.join(this.uploadsPath, license.file_name);
                
                if (fs.existsSync(filePath)) {
                    // 파일이 존재하는 경우: 새로운 파서로 재분석
                    await this.reprocessLicenseFile(license, filePath);
                } else {
                    // 파일이 없는 경우: 기존 데이터로 제품 생성
                    await this.createProductFromExistingData(license);
                }
                
            } catch (error) {
                console.error(`❌ 라이선스 ${license.id} 마이그레이션 실패:`, error.message);
                // 계속 진행 (개별 실패가 전체를 막지 않도록)
            }
        }

        console.log('✅ 기존 데이터 마이그레이션 완료');
    }

    async reprocessLicenseFile(license, filePath) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsedData = LicenseParser.parseLicenseFile(fileContent);

        if (parsedData.products && parsedData.products.length > 0) {
            // 다중 제품 발견: 새로운 방식으로 처리
            console.log(`  📦 ${parsedData.products.length}개 제품 발견`);
            
            for (const [index, product] of parsedData.products.entries()) {
                let licenseId = license.id;
                
                if (index > 0) {
                    // 첫 번째 제품 이후: 새 라이선스 레코드 생성
                    const newLicense = await DatabaseService.run(`
                        INSERT INTO licenses (
                            site_id, host_id, part_number, part_name, file_name,
                            manager_name, department, client_name, upload_date, memo
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        license.site_id,
                        license.host_id,
                        product.partNumber,
                        product.productName,
                        license.file_name,
                        license.manager_name,
                        license.department,
                        license.client_name,
                        license.upload_date,
                        license.memo
                    ]);
                    licenseId = newLicense.id;
                } else {
                    // 첫 번째 제품: 기존 라이선스 업데이트
                    await DatabaseService.run(`
                        UPDATE licenses 
                        SET part_number = ?, part_name = ?
                        WHERE id = ?
                    `, [product.partNumber, product.productName, license.id]);
                }

                // 제품 레코드 생성
                const productResult = await DatabaseService.run(`
                    INSERT INTO products (
                        license_id, part_number, product_name, quantity,
                        earliest_expiry_date, latest_expiry_date, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    licenseId,
                    product.partNumber,
                    product.productName,
                    product.quantity,
                    product.earliestExpiry,
                    product.latestExpiry,
                    product.status
                ]);

                // 해당 제품의 기능들 업데이트
                for (const feature of product.features) {
                    await DatabaseService.run(`
                        UPDATE license_features 
                        SET product_id = ?, license_id = ?
                        WHERE feature_name = ? AND serial_number = ?
                        AND license_id = ? AND product_id IS NULL
                    `, [
                        productResult.id,
                        licenseId,
                        feature.featureName,
                        feature.serialNumber,
                        license.id
                    ]);
                }
            }
        } else {
            // 단일 제품: 기존 방식으로 처리
            await this.createProductFromExistingData(license);
        }
    }

    async createProductFromExistingData(license) {
        console.log(`  📦 단일 제품으로 처리: ${license.part_name}`);
        
        // 기존 기능들의 만료일 계산
        const features = await DatabaseService.all(
            'SELECT * FROM license_features WHERE license_id = ?',
            [license.id]
        );

        let earliestExpiry = null;
        let latestExpiry = null;
        let status = 'active';

        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        features.forEach(feature => {
            const expiryDate = new Date(feature.expiry_date);
            
            if (!earliestExpiry || expiryDate < earliestExpiry) {
                earliestExpiry = expiryDate;
            }
            if (!latestExpiry || expiryDate > latestExpiry) {
                latestExpiry = expiryDate;
            }
            
            if (expiryDate < today) {
                status = 'expired';
            } else if (expiryDate < thirtyDaysFromNow && status !== 'expired') {
                status = 'warning';
            }
        });

        // 제품 레코드 생성
        const productResult = await DatabaseService.run(`
            INSERT INTO products (
                license_id, part_number, product_name, quantity,
                earliest_expiry_date, latest_expiry_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            license.id,
            license.part_number,
            license.part_name,
            1, // 기본 수량
            earliestExpiry ? earliestExpiry.toISOString().split('T')[0] : null,
            latestExpiry ? latestExpiry.toISOString().split('T')[0] : null,
            status
        ]);

        // 모든 기능을 이 제품에 연결
        await DatabaseService.run(`
            UPDATE license_features 
            SET product_id = ?
            WHERE license_id = ? AND product_id IS NULL
        `, [productResult.id, license.id]);
    }

    async validateMigration() {
        console.log('🔍 4단계: 마이그레이션 검증 중...');
        
        const stats = await DatabaseService.get(`
            SELECT 
                (SELECT COUNT(*) FROM licenses) as license_count,
                (SELECT COUNT(*) FROM products) as product_count,
                (SELECT COUNT(*) FROM license_features WHERE product_id IS NOT NULL) as linked_features,
                (SELECT COUNT(*) FROM license_features WHERE product_id IS NULL) as unlinked_features
        `);

        console.log('📊 마이그레이션 결과:');
        console.log(`  - 총 라이선스: ${stats.license_count}개`);
        console.log(`  - 총 제품: ${stats.product_count}개`);
        console.log(`  - 연결된 기능: ${stats.linked_features}개`);
        console.log(`  - 미연결 기능: ${stats.unlinked_features}개`);

        if (stats.unlinked_features > 0) {
            console.warn(`⚠️  경고: ${stats.unlinked_features}개의 기능이 제품에 연결되지 않았습니다`);
        } else {
            console.log('✅ 모든 기능이 제품에 올바르게 연결되었습니다');
        }
    }
}

// 스크립트 실행
if (require.main === module) {
    const migration = new ProductionMigration();
    migration.run()
        .then(() => {
            console.log('✅ 마이그레이션 성공적으로 완료');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 마이그레이션 실패:', error);
            process.exit(1);
        });
}

module.exports = ProductionMigration;