import React, { useState, useEffect } from 'react';
import { 
    Table, 
    Card, 
    Input, 
    Select, 
    Button, 
    Tag, 
    Space, 
    Modal, 
    Descriptions,
    message,
    Row,
    Col,
    Typography,
    Alert,
    Statistic
} from 'antd';
import { 
    SearchOutlined, 
    ReloadOutlined, 
    DeleteOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { apiClient } from '../config/api';
import { formatDate, formatDateTime, getExpiryStatus } from '../config/locale';

const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { confirm } = Modal;

const LicenseManagement = () => {
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0
    });
    const [filters, setFilters] = useState({
        search: '',
        department: '',
        status: ''
    });
    const [selectedLicense, setSelectedLicense] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    
    useEffect(() => {
        loadLicenses();
    }, [pagination.current, pagination.pageSize, filters]);
    
    const loadLicenses = async () => {
        setLoading(true);
        try {
            const params = {
                page: pagination.current,
                limit: pagination.pageSize,
                ...(filters.department && { department: filters.department })
            };
            
            const response = await apiClient.get('/api/licenses', { params });
            const { data } = response.data;
            
            setLicenses(data.licenses);
            setPagination(prev => ({
                ...prev,
                total: data.totalCount
            }));
        } catch (error) {
            console.error('License 목록 조회 실패:', error);
            message.error('License 목록을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };
    
    const handleTableChange = (newPagination) => {
        setPagination(prev => ({
            ...prev,
            current: newPagination.current,
            pageSize: newPagination.pageSize
        }));
    };
    
    const handleSearch = (value) => {
        setFilters(prev => ({ ...prev, search: value }));
        setPagination(prev => ({ ...prev, current: 1 }));
    };
    
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, current: 1 }));
    };
    
    const showLicenseDetail = async (record) => {
        try {
            const response = await apiClient.get(`/api/licenses/${record.id}`);
            setSelectedLicense(response.data.data);
            setDetailModalVisible(true);
        } catch (error) {
            console.error('License 상세 조회 실패:', error);
            message.error('License 상세 정보를 불러오는데 실패했습니다');
        }
    };
    
    const handleDelete = (record) => {
        confirm({
            title: 'License 삭제',
            icon: <ExclamationCircleOutlined />,
            content: `"${record.part_name}" License를 삭제하시겠습니까?`,
            okText: '삭제',
            okType: 'danger',
            cancelText: '취소',
            onOk: async () => {
                try {
                    await apiClient.delete(`/api/licenses/${record.id}`);
                    message.success('License가 삭제되었습니다');
                    loadLicenses();
                } catch (error) {
                    console.error('License 삭제 실패:', error);
                    message.error('License 삭제에 실패했습니다');
                }
            }
        });
    };
    
    const columns = [
        {
            title: '사이트명',
            dataIndex: 'site_name',
            key: 'site_name',
            width: 120,
            ellipsis: true,
        },
        {
            title: '사이트 번호',
            dataIndex: 'site_number',
            key: 'site_number',
            width: 100,
        },
        {
            title: '고객명',
            dataIndex: 'client_name',
            key: 'client_name',
            width: 120,
            render: (text) => text || '-',
        },
        {
            title: '제품명',
            dataIndex: 'part_name',
            key: 'part_name',
            width: 200,
            ellipsis: true,
        },
        {
            title: '담당자',
            dataIndex: 'manager_name',
            key: 'manager_name',
            width: 100,
            render: (text) => text || '-',
        },
        {
            title: '부서',
            dataIndex: 'department',
            key: 'department',
            width: 80,
            render: (text) => text || '-',
        },
        {
            title: 'Feature 수',
            dataIndex: 'feature_count',
            key: 'feature_count',
            width: 80,
            render: (count) => `${count || 0}개`,
        },
        {
            title: '가장 빠른 만료일',
            dataIndex: 'earliest_expiry',
            key: 'earliest_expiry',
            width: 120,
            render: (date) => {
                if (!date) return '-';
                const status = getExpiryStatus(date);
                return (
                    <div>
                        <div>{formatDate(date, 'MM/DD')}</div>
                        <Tag color={status.color} size="small">
                            {status.text}
                        </Tag>
                    </div>
                );
            }
        },
        {
            title: '업로드일',
            dataIndex: 'upload_date',
            key: 'upload_date',
            width: 100,
            render: (date) => formatDate(date, 'MM/DD'),
        },
        {
            title: '작업',
            key: 'action',
            width: 80,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small" onClick={(e) => e.stopPropagation()}>
                    <Button 
                        type="text" 
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        size="small"
                    >
                        삭제
                    </Button>
                </Space>
            ),
        },
    ];
    
    return (
        <div style={{ padding: '0 24px 24px' }}>
            {/* 헤더 */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 24
            }}>
                <Title level={2} style={{ margin: 0 }}>License 관리</Title>
                <Button 
                    icon={<ReloadOutlined />} 
                    onClick={loadLicenses}
                    loading={loading}
                >
                    새로고침
                </Button>
            </div>
            
            {/* 필터 영역 */}
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} sm={12} md={8}>
                        <Search
                            placeholder="License 검색..."
                            onSearch={handleSearch}
                            style={{ width: '100%' }}
                            enterButton={<SearchOutlined />}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                        <Select
                            placeholder="부서 선택"
                            style={{ width: '100%' }}
                            value={filters.department}
                            onChange={(value) => handleFilterChange('department', value)}
                            allowClear
                        >
                            <Option value="EDA">EDA</Option>
                            <Option value="PADS">PADS</Option>
                            <Option value="CAD">CAD</Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                        <Select
                            placeholder="상태 선택"
                            style={{ width: '100%' }}
                            value={filters.status}
                            onChange={(value) => handleFilterChange('status', value)}
                            allowClear
                        >
                            <Option value="active">정상</Option>
                            <Option value="expiring">만료 임박</Option>
                            <Option value="expired">만료됨</Option>
                        </Select>
                    </Col>
                </Row>
            </Card>
            
            {/* 테이블 */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={licenses}
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                            `${range[0]}-${range[1]} / 총 ${total}개`,
                    }}
                    onChange={handleTableChange}
                    rowKey="id"
                    scroll={{ x: 1200 }}
                    locale={{
                        emptyText: 'License 데이터가 없습니다'
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
                            <Descriptions.Item label="파일명">
                                {selectedLicense.license.file_name}
                            </Descriptions.Item>
                        </Descriptions>
                        
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
        </div>
    );
};

export default LicenseManagement;