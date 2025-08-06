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
import { formatDateTime } from '../config/locale';

const { Header, Sider, Content } = AntLayout;

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
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
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{
          height: '32px',
          margin: '16px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: collapsed ? '12px' : '16px'
        }}>
          {collapsed ? 'LMS' : 'License Management'}
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <AntLayout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header 
          style={{ 
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#1890ff' }}>
              EDNC License 관리 시스템
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
              <div>현재 시간: {formatDateTime(new Date())}</div>
              <div>서버: {window.location.hostname}:3601</div>
            </div>

            <Dropdown menu={userMenu} placement="bottomRight">
              <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{userInfo.username}</span>
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ 
          margin: '24px 24px 0',
          minHeight: 'calc(100vh - 112px)',
          background: '#f0f2f5'
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;