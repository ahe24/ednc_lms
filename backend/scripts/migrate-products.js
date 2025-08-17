const DatabaseService = require('../src/services/database');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Seoul');

async function migrateToProductsTable() {
    try {
        console.log('🔄 시작: 제품 테이블 마이그레이션');
        
        // Initialize database connection
        DatabaseService.initialize();
        
        // Wait for database to be ready
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
        
        console.log('✅ products 테이블 생성 완료');
        
        // Add product_id to license_features if not exists
        const columns = await DatabaseService.all("PRAGMA table_info(license_features)");
        const hasProductId = columns.some(col => col.name === 'product_id');
        
        if (!hasProductId) {
            await DatabaseService.run('ALTER TABLE license_features ADD COLUMN product_id INTEGER');
            console.log('✅ license_features 테이블에 product_id 컬럼 추가 완료');
        }
        
        // Index for performance
        await DatabaseService.run(`CREATE INDEX IF NOT EXISTS idx_products_license_expiry 
            ON products(license_id, earliest_expiry_date)`);
        await DatabaseService.run(`CREATE INDEX IF NOT EXISTS idx_features_product_expiry 
            ON license_features(product_id, expiry_date)`);
        
        console.log('✅ 인덱스 생성 완료');
        
        console.log('🎉 제품 테이블 마이그레이션 완료');
        console.log(`📅 완료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error);
        process.exit(1);
    }
}

migrateToProductsTable();