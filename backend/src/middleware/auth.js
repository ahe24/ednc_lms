const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const DatabaseService = require('../services/database');

class AuthService {
    constructor() {
        this.initialized = false;
        this.initializeAdmin();
    }
    
    async initializeAdmin() {
        try {
            // 데이터베이스가 초기화될 때까지 대기
            if (!DatabaseService.getDatabase()) {
                setTimeout(() => this.initializeAdmin(), 1000);
                return;
            }
            
            const adminPassword = process.env.ADMIN_PASSWORD || '70998';
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            
            // 기존 admin 사용자 확인
            const existingUser = await DatabaseService.get('SELECT * FROM users WHERE username = ?', ['admin']);
            
            if (existingUser) {
                // 기존 사용자의 비밀번호 업데이트
                await DatabaseService.run(
                    'UPDATE users SET password_hash = ?, updated_at = datetime("now", "localtime") WHERE username = ?',
                    [hashedPassword, 'admin']
                );
                console.log('✅ 관리자 계정 비밀번호 업데이트 완료');
            } else {
                // 새 admin 사용자 생성
                await DatabaseService.run(
                    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                    ['admin', hashedPassword]
                );
                console.log('✅ 관리자 계정 생성 완료');
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('❌ 관리자 계정 초기화 실패:', error.message);
            // 3초 후 재시도
            setTimeout(() => this.initializeAdmin(), 3000);
        }
    }
    
    async login(password) {
        try {
            if (!this.initialized) {
                throw new Error('인증 시스템이 초기화되지 않았습니다');
            }
            
            const user = await DatabaseService.get('SELECT * FROM users WHERE username = ?', ['admin']);
            if (!user) {
                return null;
            }
            
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return null;
            }
            
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username,
                    loginTime: new Date().toISOString()
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            return { 
                token, 
                user: { 
                    id: user.id, 
                    username: user.username,
                    loginTime: new Date().toISOString()
                } 
            };
        } catch (error) {
            console.error('로그인 처리 오류:', error);
            throw error;
        }
    }
    
    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return null;
        }
    }
    
    async changePassword(currentPassword, newPassword) {
        try {
            const user = await DatabaseService.get('SELECT * FROM users WHERE username = ?', ['admin']);
            if (!user) {
                throw new Error('사용자를 찾을 수 없습니다');
            }
            
            const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isCurrentValid) {
                throw new Error('현재 비밀번호가 올바르지 않습니다');
            }
            
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await DatabaseService.run(
                'UPDATE users SET password_hash = ?, updated_at = datetime("now", "localtime") WHERE username = ?',
                [hashedNewPassword, 'admin']
            );
            
            return true;
        } catch (error) {
            console.error('비밀번호 변경 오류:', error);
            throw error;
        }
    }
}

const authService = new AuthService();

// 인증 미들웨어
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;
    
    if (!token) {
        return res.status(401).json({ 
            error: '인증 토큰이 필요합니다',
            message: '로그인이 필요합니다'
        });
    }
    
    const decoded = authService.verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ 
            error: '유효하지 않은 토큰입니다',
            message: '다시 로그인해주세요'
        });
    }
    
    req.user = decoded;
    next();
};

// 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;
    
    if (token) {
        const decoded = authService.verifyToken(token);
        if (decoded) {
            req.user = decoded;
        }
    }
    
    next();
};

module.exports = { 
    authService, 
    authenticate, 
    optionalAuth 
};