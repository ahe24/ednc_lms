# EDNC License Management System 설계서

## 1. 개요

### 1.1 프로젝트 목적
- Siemens Industry Software 라이센스 파일을 자동으로 파싱하여 대시보드에서 관리
- 라이센스 만료일 모니터링 기능 제공
- 고객사별 라이센스 현황 추적 및 관리
- 프로젝트명 : ED&C LMS

### 1.2 주요 기능
- 라이센스 파일 업로드 및 자동 파싱
- 대시보드를 통한 라이센스 현황 시각화
- 만료일 임박 표시 시스템
- 고객사별 라이센스 관리

## 2. 시스템 아키텍처

### 2.1 기술 스택
- **OS**: Rocky Linux 9
- **Frontend**: React.js + TypeScript (포트: 3600)
- **Backend**: Node.js + Express.js (포트: 3601)
- **Database**: SQLite3 (무료, 파일 기반)
- **Process Manager**: PM2 (기존 환경 활용)
- **파일 처리**: Multer (파일 업로드)
- **스케줄링**: Node-cron (백그라운드 작업)
- **UI 라이브러리**: Ant Design (무료, 한국어 지원)
- **인증**: bcrypt + JWT (단일 계정)
- **국제화**: React i18n, moment.js (Seoul timezone)
- **날짜/시간**: Moment.js with Korea locale

### 2.2 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   SQLite DB     │
│  (React:3600)   │◄──►│ (Node.js:3601)  │◄──►│   (File-based)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       
┌─────────────────┐    ┌─────────────────┐              
│   Multi-Client  │    │  File Parser    │              
│   Access        │    │  & PM2 Mgmt     │              
└─────────────────┘    └─────────────────┘              
```

### 2.3 배포 환경
- **서버**: Rocky Linux 9
- **프로세스 관리**: PM2 ecosystem
- **네트워크**: 다중 클라이언트 접근 지원
- **설정**: 환경변수 기반 IP/포트 관리

## 3. 데이터베이스 설계 (SQLite3)

### 3.1 데이터베이스 선택 이유
- **SQLite3 장점**: 
  - 무료, 파일 기반으로 설치/관리 간편
  - 중소규모 데이터에 최적화
  - 백업이 단순 (파일 복사)
  - 별도 서버 프로세스 불필요

### 3.2 테이블 구조

#### sites 테이블
```sql
CREATE TABLE sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    site_number TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### licenses 테이블
```sql
CREATE TABLE licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER,
    host_id TEXT NOT NULL,
    part_number TEXT NOT NULL,
    part_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    manager_name TEXT,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id)
);
```

#### license_features 테이블
```sql
CREATE TABLE license_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER,
    feature_name TEXT NOT NULL,
    version TEXT NOT NULL,
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    serial_number TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);
```

#### users 테이블 (단일 계정 관리)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL DEFAULT 'admin',
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 4. 라이센스 파일 파싱 로직

### 4.1 파싱 규칙 분석
첨부된 파일 분석 결과:

#### 공통 패턴
1. **Site 정보**: `# [Site Name] Site # :[Site ID]=[Site Name]` 형식
2. **Host ID**: `HOSTID=FLEXID=` 뒤의 값
3. **Part 정보**: License Content 섹션에서 추출
4. **Feature 정보**: INCREMENT 라인과 License Content 매핑

#### 날짜 형식
- `dd-mmm-yyyy` (예: 03-sep-2025)
- `dd mmm yyyy` (예: 04 Aug 2025)

### 4.2 파서 구현 예시
```javascript
class LicenseParser {
    static parseLicenseFile(fileContent) {
        const result = {
            siteInfo: {},
            partInfo: {},
            features: []
        };
        
        // Site 정보 추출
        const siteMatch = fileContent.match(/# (.+)\s+Site # :(\d+)=(.+)/);
        if (siteMatch) {
            result.siteInfo = {
                siteName: siteMatch[1].trim(),
                siteNumber: siteMatch[2],
                fullSiteName: siteMatch[3].trim()
            };
        }
        
        // Host ID 추출
        const hostIdMatch = fileContent.match(/HOSTID=FLEXID=([^\s]+)/);
        if (hostIdMatch) {
            result.siteInfo.hostId = hostIdMatch[1];
        }
        
        // License Content 섹션에서 Part 정보 추출
        const contentSection = this.extractLicenseContent(fileContent);
        result.partInfo = this.parsePartInfo(contentSection);
        result.features = this.parseFeatures(contentSection);
        
        return result;
    }
    
    static extractLicenseContent(fileContent) {
        const startMarker = "############################# License Content #############################";
        const endMarker = "######################### End of License Content ##########################";
        
        const startIndex = fileContent.indexOf(startMarker);
        const endIndex = fileContent.indexOf(endMarker);
        
        if (startIndex === -1 || endIndex === -1) {
            throw new Error("License Content section not found");
        }
        
        return fileContent.substring(startIndex, endIndex);
    }
    
    static parsePartInfo(contentSection) {
        const partMatch = contentSection.match(/# (\d+)\s+(.+)\s+(\d+)/);
        return partMatch ? {
            partNumber: partMatch[1],
            partName: partMatch[2].trim()
        } : {};
    }
    
    static parseFeatures(contentSection) {
        const features = [];
        const featureRegex = /#\s+(\w+)\s+([\d.]+)\s+(\d{2} \w{3} \d{4})\s+(\d{2} \w{3} \d{4})\s+(\d+)/g;
        
        let match;
        while ((match = featureRegex.exec(contentSection)) !== null) {
            features.push({
                featureName: match[1],
                version: match[2],
                startDate: this.parseDate(match[3]),
                expiryDate: this.parseDate(match[4]),
                serialNumber: match[5]
            });
        }
        
        return features;
    }
    
    static parseDate(dateStr) {
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        const parts = dateStr.split(' ');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = months[parts[1]];
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
        
        return dateStr;
    }
}
```

## 5. API 설계

### 5.1 RESTful API 엔드포인트

#### 파일 업로드
```http
POST /api/licenses/upload
Content-Type: multipart/form-data

Body:
- file: license file
- managerName: string (optional)
- department: string (optional)
```

#### 라이센스 목록 조회
```http
GET /api/licenses
Query Parameters:
- page: number
- limit: number
- siteId: number (optional)
- department: string (optional)
- status: string (optional)
```

#### 대시보드 데이터
```http
GET /api/dashboard/summary
Response:
{
    "totalLicenses": 150,
    "expiringIn30Days": 5,
    "expiringIn7Days": 2,
    "expired": 1,
    "activeSites": 25,
    "departmentBreakdown": {
        "EDA": 80,
        "PADS": 45,
        "CAD": 25
    }
}
```

