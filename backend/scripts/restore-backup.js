const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Seoul');

class BackupRestore {
    constructor() {
        this.backupPath = path.join(__dirname, '../database/backup');
        this.dbPath = path.join(__dirname, '../database/licenses.db');
    }

    async listBackups() {
        if (!fs.existsSync(this.backupPath)) {
            console.log('❌ 백업 디렉토리가 존재하지 않습니다');
            return [];
        }

        const backups = fs.readdirSync(this.backupPath)
            .filter(file => file.startsWith('licenses_backup_') && file.endsWith('.db'))
            .map(file => {
                const stat = fs.statSync(path.join(this.backupPath, file));
                return {
                    filename: file,
                    created: stat.mtime,
                    size: stat.size
                };
            })
            .sort((a, b) => b.created - a.created);

        return backups;
    }

    async restore(backupFilename) {
        try {
            console.log('🔄 데이터베이스 복원 시작...');
            console.log(`📅 시작 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);

            const backupFile = path.join(this.backupPath, backupFilename);
            
            if (!fs.existsSync(backupFile)) {
                throw new Error(`백업 파일을 찾을 수 없습니다: ${backupFilename}`);
            }

            // 현재 데이터베이스 백업 (안전장치)
            const currentBackup = path.join(this.backupPath, `current_${moment().format('YYYYMMDD_HHmmss')}.db`);
            if (fs.existsSync(this.dbPath)) {
                fs.copyFileSync(this.dbPath, currentBackup);
                console.log(`💾 현재 DB 백업 완료: ${currentBackup}`);
            }

            // 백업에서 복원
            fs.copyFileSync(backupFile, this.dbPath);
            
            console.log('✅ 데이터베이스 복원 완료');
            console.log(`📅 완료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);

        } catch (error) {
            console.error('❌ 복원 실패:', error);
            throw error;
        }
    }

    async interactive() {
        const backups = await this.listBackups();
        
        if (backups.length === 0) {
            console.log('❌ 사용 가능한 백업이 없습니다');
            return;
        }

        console.log('📋 사용 가능한 백업 목록:');
        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.filename}`);
            console.log(`   생성일: ${moment(backup.created).format('YYYY년 MM월 DD일 HH시 mm분')}`);
            console.log(`   크기: ${(backup.size / 1024 / 1024).toFixed(2)} MB`);
            console.log('');
        });

        console.log('복원할 백업 번호를 입력하거나 Ctrl+C로 취소하세요.');
        
        // 사용자 입력 대기
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve, reject) => {
            readline.question('백업 번호: ', async (answer) => {
                readline.close();
                
                const index = parseInt(answer) - 1;
                if (index >= 0 && index < backups.length) {
                    try {
                        await this.restore(backups[index].filename);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error('유효하지 않은 번호입니다'));
                }
            });
        });
    }
}

// 스크립트 실행
if (require.main === module) {
    const restore = new BackupRestore();
    
    // 명령행 인수 확인
    const backupFile = process.argv[2];
    
    if (backupFile) {
        // 특정 백업 파일 복원
        restore.restore(backupFile)
            .then(() => {
                console.log('✅ 복원 완료');
                process.exit(0);
            })
            .catch((error) => {
                console.error('❌ 복원 실패:', error.message);
                process.exit(1);
            });
    } else {
        // 인터랙티브 모드
        restore.interactive()
            .then(() => {
                console.log('✅ 복원 완료');
                process.exit(0);
            })
            .catch((error) => {
                console.error('❌ 복원 실패:', error.message);
                process.exit(1);
            });
    }
}

module.exports = BackupRestore;