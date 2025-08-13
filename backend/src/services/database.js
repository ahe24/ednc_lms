const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Seoul');

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/licenses.db');
    }
    
    initialize() {
        // 데이터베이스 디렉토리 생성
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log('📁 데이터베이스 디렉토리 생성 완료');
        }
        
        // SQLite WAL 모드로 연결
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ 데이터베이스 연결 실패:', err.message);
                process.exit(1);
            }
            console.log('✅ SQLite 데이터베이스 연결 성공');
        });
        
        // WAL 모드 활성화 (성능 향상)
        this.db.exec('PRAGMA journal_mode=WAL;', (err) => {
            if (err) console.error('WAL 모드 설정 실패:', err);
            else console.log('✅ SQLite WAL 모드 활성화 완료');
        });
        
        // 한국어 정렬 지원 설정
        this.db.exec('PRAGMA encoding="UTF-8";', (err) => {
            if (err) console.error('UTF-8 인코딩 설정 실패:', err);
            else console.log('✅ UTF-8 인코딩 설정 완료');
        });
        
        this.createTables();
        return this.db;
    }
    
    createTables() {
        const tables = [
            {
                name: 'sites',
                sql: `CREATE TABLE IF NOT EXISTS sites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    site_name TEXT NOT NULL,
                    site_number TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`
            },
            
            {
                name: 'licenses',
                sql: `CREATE TABLE IF NOT EXISTS licenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    site_id INTEGER,
                    host_id TEXT NOT NULL,
                    part_number TEXT NOT NULL,
                    part_name TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    upload_date DATETIME DEFAULT (datetime('now', 'localtime')),
                    manager_name TEXT,
                    department TEXT,
                    client_name TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (site_id) REFERENCES sites(id)
                )`
            },
            
            {
                name: 'license_features',
                sql: `CREATE TABLE IF NOT EXISTS license_features (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    license_id INTEGER,
                    feature_name TEXT NOT NULL,
                    version TEXT NOT NULL,
                    start_date DATE NOT NULL,
                    expiry_date DATE NOT NULL,
                    serial_number TEXT,
                    status TEXT DEFAULT 'ACTIVE',
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (license_id) REFERENCES licenses(id)
                )`
            },
            
            {
                name: 'users',
                sql: `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL DEFAULT 'admin',
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`
            }
        ];
        
        let completedTables = 0;
        tables.forEach(table => {
            this.db.exec(table.sql, (err) => {
                if (err) {
                    console.error(`❌ ${table.name} 테이블 생성 실패:`, err.message);
                } else {
                    completedTables++;
                    console.log(`✅ ${table.name} 테이블 생성/확인 완료`);
                }
                
                if (completedTables === tables.length) {
                    console.log(`🎉 총 ${tables.length}개 테이블 초기화 완료`);
                    console.log(`📅 데이터베이스 초기화 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
                    // Run migrations after tables are created
                    this.runMigrations();
                }
            });
        });
    }
    
    // Promise 기반 쿼리 실행
    run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }
    
    get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
    
    all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
    
    // 한국어 검색을 위한 COLLATE 함수
    getKoreanCollation() {
        return 'COLLATE NOCASE';
    }
    
    // 날짜 관련 헬퍼 함수들
    getCurrentDateTime() {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }
    
    getCurrentDate() {
        return moment().format('YYYY-MM-DD');
    }
    
    formatDateForDisplay(dateStr) {
        return moment(dateStr).format('YYYY년 MM월 DD일');
    }
    
    formatDateTimeForDisplay(dateStr) {
        return moment(dateStr).format('YYYY년 MM월 DD일 HH시 mm분');
    }
    
    // 만료일 계산
    calculateDaysUntilExpiry(expiryDate) {
        const today = moment();
        const expiry = moment(expiryDate);
        return expiry.diff(today, 'days');
    }
    
    getDatabase() {
        return this.db;
    }
    
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ 데이터베이스 연결 종료 실패:', err.message);
                } else {
                    console.log('✅ 데이터베이스 연결이 안전하게 종료되었습니다');
                    console.log(`📅 종료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
                }
            });
        }
    }

    // 마이그레이션 실행
    async runMigrations() {
        try {
            // 테이블 컬럼 정보 조회
            const columns = await this.all("PRAGMA table_info(licenses)");
            
            // client_name 컬럼 추가 마이그레이션
            const hasClientName = columns.some(col => col.name === 'client_name');
            
            if (!hasClientName) {
                console.log('🔄 client_name 컬럼 추가 중...');
                await this.run('ALTER TABLE licenses ADD COLUMN client_name TEXT');
                console.log('✅ client_name 컬럼 추가 완료');
            } else {
                console.log('✅ client_name 컬럼이 이미 존재합니다');
            }
            
            // memo 컬럼 추가 마이그레이션
            const hasMemo = columns.some(col => col.name === 'memo');
            
            if (!hasMemo) {
                console.log('🔄 memo 컬럼 추가 중...');
                await this.run('ALTER TABLE licenses ADD COLUMN memo TEXT');
                console.log('✅ memo 컬럼 추가 완료');
            } else {
                console.log('✅ memo 컬럼이 이미 존재합니다');
            }
        } catch (error) {
            console.error('❌ 마이그레이션 실행 실패:', error.message);
        }
    }
}

module.exports = new DatabaseService();