#### 만료 예정 라이센스
```http
GET /api/licenses/expiring
Query Parameters:
- days: number (default: 30)
```

#### 사이트별 상세 정보
```http
GET /api/sites/:siteId/licenses
```

### 5.2 응답 형식 예시
```json
{
    "success": true,
    "data": {
        "licenses": [
            {
                "id": 1,
                "siteName": "ETRI-6",
                "siteNumber": "3155175",
                "partNumber": "243170",
                "partName": "Precision Hi-Rel Ap SW",
                "hostId": "9-64ebe560",
                "managerName": "김철수",
                "department": "EDA",
                "uploadDate": "2025-08-06T00:00:00Z",
                "features": [
                    {
                        "featureName": "pplscpbpldmgc_c",
                        "version": "2025.09",
                        "startDate": "2025-08-04",
                        "expiryDate": "2025-09-03",
                        "status": "ACTIVE",
                        "daysUntilExpiry": 28
                    }
                ]
            }
        ],
        "totalCount": 150,
        "currentPage": 1,
        "totalPages": 15
    }
}
```

## 6. Frontend 설계 (다중 클라이언트 지원)

### 6.1 환경 설정 기반 API 연결
```jsx
// src/config/api.js
const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:3601`,
  timeout: 10000
};

export const apiClient = axios.create(API_CONFIG);

// 토큰 인터셉터
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);
```

### 6.2 한국어/한국 시간대 지원 설정

#### 프론트엔드 국제화 설정 (src/config/locale.js)
```jsx
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import moment from 'moment';
import 'moment/locale/ko';

// 한국 시간대 및 로케일 설정
moment.locale('ko');
moment.tz.setDefault('Asia/Seoul');

export const LocaleProvider = ({ children }) => (
  <ConfigProvider locale={koKR}>
    {children}
  </ConfigProvider>
);

// 날짜 포맷 유틸리티
export const formatDate = (date, format = 'YYYY년 MM월 DD일') => {
  return moment(date).tz('Asia/Seoul').format(format);
};

export const formatDateTime = (date, format = 'YYYY년 MM월 DD일 HH시 mm분') => {
  return moment(date).tz('Asia/Seoul').format(format);
};

export const getDaysUntilExpiry = (expiryDate) => {
  const now = moment().tz('Asia/Seoul');
  const expiry = moment(expiryDate).tz('Asia/Seoul');
  return expiry.diff(now, 'days');
};

export const getExpiryStatus = (expiryDate) => {
  const daysLeft = getDaysUntilExpiry(expiryDate);
  
  if (daysLeft < 0) return { status: 'expired', text: '만료됨', color: 'red' };
  if (daysLeft === 0) return { status: 'today', text: '오늘 만료', color: 'orange' };
  if (daysLeft <= 7) return { status: 'warning', text: `${daysLeft}일 남음`, color: 'orange' };
  if (daysLeft <= 30) return { status: 'caution', text: `${daysLeft}일 남음`, color: 'yellow' };
  return { status: 'active', text: `${daysLeft}일 남음`, color: 'green' };
};
```

#### 메인 App 컴포넌트 (src/App.jsx)
```jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocaleProvider } from './config/locale';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LicenseManagement from './pages/LicenseManagement';
import FileUpload from './pages/FileUpload';
import './App.css';

function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="licenses" element={<LicenseManagement />} />
              <Route path="upload" element={<FileUpload />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </LocaleProvider>
  );
}

export default App;
```

### 6.3 단일 인증 컴포넌트 (한국어 UI)
```jsx
// src/components/Login.jsx
import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../config/api';

const { Title, Text } = Typography;

const Login = () => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    
    const handleLogin = async function updateLicenseStatus() {
    const today = new Date();
    
    // 만료된 라이센스 상태 업데이트
    await updateExpiredLicenses(today);
    
    // 만료 예정 라이센스 표시 업데이트
    await updateExpiringLicenses(today);
}
```

## 8. 보안 고려사항

### 8.1 파일 업로드 보안
- 파일 확장자 검증 (.lic, .txt만 허용)
- 파일 크기 제한 (최대 10MB)
- 바이러스 스캔 (선택사항)
- 업로드 디렉토리 권한 설정

### 8.2 접근 제어
- 사용자 인증 (JWT 토큰)
- 역할 기반 접근 제어 (RBAC)
- API 요청 제한 (Rate Limiting)

### 8.3 데이터 보호
- 민감한 데이터 암호화
- 데이터베이스 백업
- 로그 관리

## 9. Rocky Linux 9 배포 및 운영

### 9.1 시스템 요구사항
```bash
# Rocky Linux 9 기본 패키지 설치
sudo dnf update -y
sudo dnf install -y nodejs npm git sqlite

# PM2 글로벌 설치 (이미 설치되어 있다면 생략)
npm install -g pm2
```

### 9.2 프로젝트 구조
```
/opt/license-management/
├── frontend/                # React 애플리케이션 (포트: 3600)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env
├── backend/                 # Node.js API 서버 (포트: 3601)
│   ├── src/
│   ├── uploads/            # 라이센스 파일 저장
│   ├── database/           # SQLite DB 파일
│   ├── package.json
│   └── .env
├── ecosystem.config.js      # PM2 설정 파일
└── .env.global             # 글로벌 환경 설정
```

### 9.3 환경 설정 파일

#### .env.global (최상위 환경 설정)
```bash
# 서버 설정 - 여기서 쉽게 변경 가능
SERVER_IP=192.168.1.100
FRONTEND_PORT=3600
BACKEND_PORT=3601

# 인증 설정
JWT_SECRET=your-super-secret-jwt-key-here
ADMIN_PASSWORD=your-admin-password-here

# 데이터베이스
DB_PATH=/opt/license-management/backend/database/licenses.db

# 한국 시간대 설정
TZ=Asia/Seoul
LANG=ko_KR.UTF-8
LC_TIME=ko_KR.UTF-8
```

#### backend/.env
```bash
# 환경 변수 로드
source /opt/license-management/.env.global

# 백엔드 특정 설정
NODE_ENV=production
PORT=${BACKEND_PORT}
HOST=${SERVER_IP}
JWT_SECRET=${JWT_SECRET}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
DB_PATH=${DB_PATH}

# 시간대 설정
TZ=${TZ}
LANG=${LANG}
LC_TIME=${LC_TIME}

# 파일 업로드 설정
UPLOAD_DIR=/opt/license-management/backend/uploads
MAX_FILE_SIZE=10485760
```

#### frontend/.env
```bash
# 환경 변수 로드
source /opt/license-management/.env.global

