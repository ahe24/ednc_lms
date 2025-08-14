import React, { useState, useEffect, useCallback } from 'react';
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
    Statistic,
    Tooltip
} from 'antd';
import { 
    SearchOutlined, 
    ReloadOutlined, 
    DeleteOutlined,
    ExclamationCircleOutlined,
    EditOutlined,
    SaveOutlined
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../config/api';
import { formatDate, formatDateTime, getExpiryStatus } from '../config/locale';

const { Search, TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { confirm } = Modal;

const LicenseManagement = () => {
    const [searchParams, setSearchParams] = useSearchParams();
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
    const [fileContentModalVisible, setFileContentModalVisible] = useState(false);
    const [fileContent, setFileContent] = useState(null);
    const [loadingFileContent, setLoadingFileContent] = useState(false);
    const [editingModal, setEditingModal] = useState(false);
    const [editingValues, setEditingValues] = useState({});
    
    // Initialize filters from URL parameters
    useEffect(() => {
        const urlStatus = searchParams.get('status');
        const urlDays = searchParams.get('days');
        
        if (urlStatus) {
            setFilters(prev => ({ ...prev, status: urlStatus }));
        }
        
        // Handle days parameter for expiring filters
        if (urlStatus === 'expiring' && urlDays) {
            // For now, we'll just use the status filter as the backend should handle this
            // You might want to pass the days parameter to the backend if it supports it
        }
    }, [searchParams]);
    
    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadLicenses();
        }, filters.search !== '' ? 500 : 0); // 500ms delay for search, immediate for other filters
        
        return () => clearTimeout(timeoutId);
    }, [pagination.current, pagination.pageSize, filters]);
    
    const loadLicenses = async () => {
        setLoading(true);
        try {
            const params = {
                page: pagination.current,
                limit: pagination.pageSize,
                ...(filters.search && { search: filters.search }),
                ...(filters.department && { department: filters.department }),
                ...(filters.status && { status: filters.status })
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
    
    const startModalEditing = () => {
        setEditingModal(true);
        setEditingValues({
            manager_name: selectedLicense.license.manager_name || '',
            client_name: selectedLicense.license.client_name || '',
            memo: selectedLicense.license.memo || ''
        });
    };
    
    const cancelModalEditing = () => {
        setEditingModal(false);
        setEditingValues({});
    };
    
    const saveModalEditing = async () => {
        try {
            const updateData = {
                manager_name: editingValues.manager_name,
                client_name: editingValues.client_name,
                memo: editingValues.memo
            };
            
            await apiClient.put(`/api/licenses/${selectedLicense.license.id}`, updateData);
            message.success('License 정보가 업데이트되었습니다');
            setEditingModal(false);
            setEditingValues({});
            
            // Refresh the selected license data
            const response = await apiClient.get(`/api/licenses/${selectedLicense.license.id}`);
            setSelectedLicense(response.data.data);
            
            // Refresh the main table
            loadLicenses();
        } catch (error) {
            console.error('License 업데이트 실패:', error);
            message.error('License 정보 업데이트에 실패했습니다');
        }
    };
    
    const handleModalEditingValueChange = (field, value) => {
        setEditingValues(prev => ({
            ...prev,
            [field]: value
        }));
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
            title: '만료일',
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
            title: '업로드일',
            dataIndex: 'upload_date',
            key: 'upload_date',
            width: 100,
            render: (date) => formatDate(date, 'MM/DD'),
        },
        {
            title: '메모',
            dataIndex: 'memo',
            key: 'memo',
            width: 120,
            render: (memo) => {
                if (!memo) return '-';
                
                const truncatedMemo = memo.length > 25 ? `${memo.substring(0, 25)}...` : memo;
                
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
        },
        {
            title: '작업',
            key: 'action',
            width: 80,
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
                            value={filters.search}
                            onSearch={handleSearch}
                            onChange={(e) => {
                                const value = e.target.value;
                                setFilters(prev => ({ ...prev, search: value }));
                                if (value === '') {
                                    setPagination(prev => ({ ...prev, current: 1 }));
                                }
                            }}
                            style={{ width: '100%' }}
                            enterButton={<SearchOutlined />}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                        <Select
                            placeholder="부서 선택"
                            style={{ width: '100%' }}
                            value={filters.department || undefined}
                            onChange={(value) => handleFilterChange('department', value || '')}
                            allowClear
                        >
                            <Option value="">전체 부서</Option>
                            <Option value="EDA">EDA</Option>
                            <Option value="PADS">PADS</Option>
                            <Option value="CAD">CAD</Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                        <Select
                            placeholder="상태 선택"
                            style={{ width: '100%' }}
                            value={filters.status || undefined}
                            onChange={(value) => handleFilterChange('status', value || '')}
                            allowClear
                        >
                            <Option value="">전체 상태</Option>
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
                    setEditingModal(false);
                    setEditingValues({});
                }}
                footer={null}
                width={800}
            >
                {selectedLicense && (
                    <div>
                        {/* 상단 버튼 영역 */}
                        <div style={{ 
                            marginBottom: 24, 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center' 
                        }}>
                            <Title level={4} style={{ margin: 0 }}>
                                기본 정보
                            </Title>
                            <Space>
                                {editingModal ? (
                                    <>
                                        <Button onClick={cancelModalEditing}>
                                            취소
                                        </Button>
                                        <Button 
                                            type="primary" 
                                            icon={<SaveOutlined />}
                                            onClick={saveModalEditing}
                                        >
                                            저장
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button icon={<EditOutlined />} onClick={startModalEditing}>
                                            편집
                                        </Button>
                                        <Button onClick={() => {
                                            setDetailModalVisible(false);
                                            setShowAllFeatures(false);
                                        }}>
                                            닫기
                                        </Button>
                                    </>
                                )}
                            </Space>
                        </div>
                        
                        <Descriptions bordered column={2} size="small">
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
                                {editingModal ? (
                                    <Input
                                        value={editingValues.manager_name}
                                        onChange={(e) => handleModalEditingValueChange('manager_name', e.target.value)}
                                        placeholder="담당자 입력"
                                        size="small"
                                        style={{ maxWidth: '200px' }}
                                    />
                                ) : (
                                    selectedLicense.license.manager_name || '-'
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="부서">
                                {selectedLicense.license.department || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="고객명">
                                {editingModal ? (
                                    <Input
                                        value={editingValues.client_name}
                                        onChange={(e) => handleModalEditingValueChange('client_name', e.target.value)}
                                        placeholder="고객명 입력"
                                        size="small"
                                        style={{ maxWidth: '200px' }}
                                    />
                                ) : (
                                    selectedLicense.license.client_name || '-'
                                )}
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
                            {editingModal ? (
                                <TextArea
                                    value={editingValues.memo}
                                    onChange={(e) => handleModalEditingValueChange('memo', e.target.value)}
                                    placeholder="License 관련 메모를 입력하세요 (예: 연락 완료, 갱신 예정, 고객 확인 중 등)"
                                    rows={3}
                                    maxLength={1000}
                                    showCount
                                    style={{ width: '100%' }}
                                />
                            ) : (
                                <div style={{ 
                                    whiteSpace: 'pre-wrap', 
                                    minHeight: '20px',
                                    color: selectedLicense.license.memo ? 'inherit' : '#999',
                                    lineHeight: '1.6'
                                }}>
                                    {selectedLicense.license.memo || '메모 없음'}
                                </div>
                            )}
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

export default LicenseManagement;