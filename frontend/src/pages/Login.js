import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Spin } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../config/api';
import { formatDateTime } from '../config/locale';

const { Title, Text } = Typography;

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [systemLoading, setSystemLoading] = useState(true);
    const [systemStatus, setSystemStatus] = useState(null);
    const navigate = useNavigate();
    
    useEffect(() => {
        // 이미 로그인된 경우 대시보드로 이동
        const token = localStorage.getItem('authToken');
        if (token) {
            navigate('/dashboard');
            return;
        }
        
        // 시스템 상태 확인
        checkSystemStatus();
    }, [navigate]);
    
    const checkSystemStatus = async () => {
        try {
            const response = await apiClient.get('/api/health');
            setSystemStatus(response.data);
        } catch (error) {
            console.error('시스템 상태 확인 실패:', error);
            setSystemStatus({
                status: 'error',
                message: '서버에 연결할 수 없습니다'
            });
        } finally {
            setSystemLoading(false);
        }
    };

    const handleLogin = async (values) => {
        setLoading(true);
        
        try {
            const response = await apiClient.post('/api/auth/login', { 
                password: values.password 
            });
            
            const { token } = response.data;
            localStorage.setItem('authToken', token);
            
            message.success('로그인 성공!');
            navigate('/dashboard');
        } catch (error) {
            const errorMessage = error.response?.data?.message || '로그인에 실패했습니다.';
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };
    
    if (systemLoading) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <Card style={{ textAlign: 'center' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>시스템 연결 확인 중...</div>
                </Card>
            </div>
        );
    }
    
    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            position: 'relative'
        }}>
            <Card 
                style={{ 
                    width: 400, 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    borderRadius: '12px',
                    marginBottom: '20px'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <SafetyOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: 16 }} />
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                        Siemens License 관리 시스템
                    </Title>
                    <Text type="secondary">관리자 인증이 필요합니다</Text>
                </div>
                
                {systemStatus && (
                    <div style={{ 
                        marginBottom: 16, 
                        padding: '8px 12px', 
                        background: systemStatus.status === 'ok' ? '#f6ffed' : '#fff2f0',
                        border: `1px solid ${systemStatus.status === 'ok' ? '#b7eb8f' : '#ffccc7'}`,
                        borderRadius: '4px',
                        fontSize: '12px'
                    }}>
                        <div>서버 상태: {systemStatus.message}</div>
                        <div>시간: {systemStatus.timestamp || formatDateTime(new Date())}</div>
                    </div>
                )}
                
                <Form onFinish={handleLogin} size="large">
                    <Form.Item 
                        name="password" 
                        rules={[{ required: true, message: '관리자 비밀번호를 입력해주세요' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="관리자 비밀번호"
                        />
                    </Form.Item>
                    
                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={loading} 
                            block
                            size="large"
                            style={{ borderRadius: '6px' }}
                        >
                            로그인
                        </Button>
                    </Form.Item>
                </Form>
                
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        비밀번호 힌트: same with Door lock<br />
                        시스템 관리자에게 문의하여 비밀번호를 확인하세요
                    </Text>
                </div>
            </Card>
            
            {/* Footer */}
            <div style={{ 
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '12px 24px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ 
                        fontSize: '12px',
                        color: '#666'
                    }}>
                        © 2025 EDMFG • EDA Team • Developed by cs.jo
                    </div>
                    <div style={{ 
                        fontSize: '12px',
                        color: '#1890ff',
                        fontWeight: '500'
                    }}>
                        EDNC License 관리 시스템
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;