# React 환경 변수 (REACT_APP_ 접두사 필수)
REACT_APP_API_BASE_URL=http://${SERVER_IP}:${BACKEND_PORT}
REACT_APP_SERVER_IP=${SERVER_IP}
PORT=${FRONTEND_PORT}
HOST=${SERVER_IP}

# 한국 로케일 설정
REACT_APP_LOCALE=ko_KR
REACT_APP_TIMEZONE=Asia/Seoul
REACT_APP_DATE_FORMAT=YYYY-MM-DD
REACT_APP_DATETIME_FORMAT=YYYY-MM-DD HH:mm:ss
```

### 9.4 PM2 Ecosystem 설정

#### ecosystem.config.js
```javascript
module.exports = {
  apps: [
    {
      name: 'license-frontend',
      cwd: '/opt/license-management/frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.FRONTEND_PORT || 3600,
        HOST: process.env.SERVER_IP || '0.0.0.0'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/log/license-system/frontend-error.log',
      out_file: '/var/log/license-system/frontend-out.log',
      log_file: '/var/log/license-system/frontend.log'
    },
    {
      name: 'license-backend',
      cwd: '/opt/license-management/backend',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.BACKEND_PORT || 3601,
        HOST: process.env.SERVER_IP || '0.0.0.0'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/license-system/backend-error.log',
      out_file: '/var/log/license-system/backend-out.log',
      log_file: '/var/log/license-system/backend.log'
    }
  ]
};
```

### 9.5 배포 스크립트

#### deploy.sh
```bash
#!/bin/bash

# 환경 변수 로드
source /opt/license-management/.env.global

echo "라이센스 관리 시스템 배포 시작..."

# 로그 디렉토리 생성
sudo mkdir -p /var/log/license-system
sudo chown -R $USER:$USER /var/log/license-system

# 프로젝트 디렉토리로 이동
cd /opt/license-management

# 백엔드 의존성 설치 및 빌드
echo "백엔드 설정 중..."
cd backend
npm install --production
npm run init-db  # 데이터베이스 초기화 스크립트

# 프론트엔드 빌드
echo "프론트엔드 빌드 중..."
cd ../frontend
npm install
npm run build

# PM2로 서비스 시작/재시작
echo "PM2 서비스 시작..."
cd ..
pm2 delete license-frontend license-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "배포 완료!"
echo "Frontend: http://${SERVER_IP}:${FRONTEND_PORT}"
echo "Backend API: http://${SERVER_IP}:${BACKEND_PORT}"
```

### 9.6 다중 클라이언트 접근 설정

#### 서버 측 CORS 설정 (backend/src/middleware/cors.js)
```javascript
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // 개발 환경에서는 localhost 허용
    // 프로덕션에서는 특정 IP 대역 허용
    const allowedOrigins = [
      `http://${process.env.SERVER_IP}:${process.env.FRONTEND_PORT}`,
      `http://localhost:${process.env.FRONTEND_PORT}`,
      // 내부 네트워크 IP 대역 허용
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3600$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3600$/
    ];
    
    if (!origin) return callback(null, true); // Postman 등 도구 허용
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else {
        return allowed.test(origin);
      }
    });
    
    callback(null, isAllowed);
  },
  credentials: true
};

module.exports = cors(corsOptions);
```

#### 방화벽 설정
```bash
# Rocky Linux 9 방화벽 설정
sudo firewall-cmd --permanent --add-port=3600/tcp
sudo firewall-cmd --permanent --add-port=3601/tcp
sudo firewall-cmd --reload

# 포트 확인
sudo firewall-cmd --list-ports
```

### 9.7 단일 인증 시스템

#### 인증 미들웨어 (backend/src/middleware/auth.js)
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

class AuthService {
  constructor() {
    this.db = new sqlite3.Database(process.env.DB_PATH);
    this.initializeAdmin();
  }
  
  async initializeAdmin() {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    this.db.run(`
      INSERT OR REPLACE INTO users (username, password_hash) 
      VALUES ('admin', ?)
    `, [hashedPassword]);
  }
  
  async login(password) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, user) => {
        if (err) return reject(err);
        if (!user) return resolve(null);
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return resolve(null);
        
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        resolve({ token, user: { id: user.id, username: user.username } });
      });
    });
  }
  
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

const authService = new AuthService();

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '토큰이 필요합니다.' });
  }
  
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
  
  req.user = decoded;
  next();
};

module.exports = { authService, authenticate };
```

### 9.8 모니터링 및 로그 관리
```bash
# PM2 모니터링 명령어
pm2 status                    # 서비스 상태 확인
pm2 logs license-frontend     # 프론트엔드 로그 확인
pm2 logs license-backend      # 백엔드 로그 확인
pm2 monit                     # 실시간 모니터링

# 로그 로테이션 설정
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 9.9 백업 스크립트
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/license-system"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# SQLite 데이터베이스 백업
cp /opt/license-management/backend/database/licenses.db $BACKUP_DIR/licenses_$DATE.db

# 업로드된 파일 백업
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/license-management/backend/uploads/

# 7일 이상된 백업 파일 삭제
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "백업 완료: $DATE"
```

### 9.10 시스템 서비스 등록 (선택사항)
```bash
# /etc/systemd/system/license-system.service
[Unit]
Description=License Management System
After=network.target

[Service]
Type=forking
User=your-user
WorkingDirectory=/opt/license-management
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=always

[Install]
WantedBy=multi-user.target
```

## 10. 개발 단계별 계획

### Phase 1: 기본 기능 구현 (3주)
- 라이센스 파일 파싱 엔진 개발
- 데이터베이스 스키마 구축
- 기본 CRUD API 개발
- 파일 업로드 기능

### Phase 2: 대시보드 및 UI (2주)
- React 프론트엔드 개발
- 대시보드 컴포넌트 구현
- 라이센스 목록 및 검색 기능
- 반응형 UI 구현

### Phase 3: 모니터링 시스템 (1주)
- 만료 상태 표시 시스템 구현
- 백그라운드 스케줄러 개발
- 상태 관리 시스템

### Phase 4: 테스트 및 배포 (1주)
- 단위 테스트 작성
- 통합 테스트 수행
- 프로덕션 배포
- 사용자 교육

## 11. 예상 비용 및 리소스 (무료 도구 기반)

### 11.1 개발 리소스
- **백엔드 개발자**: 1명 (6주)
- **프론트엔드 개발자**: 1명 (5주)
- **시스템 관리자**: 0.5명 (Rocky Linux 설정, PM2 관리)

