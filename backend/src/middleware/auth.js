const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const DatabaseService = require('../services/database');

// role → department 매핑 (부서 없는 계정은 null → 전체 조회)
const DEPT_MAP = { admin: 'EDA', pads: 'PADS', cad: 'CAD' };

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

            const accounts = [
                { username: 'admin',  password: process.env.ADMIN_PASSWORD  || '70998',     role: 'admin'    },
                { username: 'viewer', password: process.env.READONLY_PASSWORD || 'view123',  role: 'readonly' },
                { username: 'pads',   password: process.env.PADS_PASSWORD   || 'pads11681', role: 'pads'     },
                { username: 'cad',    password: process.env.CAD_PASSWORD    || 'cad11681',  role: 'cad'      },
            ];

            for (const acc of accounts) {
                const hashed = await bcrypt.hash(acc.password, 10);
                const existing = await DatabaseService.get('SELECT id FROM users WHERE username = ?', [acc.username]);
                if (existing) {
                    await DatabaseService.run(
                        'UPDATE users SET password_hash = ?, role = ?, updated_at = datetime("now","localtime") WHERE username = ?',
                        [hashed, acc.role, acc.username]
                    );
                } else {
                    await DatabaseService.run(
                        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                        [acc.username, hashed, acc.role]
                    );
                }
                console.log(`✅ 계정 초기화 완료: ${acc.username} (${acc.role})`);
            }

            this.initialized = true;
        } catch (error) {
            console.error('❌ 사용자 계정 초기화 실패:', error.message);
            setTimeout(() => this.initializeAdmin(), 3000);
        }
    }

    async login(username, password) {
        try {
            if (!this.initialized) {
                throw new Error('인증 시스템이 초기화되지 않았습니다');
            }

            const user = await DatabaseService.get('SELECT * FROM users WHERE username = ?', [username]);
            if (!user) {
                return null;
            }

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return null;
            }

            const department = DEPT_MAP[user.role] || null;

            const token = jwt.sign(
                {
                    userId: user.id,
                    username: user.username,
                    role: user.role,
                    department,
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
                    role: user.role,
                    department,
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

// 관리자 권한 필요 미들웨어
const requireAdmin = (req, res, next) => {
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

    if (decoded.role !== 'admin') {
        return res.status(403).json({ 
            error: '관리자 권한이 필요합니다',
            message: '이 작업을 수행할 권한이 없습니다'
        });
    }
    
    req.user = decoded;
    next();
};

// 읽기 권한 이상 필요 미들웨어 (admin 또는 readonly)
const requireReadAccess = (req, res, next) => {
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

    if (!['admin', 'readonly', 'pads', 'cad'].includes(decoded.role)) {
        return res.status(403).json({
            error: '접근 권한이 없습니다',
            message: '이 페이지에 접근할 권한이 없습니다'
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
    requireAdmin,
    requireReadAccess,
    optionalAuth 
};