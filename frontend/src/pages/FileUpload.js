import React, { useState, useEffect } from 'react';
import { 
    Card, 
    Upload, 
    Button, 
    Form, 
    Input, 
    Select, 
    message, 
    Typography,
    Space,
    Progress,
    Alert,
    Row,
    Col,
    Result
} from 'antd';
import { 
    InboxOutlined, 
    UploadOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    StopOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../config/api';
import { formatDateTime } from '../config/locale';

const { Dragger } = Upload;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const FileUpload = () => {
    const [form] = Form.useForm();
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [fileList, setFileList] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [userInfo, setUserInfo] = useState(null);
    const navigate = useNavigate();
    
    useEffect(() => {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (storedUserInfo) {
            setUserInfo(JSON.parse(storedUserInfo));
        }
    }, []);
    
    // 읽기 전용 사용자는 접근 불가
    if (userInfo && userInfo.role !== 'admin') {
        return (
            <Result
                icon={<StopOutlined style={{ color: '#ff4d4f' }} />}
                title="접근 권한이 없습니다"
                subTitle="파일 업로드는 관리자만 사용할 수 있습니다. 라이선스 조회만 가능합니다."
                extra={
                    <Button type="primary" onClick={() => navigate('/licenses')}>
                        라이선스 관리로 이동
                    </Button>
                }
            />
        );
    }
    
    const handleUpload = async (values) => {
        console.log('📁 파일 업로드 시작');
        console.log('📋 fileList:', fileList);
        console.log('📋 values:', values);
        
        if (fileList.length === 0) {
            message.error('업로드할 파일을 선택해주세요');
            return;
        }
        
        if (!fileList[0].originFileObj) {
            console.error('❌ originFileObj가 없습니다:', fileList[0]);
            message.error('파일 객체가 올바르지 않습니다. 파일을 다시 선택해주세요.');
            return;
        }
        
        setUploading(true);
        setUploadProgress(0);
        setUploadResult(null);
        
        const formData = new FormData();
        formData.append('file', fileList[0].originFileObj);
        
        if (values.managerName) {
            formData.append('managerName', values.managerName);
        }
        if (values.department) {
            formData.append('department', values.department);
        }
        if (values.clientName) {
            formData.append('clientName', values.clientName);
        }
        if (values.memo) {
            formData.append('memo', values.memo);
        }
        
        try {
            // Progress simulation (실제로는 서버에서 progress 이벤트를 받아야 함)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + 10;
                });
            }, 100);
            
            const response = await apiClient.post('/api/licenses/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            
            setTimeout(() => {
                setUploadResult(response.data);
                message.success('License 파일이 성공적으로 업로드되었습니다!');
                form.resetFields();
                setFileList([]);
            }, 500);
            
        } catch (error) {
            console.error('파일 업로드 실패:', error);
            const errorMessage = error.response?.data?.message || '파일 업로드에 실패했습니다';
            message.error(errorMessage);
            setUploadProgress(0);
        } finally {
            setUploading(false);
        }
    };
    
    const uploadProps = {
        name: 'file',
        multiple: false,
        fileList,
        accept: '.lic,.txt',
        beforeUpload: (file) => {
            console.log('📁 파일 선택됨:', file);
            
            const isValidType = file.name.toLowerCase().endsWith('.lic') || file.name.toLowerCase().endsWith('.txt');
            if (!isValidType) {
                message.error('License 파일(.lic) 또는 텍스트 파일(.txt)만 업로드 가능합니다');
                return false;
            }
            
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error('파일 크기는 10MB 이하여야 합니다');
                return false;
            }
            
            // Create a proper file object with originFileObj
            const fileObj = {
                uid: file.uid,
                name: file.name,
                size: file.size,
                type: file.type,
                originFileObj: file
            };
            
            console.log('📁 생성된 fileObj:', fileObj);
            setFileList([fileObj]);
            return false; // Prevent automatic upload
        },
        onChange: (info) => {
            console.log('📁 onChange 이벤트:', info);
        },
        onRemove: () => {
            console.log('📁 파일 제거됨');
            setFileList([]);
        },
        showUploadList: {
            showPreviewIcon: false,
            showRemoveIcon: true,
            showDownloadIcon: false
        }
    };
    
    const resetUpload = () => {
        setUploadResult(null);
        setUploadProgress(0);
        setFileList([]);
        form.resetFields();
    };
    
    return (
        <div style={{ padding: '0 24px 24px' }}>
            <Title level={2} style={{ marginBottom: 24 }}>License 파일 업로드</Title>

            <Row gutter={24}>
                <Col xs={24} lg={16}>
                    <Card title="파일 업로드" style={{ marginBottom: 24 }}>
                        <Form 
                            form={form} 
                            layout="vertical" 
                            onFinish={handleUpload}
                            disabled={uploading}
                        >
                            {/* 파일 업로드 영역 */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ marginBottom: 8, fontWeight: 500 }}>License 파일</div>
                                <Dragger {...uploadProps} style={{ padding: '20px 16px' }}>
                                    <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                                        <InboxOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                                    </p>
                                    <p className="ant-upload-text" style={{ marginBottom: 4, fontSize: '14px' }}>
                                        클릭하거나 파일을 여기로 드래그하여 업로드
                                    </p>
                                    <p className="ant-upload-hint" style={{ marginBottom: 0, fontSize: '12px' }}>
                                        Siemens License 파일(.lic) 또는 텍스트 파일(.txt)을 지원합니다<br />
                                        최대 파일 크기: 10MB
                                    </p>
                                </Dragger>
                            </div>
                            
                            {/* 추가 정보 */}
                            <Row gutter={16}>
                                <Col xs={24} sm={8}>
                                    <Form.Item 
                                        label="고객명" 
                                        name="clientName"
                                    >
                                        <Input placeholder="고객명을 입력하세요 (선택사항)" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item 
                                        label="담당자명" 
                                        name="managerName"
                                    >
                                        <Input placeholder="담당자명을 입력하세요 (선택사항)" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item 
                                        label="부서" 
                                        name="department"
                                        initialValue="EDA"
                                    >
                                        <Select placeholder="부서를 선택하세요" allowClear>
                                            <Option value="EDA">EDA</Option>
                                            <Option value="PADS">PADS</Option>
                                            <Option value="CAD">CAD</Option>
                                            <Option value="기타">기타</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            
                            {/* 메모 필드 */}
                            <Form.Item 
                                label="메모" 
                                name="memo"
                                style={{ marginTop: 16 }}
                            >
                                <TextArea
                                    placeholder="License 관련 메모를 입력하세요 (예: 연락 완료, 갱신 예정, 고객 확인 중 등)"
                                    rows={3}
                                    maxLength={1000}
                                    showCount
                                />
                            </Form.Item>
                            
                            {/* 업로드 진행률 */}
                            {uploading && (
                                <div style={{ marginBottom: 16 }}>
                                    <Text>파일 업로드 중...</Text>
                                    <Progress percent={uploadProgress} status="active" />
                                </div>
                            )}
                            
                            {/* 업로드 버튼 */}
                            <Form.Item>
                                <Space>
                                    <Button 
                                        type="primary" 
                                        htmlType="submit"
                                        icon={<UploadOutlined />}
                                        loading={uploading}
                                        disabled={fileList.length === 0}
                                        size="large"
                                    >
                                        업로드
                                    </Button>
                                    
                                    {uploadResult && (
                                        <Button onClick={resetUpload}>
                                            새 파일 업로드
                                        </Button>
                                    )}
                                </Space>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
                
                <Col xs={24} lg={8}>
                    {/* 업로드 가이드 */}
                    <Card title="업로드 가이드" style={{ marginBottom: 24 }}>
                        <Space direction="vertical" size="middle">
                            <div>
                                <FileTextOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                                <Text strong>지원 파일 형식</Text>
                                <div style={{ marginLeft: 24, marginTop: 4 }}>
                                    <Text type="secondary">• Siemens License 파일 (.lic)</Text><br />
                                    <Text type="secondary">• 텍스트 파일 (.txt)</Text>
                                </div>
                            </div>
                            
                            <div>
                                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                                <Text strong>자동 처리</Text>
                                <div style={{ marginLeft: 24, marginTop: 4 }}>
                                    <Text type="secondary">• 사이트 정보 자동 추출</Text><br />
                                    <Text type="secondary">• License 피처 파싱</Text><br />
                                    <Text type="secondary">• 만료일 자동 계산</Text>
                                </div>
                            </div>
                        </Space>
                    </Card>
                    
                    {/* 업로드 결과 */}
                    {uploadResult && (
                        <Card 
                            title={
                                <Space>
                                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                    업로드 완료
                                </Space>
                            }
                        >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <Text strong>파일명:</Text>
                                <Text copyable>{uploadResult.data.fileName}</Text>
                                
                                <Text strong>업로드 시간:</Text>
                                <Text>{uploadResult.data.uploadTime}</Text>
                                
                                {uploadResult.data.summary && (
                                    <>
                                        <Text strong>사이트 정보:</Text>
                                        <Text>{uploadResult.data.summary.siteInfo.siteName}</Text>
                                        
                                        <Text strong>제품 수:</Text>
                                        <Text>{uploadResult.data.productCount}개</Text>
                                        
                                        {uploadResult.data.products && uploadResult.data.products.length > 0 && (
                                            <>
                                                <Text strong>제품 목록:</Text>
                                                <div style={{ marginLeft: 8 }}>
                                                    {uploadResult.data.products.map((product, index) => (
                                                        <div key={index} style={{ marginBottom: 4 }}>
                                                            <Text style={{ fontSize: '12px' }}>
                                                                • {product.productName} ({product.features?.length || 0}개 기능)
                                                            </Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        
                                        <Text strong>총 Feature 수:</Text>
                                        <Text>{uploadResult.data.totalFeatures}개</Text>
                                        
                                        <Alert
                                            message="License가 성공적으로 등록되었습니다"
                                            description={`${uploadResult.data.productCount}개 제품이 개별적으로 등록되었습니다. License 관리 메뉴에서 상세 정보를 확인할 수 있습니다.`}
                                            type="success"
                                            showIcon
                                            style={{ marginTop: 16 }}
                                        />
                                    </>
                                )}
                            </Space>
                        </Card>
                    )}
                </Col>
            </Row>
            
            {/* 시스템 상태 */}
            <Alert
                message={`서버 시간: ${formatDateTime(new Date())} | 업로드 디렉토리: backend/uploads`}
                type="info"
                showIcon
                closable
            />
        </div>
    );
};

export default FileUpload;