### 11.2 인프라 비용 (무료/최소 비용)
- **서버**: 기존 Rocky Linux 9 서버 활용 (추가 비용 없음)
- **데이터베이스**: SQLite3 (무료)
- **프로세스 관리**: PM2 (무료)
- **스토리지**: 로컬 디스크 사용 (추가 비용 없음)
- **모니터링**: PM2 내장 모니터링 (무료)
- **총 추가 비용**: $0/월

### 11.3 무료 도구 목록
- **개발 도구**: VS Code, Git, Node.js, npm
- **UI 라이브러리**: Ant Design (무료 오픈소스)
- **데이터베이스**: SQLite3
- **프로세스 관리**: PM2
- **스케줄링**: Node-cron
- **인증**: JWT + bcrypt
- **파일 처리**: Multer
- **로그 관리**: PM2 logrotate

## 12. 추가 기능 및 확장성

### 12.1 선택적 추가 기능
- **엑셀 내보내기**: xlsx 라이브러리 (무료)
- **PDF 보고서**: puppeteer (무료)
- **차트/그래프**: Chart.js (무료)
- **파일 압축**: archiver (무료)

### 12.2 성능 최적화
- **SQLite WAL 모드**: 동시 읽기 성능 향상
- **Redis 캐싱**: 필요시 무료 Redis 추가 가능
- **프론트엔드 최적화**: React.lazy, 코드 스플리팅

### 12.3 보안 강화
- **파일 검증**: 업로드 파일 MIME 타입 체크
- **Rate Limiting**: express-rate-limit (무료)
- **HTTPS**: Let's Encrypt (무료 SSL 인증서)
- **방화벽**: Rocky Linux firewalld 활용

## 13. 구현 예시 코드

### 13.1 백엔드 서버 메인 파일 (backend/src/server.js) - 한국어 지원
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('./middleware/cors');
const { authenticate } = require('./middleware/auth');
const licenseRoutes = require('./routes/licenses');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const DatabaseService = require('./services/database');

// 한국 시간대 설정
process.env.TZ = 'Asia/Seoul';
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Seoul');

