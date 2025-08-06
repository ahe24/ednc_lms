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
  const [userInfo, setUserInfo] = useState(null);
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

    // 사용자 정보 설정 (토큰에서 추출하거나 기본값)
    setUserInfo({
      username: 'admin',
      loginTime: new Date().toISOString()
    });

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
    {
      key: '/upload',
      icon: <UploadOutlined />,
      label: '파일 업로드',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  if (!userInfo) {
    return null; // 로딩 중이거나 인증되지 않음
  }

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
                <span style={{ color: '#ffffff' }}>{userInfo.username}</span>
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