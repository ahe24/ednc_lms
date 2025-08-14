import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Alert, Table, Tag, Typography, Button, Spin, Modal, Descriptions, message, Tooltip } from 'antd';
import { 
    FileTextOutlined, 
    ExclamationCircleOutlined, 
    CheckCircleOutlined,
    ClockCircleOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../config/api';
import { formatDate, formatDateTime, getExpiryStatus } from '../config/locale';

const { Title, Text } = Typography;

const Dashboard = () => {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [expiringLicenses, setExpiringLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLicense, setSelectedLicense] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    const [fileContentModalVisible, setFileContentModalVisible] = useState(false);
    const [fileContent, setFileContent] = useState(null);
    const [loadingFileContent, setLoadingFileContent] = useState(false);
    
    useEffect(() => {
        loadDashboardData();
        
        // 5분마다 자동 새로고침
        const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, []);
    
    const loadDashboardData = async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        
        try {
            const [summaryRes, expiringRes] = await Promise.all([
                apiClient.get('/api/dashboard/summary'),
                apiClient.get('/api/licenses/expiring?days=30')
            ]);
            
            setSummary(summaryRes.data.data);
            setExpiringLicenses(expiringRes.data.data || []);
        } catch (error) {
            console.error('대시보드 데이터 로드 실패:', error);
        } finally {
            setLoading(false);
            if (showRefreshing) setRefreshing(false);
        }
    };
    
    const handleRefresh = () => {
        loadDashboardData(true);
    };
    
    const showLicenseDetail = async (record) => {
        try {
            const response = await apiClient.get(`/api/licenses/${record.id}`);
            setSelectedLicense(response.data.data);
            setDetailModalVisible(true);
        } catch (error) {
            console.error('License 상세 조회 실패:', error);
        }
    };
    
    const showLicenseFileContent = async (record) => {
        setLoadingFileContent(true);
        try {
            const response = await apiClient.get(`/api/licenses/${record.id}/content`);
            setFileContent(response.data.data);
            setFileContentModalVisible(true);
        } catch (error) {
            console.error('License 파일 내용 조회 실패:', error);
            message.error('License 파일 내용을 불러오는데 실패했습니다');
        } finally {
            setLoadingFileContent(false);
        }
    };
    
    const navigateToLicenseManagement = (filterType) => {
        const baseUrl = '/licenses';
        const params = new URLSearchParams();
        
        switch (filterType) {
            case 'total':
                // No filter - show all licenses
                break;
            case 'expired':
                params.set('status', 'expired');
                break;
            case 'expiring7':
                params.set('status', 'expiring');
                params.set('days', '7');
                break;
            case 'expiring30':
                params.set('status', 'expiring');
                params.set('days', '30');
                break;
            default:
                break;
        }
        
        const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
        navigate(url);
    };
    
    const expiringColumns = [
        {
            title: '사이트명',
            dataIndex: 'site_name',
            key: 'site_name',
            width: 120,
        },
        {
            title: '제품명',
            dataIndex: 'part_name',
            key: 'part_name',
            width: 200,
            ellipsis: true,
        },
        {
            title: 'Feature 수',
            dataIndex: 'feature_count',
            key: 'feature_count',
            width: 100,
            render: (count) => `${count || 0}개`,
        },
        {
            title: '가장 빠른 만료일',
            dataIndex: 'earliest_expiry',
            key: 'earliest_expiry',
            width: 120,
            render: (date) => formatDate(date, 'MM/DD'),
        },
        {
            title: '상태',
            key: 'status',
            width: 100,
            render: (_, record) => {
                const status = getExpiryStatus(record.earliest_expiry);
                return (
                    <Tag color={status.color} icon={<ClockCircleOutlined />}>
                        {status.text}
                    </Tag>
                );
            }
        },
        {
            title: '담당자',
            dataIndex: 'manager_name',
            key: 'manager_name',
            width: 80,
            render: (name) => name || '-'
        },
        {
            title: '메모',
            dataIndex: 'memo',
            key: 'memo',
            width: 100,
            render: (memo) => {
                if (!memo) return '-';
                
                const truncatedMemo = memo.length > 20 ? `${memo.substring(0, 20)}...` : memo;
                
                return (
                    <Tooltip title={memo} placement="topLeft">
                        <span style={{ 
                            cursor: 'help',
                            color: '#1890ff'
                        }}>
                            {truncatedMemo}
                        </span>
                    </Tooltip>
                );
            }
        }
    ];
    
    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '400px' 
            }}>
                <Spin size="large" />
            </div>
        );
    }
    
    return (
        <div style={{ padding: '0 24px 24px' }}>
            {/* 헤더 */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 24
            }}>
                <Title level={2} style={{ margin: 0 }}>License 현황 대시보드</Title>
                <Button 
                    icon={<ReloadOutlined />} 
                    onClick={handleRefresh}
                    loading={refreshing}
                    type="primary"
                    ghost
                >
                    새로고침
                </Button>
            </div>
            
            {/* 시스템 정보 알림 */}
            <Alert 
                message={`서버: ${window.location.hostname}:3601 | 현재 시간: ${formatDateTime(new Date())}`}
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
                closable
            />
            
            {/* 요약 카드 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card 
                        hoverable
                        onClick={() => navigateToLicenseManagement('total')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Statistic
                            title="총 License"
                            value={summary?.totalLicenses || 0}
                            prefix={<FileTextOutlined />}
                            suffix="개"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card 
                        hoverable
                        onClick={() => navigateToLicenseManagement('expired')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Statistic
                            title="이미 만료됨"
                            value={summary?.expired || 0}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="개"
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card 
                        hoverable
                        onClick={() => navigateToLicenseManagement('expiring7')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Statistic
                            title="7일 내 만료"
                            value={summary?.expiringIn7Days || 0}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="개"
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card 
                        hoverable
                        onClick={() => navigateToLicenseManagement('expiring30')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Statistic
                            title="30일 내 만료"
                            value={summary?.expiringIn30Days || 0}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="개"
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>
            
            {/* 만료 예정 License 테이블 */}
            <Card 
                title="30일 내 만료 예정 License" 
                extra={
                    <Text type="secondary">
                        총 {expiringLicenses.length}개의 License
                    </Text>
                }
            >
                <Table
                    columns={expiringColumns}
                    dataSource={expiringLicenses}
                    rowKey={(record) => `expiring-${record.id}`}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                            `${range[0]}-${range[1]} / 총 ${total}개`,
                    }}
                    scroll={{ x: 800 }}
                    locale={{
                        emptyText: '만료 예정 License가 없습니다'
                    }}
                    onRow={(record) => ({
                        onClick: () => showLicenseDetail(record),
                        style: { cursor: 'pointer' },
                        onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                        },
                        onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = '';
                        }
                    })}
                />
            </Card>
            
            {/* 상세 모달 */}
            <Modal
                title="License 상세 정보"
                open={detailModalVisible}
                onCancel={() => {
                    setDetailModalVisible(false);
                    setShowAllFeatures(false);
                }}
                footer={[
                    <Button key="close" onClick={() => {
                        setDetailModalVisible(false);
                        setShowAllFeatures(false);
                    }}>
                        닫기
                    </Button>
                ]}
                width={800}
            >
                {selectedLicense && (
                    <div>
                        <Descriptions title="기본 정보" bordered column={2} size="small">
                            <Descriptions.Item label="사이트명">
                                {selectedLicense.license.site_name}
                            </Descriptions.Item>
                            <Descriptions.Item label="사이트 번호">
                                {selectedLicense.license.site_number}
                            </Descriptions.Item>
                            <Descriptions.Item label="제품명" span={2}>
                                {selectedLicense.license.part_name}
                            </Descriptions.Item>
                            <Descriptions.Item label="Part Number">
                                {selectedLicense.license.part_number}
                            </Descriptions.Item>
                            <Descriptions.Item label="Host ID">
                                {selectedLicense.license.host_id}
                            </Descriptions.Item>
                            <Descriptions.Item label="담당자">
                                {selectedLicense.license.manager_name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="부서">
                                {selectedLicense.license.department || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="고객명">
                                {selectedLicense.license.client_name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="업로드일">
                                {formatDateTime(selectedLicense.license.upload_date)}
                            </Descriptions.Item>
                        </Descriptions>
                        
                        {/* 파일 정보 카드 */}
                        <Card 
                            title="📄 업로드된 파일" 
                            size="small" 
                            style={{ marginTop: 16 }}
                        >
                            <Button 
                                type="link" 
                                style={{ 
                                    padding: 0, 
                                    height: 'auto', 
                                    fontSize: '14px',
                                    fontWeight: 'normal',
                                    wordBreak: 'break-all'
                                }}
                                onClick={() => showLicenseFileContent(selectedLicense.license)}
                                loading={loadingFileContent}
                            >
                                {selectedLicense.license.file_name}
                            </Button>
                        </Card>
                        
                        {/* 메모 카드 */}
                        <Card 
                            title="📝 메모" 
                            size="small" 
                            style={{ marginTop: 16 }}
                        >
                            <div style={{ 
                                whiteSpace: 'pre-wrap', 
                                minHeight: '20px',
                                color: selectedLicense.license.memo ? 'inherit' : '#999',
                                lineHeight: '1.6'
                            }}>
                                {selectedLicense.license.memo || '메모 없음'}
                            </div>
                        </Card>
                        
                        <Title level={4} style={{ marginTop: 24, marginBottom: 16 }}>
                            피처 목록 ({selectedLicense.features?.length || 0}개)
                        </Title>
                        
                        {selectedLicense.features && selectedLicense.features.length > 0 && (
                            <div>
                                {selectedLicense.features.length > 20 && !showAllFeatures && (
                                    <Alert
                                        message={`총 ${selectedLicense.features.length}개의 피처가 있습니다. 처음 20개만 표시됩니다.`}
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                        action={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                onClick={() => setShowAllFeatures(true)}
                                            >
                                                전체 보기
                                            </Button>
                                        }
                                    />
                                )}
                                
                                {selectedLicense.features.length > 20 && showAllFeatures && (
                                    <Alert
                                        message={`전체 ${selectedLicense.features.length}개의 피처를 표시합니다.`}
                                        type="success"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                        action={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                onClick={() => setShowAllFeatures(false)}
                                            >
                                                처음 20개만 보기
                                            </Button>
                                        }
                                    />
                                )}
                                
                                {/* Feature 요약 정보 (20개 이상일 때만) */}
                                {selectedLicense.features.length > 20 && !showAllFeatures && (
                                    <Card size="small" style={{ marginBottom: 16 }}>
                                        <Row gutter={16}>
                                            <Col span={8}>
                                                <Statistic
                                                    title="총 피처 수"
                                                    value={selectedLicense.features.length}
                                                    suffix="개"
                                                />
                                            </Col>
                                            <Col span={8}>
                                                <Statistic
                                                    title="만료 예정 (30일)"
                                                    value={selectedLicense.features.filter(f => {
                                                        const status = getExpiryStatus(f.expiry_date);
                                                        return status.status === 'warning' || status.status === 'caution';
                                                    }).length}
                                                    suffix="개"
                                                    valueStyle={{ color: '#faad14' }}
                                                />
                                            </Col>
                                            <Col span={8}>
                                                <Statistic
                                                    title="만료됨"
                                                    value={selectedLicense.features.filter(f => {
                                                        const status = getExpiryStatus(f.expiry_date);
                                                        return status.status === 'expired';
                                                    }).length}
                                                    suffix="개"
                                                    valueStyle={{ color: '#ff4d4f' }}
                                                />
                                            </Col>
                                        </Row>
                                    </Card>
                                )}
                                
                                <Table
                                    columns={[
                                        {
                                            title: 'Feature 명',
                                            dataIndex: 'feature_name',
                                            key: 'feature_name',
                                        },
                                        {
                                            title: '버전',
                                            dataIndex: 'version',
                                            key: 'version',
                                        },
                                        {
                                            title: '시작일',
                                            dataIndex: 'start_date',
                                            key: 'start_date',
                                            render: (date) => formatDate(date),
                                        },
                                        {
                                            title: '만료일',
                                            dataIndex: 'expiry_date',
                                            key: 'expiry_date',
                                            render: (date) => formatDate(date),
                                        },
                                        {
                                            title: '상태',
                                            key: 'status',
                                            render: (_, record) => {
                                                const status = getExpiryStatus(record.expiry_date);
                                                return (
                                                    <Tag color={status.color}>
                                                        {status.text}
                                                    </Tag>
                                                );
                                            }
                                        }
                                    ]}
                                    dataSource={showAllFeatures ? selectedLicense.features : selectedLicense.features.slice(0, 20)}
                                    pagination={showAllFeatures && selectedLicense.features.length > 20 ? {
                                        pageSize: 20,
                                        showSizeChanger: true,
                                        showQuickJumper: true,
                                        showTotal: (total, range) => 
                                            `${range[0]}-${range[1]} / 총 ${selectedLicense.features.length}개`,
                                    } : false}
                                    size="small"
                                    rowKey={(record) => `feature-${record.id || record.feature_name}`}
                                    scroll={{ y: 400 }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            
            {/* License 파일 내용 모달 */}
            <Modal
                title={`License 파일 내용 - ${fileContent?.fileName || ''}`}
                open={fileContentModalVisible}
                onCancel={() => {
                    setFileContentModalVisible(false);
                    setFileContent(null);
                }}
                footer={[
                    <Button key="close" onClick={() => {
                        setFileContentModalVisible(false);
                        setFileContent(null);
                    }}>
                        닫기
                    </Button>
                ]}
                width={1000}
                style={{ top: 20 }}
            >
                {loadingFileContent ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Text>파일 내용을 불러오는 중...</Text>
                    </div>
                ) : fileContent ? (
                    <div>
                        <Alert
                            message={`파일명: ${fileContent.fileName}`}
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <div
                            style={{
                                backgroundColor: '#f6f8fa',
                                border: '1px solid #d0d7de',
                                borderRadius: '6px',
                                padding: '16px',
                                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                maxHeight: '70vh',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                            }}
                        >
                            {fileContent.content}
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

export default Dashboard;