const app = express();
const PORT = process.env.PORT || 3601;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`🌏 시간대 설정: ${process.env.TZ}`);
console.log(`📅 현재 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);

// 미들웨어 설정
app.use(cors);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 서빙 (업로드된 파일)
app.use('/uploads', express.static(process.env.UPLOAD_DIR));

// 데이터베이스 초기화
DatabaseService.initialize();

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/licenses', authenticate, licenseRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);

// 헬스 체크 (한국어 응답)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        message: '시스템이 정상적으로 작동 중입니다',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        timezone: 'Asia/Seoul',
        server: `${HOST}:${PORT}`,
        uptime: Math.floor(process.uptime()),
        uptimeFormat: `${Math.floor(process.uptime() / 3600)}시간 ${Math.floor((process.uptime() % 3600) / 60)}분`
    });
});

// 시간 정보 API
app.get('/api/time', (req, res) => {
    const now = moment();
    res.json({
        current: now.format('YYYY-MM-DD HH:mm:ss'),
        formatted: now.format('YYYY년 MM월 DD일 dddd HH시 mm분'),
        timezone: 'Asia/Seoul',
        iso: now.toISOString()
    });
});

// 에러 핸들링 (한국어)
app.use((err, req, res, next) => {
    console.error('오류 발생:', err);
    res.status(500).json({ 
        error: '서버 내부 오류',
        message: process.env.NODE_ENV === 'development' ? err.message : '문제가 발생했습니다. 관리자에게 문의하세요.',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

// 404 핸들링 (한국어)
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'API 엔드포인트를 찾을 수 없습니다',
        path: req.originalUrl,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

app.listen(PORT, HOST, () => {
    console.log(`\n🚀 Siemens 라이센스 관리 시스템 백엔드`);
    console.log(`📍 서버 주소: http://${HOST}:${PORT}`);
    console.log(`🗄️  데이터베이스: ${process.env.DB_PATH}`);
    console.log(`📁 업로드 디렉토리: ${process.env.UPLOAD_DIR}`);
    console.log(`🌍 환경: ${process.env.NODE_ENV}`);
    console.log(`🕐 시작 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
    console.log(`🌏 시간대: ${moment.tz.guess()} (${process.env.TZ})\n`);
});

// 프로세스 종료 처리 (한국어)
process.on('SIGINT', () => {
    console.log('\n👋 시스템을 안전하게 종료합니다...');
    console.log(`🕐 종료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
    DatabaseService.close();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ 처리되지 않은 예외:', error);
    console.log(`🕐 오류 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
});
```

### 13.2 데이터베이스 서비스 (backend/src/services/database.js) - 한국어 로그
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Seoul');

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/licenses.db');
    }
    
    initialize() {
        // 데이터베이스 디렉토리 생성
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log('📁 데이터베이스 디렉토리 생성 완료');
        }
        
        // SQLite WAL 모드로 연결
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ 데이터베이스 연결 실패:', err.message);
                process.exit(1);
            }
            console.log('✅ SQLite 데이터베이스 연결 성공');
        });
        
        // 한국 시간대 설정 확인
        this.db.exec("SELECT datetime('now', 'localtime') as current_time", (err) => {
            if (err) console.error('시간대 설정 확인 실패:', err);
        });
        
        // WAL 모드 활성화 (성능 향상)
        this.db.exec('PRAGMA journal_mode=WAL;', (err) => {
            if (err) console.error('WAL 모드 설정 실패:', err);
            else console.log('✅ SQLite WAL 모드 활성화 완료');
        });
        
        // 한국어 정렬 지원 설정
        this.db.exec('PRAGMA encoding="UTF-8";', (err) => {
            if (err) console.error('UTF-8 인코딩 설정 실패:', err);
            else console.log('✅ UTF-8 인코딩 설정 완료');
        });
        
        this.createTables();
        return this.db;
    }
    
    createTables() {
        const tables = [
            {
                name: 'sites',
                sql: `CREATE TABLE IF NOT EXISTS sites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    site_name TEXT NOT NULL,
                    site_number TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`
            },
            
            {
                name: 'licenses',
                sql: `CREATE TABLE IF NOT EXISTS licenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    site_id INTEGER,
                    host_id TEXT NOT NULL,
                    part_number TEXT NOT NULL,
                    part_name TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    upload_date DATETIME DEFAULT (datetime('now', 'localtime')),
                    manager_name TEXT,
                    department TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (site_id) REFERENCES sites(id)
                )`
            },
            
            {
                name: 'license_features',
                sql: `CREATE TABLE IF NOT EXISTS license_features (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    license_id INTEGER,
                    feature_name TEXT NOT NULL,
                    version TEXT NOT NULL,
                    start_date DATE NOT NULL,
                    expiry_date DATE NOT NULL,
                    serial_number TEXT,
                    status TEXT DEFAULT 'ACTIVE',
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (license_id) REFERENCES licenses(id)
                )`
            },
            
            {
                name: 'users',
                sql: `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL DEFAULT 'admin',
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )`
            }
        ];
        
        let completedTables = 0;
        tables.forEach(table => {
            this.db.exec(table.sql, (err) => {
                if (err) {
                    console.error(`❌ ${table.name} 테이블 생성 실패:`, err.message);
                } else {
                    completedTables++;
                    console.log(`✅ ${table.name} 테이블 생성/확인 완료`);
                }
                
                if (completedTables === tables.length) {
                    console.log(`🎉 총 ${tables.length}개 테이블 초기화 완료`);
                    console.log(`📅 데이터베이스 초기화 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
                }
            });
        });
    }
    
    // 한국어 검색을 위한 COLLATE 함수
    getKoreanCollation() {
        return 'COLLATE NOCASE';
    }
    
    // 날짜 관련 헬퍼 함수들
    getCurrentDateTime() {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }
    
    getCurrentDate() {
        return moment().format('YYYY-MM-DD');
    }
    
    formatDateForDisplay(dateStr) {
        return moment(dateStr).format('YYYY년 MM월 DD일');
    }
    
    formatDateTimeForDisplay(dateStr) {
        return moment(dateStr).format('YYYY년 MM월 DD일 HH시 mm분');
    }
    
    // 만료일 계산
    calculateDaysUntilExpiry(expiryDate) {
        const today = moment();
        const expiry = moment(expiryDate);
        return expiry.diff(today, 'days');
    }
    
    getDatabase() {
        return this.db;
    }
    
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ 데이터베이스 연결 종료 실패:', err.message);
                } else {
                    console.log('✅ 데이터베이스 연결이 안전하게 종료되었습니다');
                    console.log(`📅 종료 시간: ${moment().format('YYYY년 MM월 DD일 HH시 mm분 ss초')}`);
                }
            });
        }
    }
}

module.exports = new DatabaseService();
```

### 13.3 백엔드 패키지 설정 (backend/package.json)
```json
{
  "name": "license-management-backend",
  "version": "1.0.0",
  "main": "src/server.js",
  "dependencies": {
    "express": "^4.18.0",
    "sqlite3": "^5.1.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "multer": "^1.4.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.0",
    "moment": "^2.29.4",
    "moment-timezone": "^0.5.43",
    "node-cron": "^3.0.2"
  },
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "init-db": "node scripts/init-database.js"
  }
}
```

### 13.4 프론트엔드 패키지 설정 (frontend/package.json) - 한국어 지원 라이브러리
```json
{
  "name": "license-management-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "antd": "^5.12.0",
    "@ant-design/icons": "^5.2.0",
    "axios": "^1.6.0",
    "moment": "^2.29.4",
    "moment-timezone": "^0.5.43",
    "recharts": "^2.8.0",
    "react-i18next": "^13.5.0",
    "i18next": "^23.7.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "homepage": ".",
  "proxy": "http://localhost:3601"
}
```

### 13.5 자동 시작 스크립트 (start-system.sh) - 한국어 메시지
```bash
#!/bin/bash

# 한국어 로케일 설정
export LANG=ko_KR.UTF-8
export LC_TIME=ko_KR.UTF-8
export TZ=Asia/Seoul

# 시스템 시작 스크립트
echo "🚀 Siemens 라이센스 관리 시스템 시작 중..."
echo "📅 시작 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"

# 환경 변수 로드
if [ -f "/opt/license-management/.env.global" ]; then
    source /opt/license-management/.env.global
    echo "✅ 환경 변수 로드 완료"
else
    echo "❌ .env.global 파일을 찾을 수 없습니다."
    echo "   경로: /opt/license-management/.env.global"
    exit 1
fi

# Rocky Linux 로케일 확인 및 설정
if ! locale -a | grep -q "ko_KR.utf8"; then
    echo "⚠️  한국어 로케일이 설치되지 않았습니다."
    echo "   다음 명령어로 설치하세요: sudo dnf install glibc-langpack-ko"
    echo "   현재는 기본 설정으로 진행합니다."
fi

# 프로젝트 디렉토리로 이동
cd /opt/license-management || {
    echo "❌ 프로젝트 디렉토리를 찾을 수 없습니다: /opt/license-management"
    exit 1
}

# 필수 디렉토리 확인 및 생성
echo "📁 필수 디렉토리 확인 중..."
mkdir -p backend/database
mkdir -p backend/uploads
mkdir -p /var/log/license-system
mkdir -p /backup/license-system

# 권한 설정
chmod 755 backend/database
chmod 755 backend/uploads
chmod 755 /var/log/license-system
chmod 755 /backup/license-system

# PM2가 실행 중인지 확인
if ! pgrep -f "PM2" > /dev/null; then
    echo "🔄 PM2 시작 중..."
    pm2 resurrect
fi

# 기존 프로세스 상태 확인
echo "📊 현재 프로세스 상태:"
pm2 status | grep -E "(license-frontend|license-backend)" || echo "   관련 프로세스가 실행 중이지 않습니다."

# 기존 프로세스 중지
echo "⏹️  기존 프로세스 중지 중..."
pm2 stop license-frontend license-backend 2>/dev/null || echo "   중지할 프로세스가 없습니다."

# 새 프로세스 시작
echo "▶️  새 프로세스 시작 중..."
pm2 start ecosystem.config.js

# 시작 대기
echo "⏳ 프로세스 시작 대기 중..."
sleep 5

# 상태 확인
echo "📋 최종 상태 확인:"
pm2 status

# 헬스 체크
echo ""
echo "🏥 시스템 헬스 체크..."

# 백엔드 헬스 체크
if curl -s "http://${SERVER_IP}:${BACKEND_PORT}/api/health" > /dev/null; then
    echo "✅ 백엔드 서버 정상 작동 중"
else
    echo "❌ 백엔드 서버 연결 실패"
fi

# 프론트엔드 확인 (간단히 포트만 체크)
if netstat -tuln | grep -q ":${FRONTEND_PORT}"; then
    echo "✅ 프론트엔드 서버 포트 활성화"
else
    echo "❌ 프론트엔드 서버 포트 비활성화"
fi

echo ""
echo "🎉 시스템 시작 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 프론트엔드: http://${SERVER_IP}:${FRONTEND_PORT}"
echo "🔌 백엔드 API: http://${SERVER_IP}:${BACKEND_PORT}"
echo "💾 데이터베이스: ${DB_PATH}"
echo "📁 업로드 디렉토리: /opt/license-management/backend/uploads"
echo "📄 로그 디렉토리: /var/log/license-system"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🛠️  유용한 명령어:"
echo "   📊 실시간 모니터링: pm2 monit"
echo "   📋 로그 확인: pm2 logs"
echo "   📋 프론트엔드 로그: pm2 logs license-frontend"
echo "   📋 백엔드 로그: pm2 logs license-backend"
echo "   🔄 재시작: pm2 restart license-frontend license-backend"
echo "   ⏹️  시스템 중지: pm2 stop license-frontend license-backend"
echo "   💾 설정 저장: pm2 save"
echo ""
echo "📞 문제가 발생하면 시스템 관리자에게 문의하세요."
echo "📅 완료 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"
```

### 13.6 백업 스크립트 (backup.sh) - 한국어 메시지
```bash
#!/bin/bash

# 한국어 로케일 설정
export LANG=ko_KR.UTF-8
export LC_TIME=ko_KR.UTF-8
export TZ=Asia/Seoul

BACKUP_DIR="/backup/license-system"
DATE=$(date +%Y%m%d_%H%M%S)
DATE_KO=$(date '+%Y년 %m월 %d일 %H시 %M분')

echo "🗄️  Siemens 라이센스 관리 시스템 백업 시작"
echo "📅 백업 시간: ${DATE_KO}"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 환경 변수 로드
if [ -f "/opt/license-management/.env.global" ]; then
    source /opt/license-management/.env.global
else
    echo "❌ 환경 설정 파일을 찾을 수 없습니다."
    exit 1
fi

echo "📂 백업 대상:"
echo "   - SQLite 데이터베이스: ${DB_PATH}"
echo "   - 업로드된 파일: /opt/license-management/backend/uploads/"
echo "   - 환경 설정: /opt/license-management/.env.global"

# SQLite 데이터베이스 백업 (온라인 백업)
if [ -f "${DB_PATH}" ]; then
    echo "💾 데이터베이스 백업 중..."
    sqlite3 "${DB_PATH}" ".backup '${BACKUP_DIR}/licenses_${DATE}.db'"
    if [ $? -eq 0 ]; then
        echo "✅ 데이터베이스 백업 완료: licenses_${DATE}.db"
        
        # 백업 파일 크기 확인
        BACKUP_SIZE=$(du -h "${BACKUP_DIR}/licenses_${DATE}.db" | cut -f1)
        echo "   파일 크기: ${BACKUP_SIZE}"
    else
        echo "❌ 데이터베이스 백업 실패"
    fi
else
    echo "⚠️  데이터베이스 파일을 찾을 수 없습니다: ${DB_PATH}"
fi

# 업로드된 파일 백업
if [ -d "/opt/license-management/backend/uploads" ]; then
    echo "📁 업로드 파일 백업 중..."
    tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /opt/license-management/backend uploads/
    if [ $? -eq 0 ]; then
        echo "✅ 업로드 파일 백업 완료: uploads_$DATE.tar.gz"
        
        # 백업 파일 크기 확인
        UPLOAD_SIZE=$(du -h "${BACKUP_DIR}/uploads_${DATE}.tar.gz" | cut -f1)
        echo "   파일 크기: ${UPLOAD_SIZE}"
        
        # 파일 개수 확인
        FILE_COUNT=$(find /opt/license-management/backend/uploads -type f | wc -l)
        echo "   백업된 파일 개수: ${FILE_COUNT}개"
    else
        echo "❌ 업로드 파일 백업 실패"
    fi
else
    echo "⚠️  업로드 디렉토리를 찾을 수 없습니다"
fi

# 환경 설정 파일 백업
echo "⚙️  환경 설정 파일 백업 중..."
cp /opt/license-management/.env.global $BACKUP_DIR/env_global_$DATE.backup
if [ $? -eq 0 ]; then
    echo "✅ 환경 설정 백업 완료: env_global_$DATE.backup"
else
    echo "❌ 환경 설정 백업 실패"
fi

# PM2 설정 백업
if [ -f "/opt/license-management/ecosystem.config.js" ]; then
    echo "🔧 PM2 설정 파일 백업 중..."
    cp /opt/license-management/ecosystem.config.js $BACKUP_DIR/ecosystem_$DATE.backup
    echo "✅ PM2 설정 백업 완료: ecosystem_$DATE.backup"
fi

# 백업 완료 후 정리 작업
echo ""
echo "🧹 이전 백업 파일 정리 중..."

# 7일 이상된 백업 파일 삭제
DELETED_DB=$(find $BACKUP_DIR -name "licenses_*.db" -mtime +7 -delete -print | wc -l)
DELETED_UPLOADS=$(find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete -print | wc -l)
DELETED_CONFIG=$(find $BACKUP_DIR -name "env_global_*.backup" -mtime +7 -delete -print | wc -l)
DELETED_ECOSYSTEM=$(find $BACKUP_DIR -name "ecosystem_*.backup" -mtime +7 -delete -print | wc -l)

TOTAL_DELETED=$((DELETED_DB + DELETED_UPLOADS + DELETED_CONFIG + DELETED_ECOSYSTEM))

if [ $TOTAL_DELETED -gt 0 ]; then
    echo "🗑️  ${TOTAL_DELETED}개의 오래된 백업 파일을 삭제했습니다"
    echo "   - 데이터베이스: ${DELETED_DB}개"
    echo "   - 업로드 파일: ${DELETED_UPLOADS}개" 
    echo "   - 환경 설정: ${DELETED_CONFIG}개"
    echo "   - PM2 설정: ${DELETED_ECOSYSTEM}개"
else
    echo "🔍 삭제할 오래된 백업 파일이 없습니다"
fi

# 현재 백업 디렉토리 용량 확인
BACKUP_TOTAL_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
BACKUP_FILE_COUNT=$(find $BACKUP_DIR -type f | wc -l)

echo ""
echo "📊 백업 완료 요약:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 백업 일시: ${DATE_KO}"
echo "📂 백업 위치: ${BACKUP_DIR}"
echo "💾 전체 백업 크기: ${BACKUP_TOTAL_SIZE}"
echo "📄 총 백업 파일 수: ${BACKUP_FILE_COUNT}개"
echo "🔄 자동 정리: 7일 이상 된 파일 ${TOTAL_DELETED}개 삭제"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 백업 검증
echo ""
echo "🔍 백업 파일 검증 중..."

# 데이터베이스 백업 검증
if [ -f "${BACKUP_DIR}/licenses_${DATE}.db" ]; then
    sqlite3 "${BACKUP_DIR}/licenses_${DATE}.db" ".schema" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 데이터베이스 백업 파일 유효성 검증 성공"
    else
        echo "❌ 데이터베이스 백업 파일 손상됨"
    fi
fi

# 압축 파일 검증
if [ -f "${BACKUP_DIR}/uploads_${DATE}.tar.gz" ]; then
    tar -tzf "${BACKUP_DIR}/uploads_${DATE}.tar.gz" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 업로드 파일 압축 백업 유효성 검증 성공"
    else
        echo "❌ 업로드 파일 압축 백업 손상됨"
    fi
fi

echo ""
echo "🎉 백업 작업이 성공적으로 완료되었습니다!"
echo "📅 완료 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"
```

## 14. Rocky Linux 9 한국어 환경 설정

### 14.1 시스템 로케일 설정
```bash
# 한국어 언어팩 설치
sudo dnf install -y glibc-langpack-ko

# 시스템 로케일 확인
locale -a | grep ko

# 환경 변수 설정 추가 (/etc/environment)
echo 'LANG=ko_KR.UTF-8' | sudo tee -a /etc/environment
echo 'LC_TIME=ko_KR.UTF-8' | sudo tee -a /etc/environment
echo 'TZ=Asia/Seoul' | sudo tee -a /etc/environment

# 시간대 설정
sudo timedatectl set-timezone Asia/Seoul

# 설정 확인
timedatectl status
```

### 14.2 한국어 폰트 설치 (웹 폰트 대체)
```bash
# 한국어 웹 폰트를 위한 추가 설정 (선택사항)
sudo dnf install -y google-noto-cjk-fonts
sudo dnf install -y google-noto-fonts-common

# 시스템 재시작 후 적용
sudo systemctl restart systemd-localed
```

### 14.3 Node.js 및 필수 패키지 설치
```bash
# Node.js 설치 (Rocky Linux 9)
sudo dnf install -y nodejs npm git sqlite

# PM2 글로벌 설치
sudo npm install -g pm2

# 설치 확인
node --version
npm --version
pm2 --version
sqlite3 --version
```

## 15. 최종 체크리스트 (한국어 환경 포함)

### 15.1 설치 및 설정 체크리스트
- [ ] Rocky Linux 9 서버 준비
- [ ] 한국어 로케일 패키지 설치 (glibc-langpack-ko)
- [ ] 시간대 Seoul로 설정
- [ ] Node.js, npm, git, sqlite 설치
- [ ] PM2 글로벌 설치 확인
- [ ] 프로젝트 디렉토리 생성 (/opt/license-management)
- [ ] 환경 변수 파일 설정 (.env.global) - 한국어 설정 포함
- [ ] 방화벽 포트 개방 (3600, 3601)
- [ ] 로그 디렉토리 생성 (/var/log/license-system)
- [ ] 백업 디렉토리 생성 (/backup/license-system)

### 15.2 한국어 지원 체크리스트
- [ ] 프론트엔드 Ant Design 한국어 로케일 설정
- [ ] Moment.js 한국어 로케일 및 Seoul 시간대 설정
- [ ] 백엔드 SQLite 데이터 시간대 Seoul 설정
- [ ] 시스템 로그 및 알림 메시지 한국어화
- [ ] 날짜/시간 표시 형식을 한국 형식으로 설정
- [ ] 에러 메시지 및 사용자 인터페이스 한국어화

### 15.3 운영 체크리스트
- [ ] PM2 ecosystem 설정 완료
- [ ] 자동 백업 스크립트 설정 (한국어 로그 포함)
- [ ] 로그 로테이션 설정
- [ ] 다중 클라이언트 접근 테스트
- [ ] 시스템 부팅시 자동 시작 설정
- [ ] 한국 시간대 정상 작동 확인
- [ ] 한국어 UI 표시 확인

### 15.4 기능 테스트 체크리스트
- [ ] 라이센스 파일 업로드 테스트
- [ ] 파일 파싱 정상 작동 확인
- [ ] 대시보드 데이터 표시 확인
- [ ] 만료일 계산 및 상태 표시 확인
- [ ] 검색 및 필터 기능 테스트
- [ ] 사용자 인증 기능 테스트
- [ ] 다중 사용자 동시 접속 테스트
- [ ] 백업 및 복구 테스트

## 16. 문제 해결 가이드

### 16.1 일반적인 문제 및 해결방법
- **포트 충돌**: `netstat -tuln | grep :3600` 로 포트 사용 확인
- **PM2 프로세스 오류**: `pm2 logs` 로 로그 확인 후 `pm2 restart all`
- **데이터베이스 접근 오류**: SQLite 파일 권한 확인 `chmod 644 licenses.db`
- **한국어 표시 오류**: 로케일 설정 재확인 `locale` 명령어
- **시간대 오류**: `timedatectl status` 로 시간대 확인

### 16.2 성능 최적화 팁
- SQLite WAL 모드 활성화 (이미 구현됨)
- PM2 클러스터 모드 (필요시)
- 정적 파일 캐싱 설정
- 로그 로테이션 정기 실행

## 17. 마무리

이 설계서를 통해 한국 사용자에게 최적화된 완전한 Siemens 라이센스 관리 시스템을 구축할 수 있습니다. 

### 주요 특징:
- ✅ **완전한 한국어 지원** (UI, 로그, 시간 형식)
- ✅ **Rocky Linux 9 최적화**
- ✅ **PM2 기반 안정적인 프로세스 관리**
- ✅ **SQLite 기반 간편한 데이터 관리**
- ✅ **다중 클라이언트 접근 지원**
- ✅ **단일 계정 간편 인증**
- ✅ **자동 백업 시스템**
- ✅ **무료 도구로만 구성 (비용 $0)**

모든 날짜/시간은 서울 표준시로 표시되고, UI와 시스템 메시지는 자연스러운 한국어로 제공됩니다. Rocky Linux 9 서버에서 바로 구축하여 사용할 수 있는 완전한 라이센스 관리 시스템입니다! (values) => {
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
    
    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Card 
                style={{ 
                    width: 400, 
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    borderRadius: '12px'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <SafetyOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: 16 }} />
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                        Siemens 라이센스 관리 시스템
                    </Title>
                    <Text type="secondary">관리자 인증이 필요합니다</Text>
                </div>
                
                <Form onFinish={handleLogin} size="large">
                    <Form.Item 
                        name="password" 
                        rules={[{ required: true, message: '관리자 비밀번호를 입력해주세요' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="관리자 비밀번호"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                        시스템 관리자에게 문의하여 비밀번호를 확인하세요
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default Login;
```

### 6.4 Dashboard 컴포넌트 (한국어 + 한국 시간대)
```jsx
// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Alert, Table, Tag, Typography } from 'antd';
import { 
    FileTextOutlined, 
    ExclamationCircleOutlined, 
    CheckCircleOutlined,
    ClockCircleOutlined 
} from '@ant-design/icons';
import { apiClient } from '../config/api';
import { formatDate, formatDateTime, getExpiryStatus } from '../config/locale';

const { Title, Text } = Typography;

const Dashboard = () => {
    const [summary, setSummary] = useState(null);
    const [expiringLicenses, setExpiringLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [serverInfo, setServerInfo] = useState('');
    
    useEffect(() => {
        // 서버 정보 표시 (현재 접속 중인 서버)
        setServerInfo(`${window.location.hostname}:3601`);
        loadDashboardData();
    }, []);
    
    const loadDashboardData = async () => {
        try {
            const [summaryRes, expiringRes] = await Promise.all([
                apiClient.get('/api/dashboard/summary'),
                apiClient.get('/api/licenses/expiring?days=30')
            ]);
            
            setSummary(summaryRes.data);
            setExpiringLicenses(expiringRes.data);
        } catch (error) {
            console.error('대시보드 데이터 로드 실패:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const expiringColumns = [
        {
            title: '사이트명',
            dataIndex: 'siteName',
            key: 'siteName',
        },
        {
            title: '제품명',
            dataIndex: 'partName',
            key: 'partName',
        },
        {
            title: '피처명',
            dataIndex: 'featureName',
            key: 'featureName',
        },
        {
            title: '만료일',
            dataIndex: 'expiryDate',
            key: 'expiryDate',
            render: (date) => formatDate(date, 'YYYY년 MM월 DD일'),
        },
        {
            title: '상태',
            key: 'status',
            render: (_, record) => {
                const status = getExpiryStatus(record.expiryDate);
                return (
                    <Tag color={status.color} icon={<ClockCircleOutlined />}>
                        {status.text}
                    </Tag>
                );
            }
        },
        {
            title: '담당자',
            dataIndex: 'managerName',
            key: 'managerName',
            render: (name) => name || '-'
        },
        {
            title: '부서',
            dataIndex: 'department',
            key: 'department',
            render: (dept) => dept || '-'
        }
    ];
    
    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={24}>
                    <Alert 
                        message={`연결된 서버: ${serverInfo} | 현재 시간: ${formatDateTime(new Date())}`}
                        type="info"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />
                </Col>
            </Row>
            
            <Title level={2}>라이센스 현황 대시보드</Title>
            
            {/* 요약 카드 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic
                            title="총 라이센스"
                            value={summary?.totalLicenses || 0}
                            prefix={<FileTextOutlined />}
                            suffix="개"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic
                            title="30일 내 만료"
                            value={summary?.expiringIn30Days || 0}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="개"
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic
                            title="7일 내 만료"
                            value={summary?.expiringIn7Days || 0}
                            prefix={<ExclamationCircleOutlined />}
                            suffix="개"
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic
                            title="활성 사이트"
                            value={summary?.activeSites || 0}
                            prefix={<CheckCircleOutlined />}
                            suffix="개"
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
            </Row>
            
            {/* 부서별 분포 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="부서별 라이센스 분포" loading={loading}>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Statistic
                                    title="EDA"
                                    value={summary?.departmentBreakdown?.EDA || 0}
                                    suffix="개"
                                />
                            </Col>
                            <Col span={8}>
                                <Statistic
                                    title="PADS"
                                    value={summary?.departmentBreakdown?.PADS || 0}
                                    suffix="개"
                                />
                            </Col>
                            <Col span={8}>
                                <Statistic
                                    title="CAD"
                                    value={summary?.departmentBreakdown?.CAD || 0}
                                    suffix="개"
                                />
                            </Col>
                        </Row>
                    </Card>
                </Col>
                
                <Col xs={24} lg={12}>
                    <Card title="시스템 정보" loading={loading}>
                        <div style={{ lineHeight: '2' }}>
                            <Text strong>마지막 업데이트: </Text>
                            <Text>{formatDateTime(new Date())}</Text>
                            <br />
                            <Text strong>시간대: </Text>
                            <Text>서울 (GMT+9)</Text>
                            <br />
                            <Text strong>총 처리된 파일: </Text>
                            <Text>{summary?.totalFiles || 0}개</Text>
                        </div>
                    </Card>
                </Col>
            </Row>
            
            {/* 만료 예정 라이센스 테이블 */}
            <Card 
                title="30일 내 만료 예정 라이센스" 
                loading={loading}
                extra={
                    <Text type="secondary">
                        총 {expiringLicenses.length}개의 라이센스
                    </Text>
                }
            >
                <Table
                    columns={expiringColumns}
                    dataSource={expiringLicenses}
                    rowKey="id"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                            `${range[0]}-${range[1]} / 총 ${total}개`,
                    }}
                    scroll={{ x: 800 }}
                />
            </Card>
        </div>
    );
};

export default Dashboard;
```

### 6.5 네트워크 연결 상태 모니터링
```jsx
// src/hooks/useNetworkStatus.js
const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [serverReachable, setServerReachable] = useState(true);
    
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // 서버 연결 상태 주기적 체크
        const checkServer = async () => {
            try {
                await apiClient.get('/api/health');
                setServerReachable(true);
            } catch {
                setServerReachable(false);
            }
        };
        
        const interval = setInterval(checkServer, 30000); // 30초마다 체크
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);
    
    return { isOnline, serverReachable };
};
```

### 6.6 페이지 구성
1. **대시보드**: 전체 현황 및 요약 정보
2. **라이센스 관리**: 전체 라이센스 목록 및 검색
3. **파일 업로드**: 새 라이센스 파일 업로드
4. **만료 알림**: 만료 예정 라이센스 목록
5. **사이트 관리**: 사이트별 라이센스 현황

## 7. 라이센스 상태 모니터링

### 7.1 상태 표시 규칙
- **30일 전**: 주의 상태 표시
- **7일 전**: 경고 상태 표시  
- **만료일**: 만료 상태 표시
- **만료 후**: 만료된 상태 표시

### 7.2 백그라운드 모니터링
```javascript
const cron = require('node-cron');

// 매일 오전 9시에 실행
cron.schedule('0 9 * * *', async () => {
    console.log('라이센스 만료 상태 업데이트 시작');
    await updateLicenseStatus();
});

async