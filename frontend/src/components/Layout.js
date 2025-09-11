import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button, message } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  UploadOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined
} from '@ant-design/icons';

const { Header, Content, Footer } = AntLayout;

const Layout = () => {
  const [userInfo, setUserInfo] = useState({
    username: 'admin',
    role: 'admin',
    loginTime: new Date().toISOString()
  });
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 토큰 확인
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }

    // 사용자 정보 가져오기
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      try {
        setUserInfo(JSON.parse(storedUserInfo));
      } catch (error) {
        console.error('사용자 정보 파싱 오류:', error);
        // 토큰은 있지만 사용자 정보가 잘못된 경우, 기본값 설정
        setUserInfo({
          username: 'admin',
          role: 'admin',
          loginTime: new Date().toISOString()
        });
      }
    } else {
      // 기본값 설정 (호환성을 위해)
      setUserInfo({
        username: 'admin',
        role: 'admin',
        loginTime: new Date().toISOString()
      });
    }

    // Check screen size for responsive design
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    message.success('로그아웃되었습니다');
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: '프로필',
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: '설정',
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '로그아웃',
        onClick: handleLogout,
      },
    ],
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '대시보드',
    },
    {
      key: '/licenses',
      icon: <FileTextOutlined />,
      label: 'License 관리',
    },
    // 파일 업로드는 관리자만 접근 가능
    ...(userInfo?.role === 'admin' ? [{
      key: '/upload',
      icon: <UploadOutlined />,
      label: '파일 업로드',
    }] : []),
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 이제 userInfo는 항상 존재하므로 이 체크는 필요 없음

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header 
        style={{ 
          padding: isMobile ? '0 8px' : '0 16px',
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(24, 144, 255, 0.15)',
          height: 'auto',
          minHeight: '64px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {/* Logo and Title */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flex: isMobile ? '1 1 100%' : '0 0 auto',
          minWidth: isMobile ? 'auto' : '200px',
          order: isMobile ? 1 : 1
        }}>
          <h2 style={{ 
            margin: 0, 
            color: '#ffffff', 
            fontSize: isMobile ? '16px' : '18px', 
            whiteSpace: 'nowrap',
            textAlign: isMobile ? 'center' : 'left',
            width: isMobile ? '100%' : 'auto',
            fontWeight: '600'
          }}>
            EDNC License 관리 시스템
          </h2>
        </div>

        {/* Navigation Menu */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flex: isMobile ? '1 1 100%' : '1 1 auto',
          justifyContent: 'center',
          order: isMobile ? 2 : 2,
          width: isMobile ? '100%' : 'auto'
        }}>
          <Menu
            mode={isMobile ? "horizontal" : "horizontal"}
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{
              border: 'none',
              background: 'transparent',
              flex: '1',
              justifyContent: 'center',
              fontSize: isMobile ? '12px' : '14px'
            }}
            theme="dark"
          />
        </div>

        {/* User Menu */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          flex: isMobile ? '1 1 100%' : '0 0 auto',
          justifyContent: 'flex-end',
          order: isMobile ? 3 : 3,
          width: isMobile ? '100%' : 'auto'
        }}>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              height: '40px',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              background: 'rgba(255, 255, 255, 0.1)'
            }}>
              <Avatar size="small" icon={<UserOutlined />} />
              {!isMobile && (
                <span style={{ color: '#ffffff' }}>
                  {userInfo.username} ({userInfo.role === 'admin' ? '관리자' : '조회용'})
                </span>
              )}
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Content style={{ 
        margin: isMobile ? '8px' : '16px',
        minHeight: 'calc(100vh - 160px)',
        background: '#f0f2f5',
        padding: isMobile ? '16px' : '24px',
        borderRadius: '8px'
      }}>
        <Outlet />
      </Content>

      <Footer style={{ 
        textAlign: 'center',
        background: '#f0f2f5',
        borderTop: '1px solid #d9d9d9',
        padding: isMobile ? '16px 8px' : '24px 16px',
        margin: '0 16px 16px 16px',
        borderRadius: '8px'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: isMobile ? '8px' : '16px'
        }}>
          <div style={{ 
            fontSize: isMobile ? '12px' : '14px',
            color: '#666'
          }}>
            © 2025 EDMFG • EDA Team • Developed by cs.jo
          </div>
          <div style={{ 
            fontSize: isMobile ? '12px' : '14px',
            color: '#1890ff',
            fontWeight: '500'
          }}>
            EDNC License 관리 시스템
          </div>
        </div>
      </Footer>
    </AntLayout>
  );
};

export default Layout;