const express = require('express');
const { authService } = require('../middleware/auth');
const moment = require('moment-timezone');

const router = express.Router();

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({
                error: '비밀번호가 필요합니다',
                message: '비밀번호를 입력해주세요'
            });
        }
        
        const result = await authService.login(password);
        
        if (!result) {
            return res.status(401).json({
                error: '로그인 실패',
                message: '비밀번호가 올바르지 않습니다'
            });
        }
        
        res.json({
            success: true,
            message: '로그인 성공',
            token: result.token,
            user: result.user,
            loginTime: moment().format('YYYY년 MM월 DD일 HH시 mm분')
        });
        
    } catch (error) {
        console.error('로그인 API 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '로그인 처리 중 오류가 발생했습니다'
        });
    }
});

// 토큰 검증
router.post('/verify', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                error: '토큰이 필요합니다'
            });
        }
        
        const decoded = authService.verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                error: '유효하지 않은 토큰입니다',
                message: '다시 로그인해주세요'
            });
        }
        
        res.json({
            success: true,
            message: '유효한 토큰입니다',
            user: {
                id: decoded.userId,
                username: decoded.username,
                loginTime: decoded.loginTime
            }
        });
        
    } catch (error) {
        console.error('토큰 검증 API 오류:', error);
        res.status(500).json({
            error: '서버 오류',
            message: '토큰 검증 중 오류가 발생했습니다'
        });
    }
});

// 비밀번호 변경
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: '현재 비밀번호와 새 비밀번호가 모두 필요합니다'
            });
        }
        
        if (newPassword.length < 4) {
            return res.status(400).json({
                error: '새 비밀번호는 최소 4자 이상이어야 합니다'
            });
        }
        
        await authService.changePassword(currentPassword, newPassword);
        
        res.json({
            success: true,
            message: '비밀번호가 성공적으로 변경되었습니다',
            changeTime: moment().format('YYYY년 MM월 DD일 HH시 mm분')
        });
        
    } catch (error) {
        console.error('비밀번호 변경 API 오류:', error);
        
        if (error.message.includes('현재 비밀번호')) {
            return res.status(400).json({
                error: error.message
            });
        }
        
        res.status(500).json({
            error: '서버 오류',
            message: '비밀번호 변경 중 오류가 발생했습니다'
        });
    }
});

// 로그아웃 (클라이언트에서 토큰 삭제)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: '로그아웃되었습니다',
        logoutTime: moment().format('YYYY년 MM월 DD일 HH시 mm분')
    });
});

module.exports = router;