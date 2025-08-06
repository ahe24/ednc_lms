# EDNC License Management System

한국어 지원 Siemens 라이센스 관리 시스템

## 🚀 빠른 시작

### 자동 설치 및 실행
```bash
# 프로젝트 디렉토리로 이동
cd /home/csjo/a3_claude/lms_ednc

# 시스템 시작 (자동 의존성 설치 포함)
./scripts/start-system.sh

# 접속 정보
- 프론트엔드: http://localhost:3600
- 백엔드 API: http://localhost:3601
- 기본 로그인: admin / 70998 (힌트: same with Door lock)
```

### 시스템 중지
```bash
./scripts/stop-system.sh
```

### 백업 생성
```bash
./scripts/backup-system.sh
```

## 📋 주요 기능

- ✅ **Siemens 라이센스 파일 자동 파싱**
- ✅ **한국어 UI 및 한국 시간대 지원**
- ✅ **라이센스 만료일 모니터링**
- ✅ **사이트별 라이센스 관리**
- ✅ **대시보드 현황 시각화**
- ✅ **파일 업로드 및 자동 처리**
- ✅ **다중 클라이언트 접근 지원**

## 🏗️ 시스템 구조

```
📁 lms_ednc/
├── 📁 backend/          # Node.js API 서버
│   ├── src/
│   │   ├── routes/      # API 라우트
│   │   ├── services/    # 비즈니스 로직
│   │   └── middleware/  # 인증 미들웨어
│   ├── database/        # SQLite 데이터베이스
│   └── uploads/         # 업로드 파일 저장
├── 📁 frontend/         # React 웹 애플리케이션
│   └── src/
│       ├── components/  # UI 컴포넌트
│       ├── pages/       # 페이지 컴포넌트
│       └── config/      # 설정 파일
├── 📁 scripts/          # 배포 스크립트
└── 📁 docs/            # 문서
```

## ⚙️ 기술 스택

- **Frontend**: React 18 + Ant Design + Korean locale
- **Backend**: Node.js + Express + SQLite3
- **Process Manager**: PM2
- **Authentication**: JWT + bcrypt
- **File Processing**: Multer + Custom Parser
- **Timezone**: Asia/Seoul (Korean Standard Time)

## 🔧 개발 환경 설정

### 백엔드 개발
```bash
cd backend
npm install
npm run dev          # 개발 서버 실행
npm run init-db      # 데이터베이스 초기화
```

### 프론트엔드 개발
```bash
cd frontend
npm install
npm start           # 개발 서버 실행 (포트 3600)
```

## 📊 API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/verify` - 토큰 검증

### 라이센스 관리
- `GET /api/licenses` - 라이센스 목록 조회
- `GET /api/licenses/:id` - 라이센스 상세 조회
- `POST /api/licenses/upload` - 라이센스 파일 업로드
- `GET /api/licenses/expiring` - 만료 예정 라이센스 조회
- `DELETE /api/licenses/:id` - 라이센스 삭제

### 대시보드
- `GET /api/dashboard/summary` - 요약 정보
- `GET /api/dashboard/expiry-chart` - 만료 상태 차트 데이터
- `GET /api/dashboard/system-status` - 시스템 상태 정보

## 🗄️ 데이터베이스 스키마

### sites 테이블
- `id`, `site_name`, `site_number`, `created_at`, `updated_at`

### licenses 테이블
- `id`, `site_id`, `host_id`, `part_number`, `part_name`, `file_name`
- `manager_name`, `department`, `upload_date`, `created_at`, `updated_at`

### license_features 테이블
- `id`, `license_id`, `feature_name`, `version`, `start_date`, `expiry_date`
- `serial_number`, `status`, `created_at`

### users 테이블
- `id`, `username`, `password_hash`, `created_at`, `updated_at`

## 🔍 라이센스 파일 지원 형식

시스템은 다음 형식의 Siemens 라이센스 파일을 자동으로 파싱합니다:

- **파일 확장자**: `.lic`, `.txt`
- **사이트 정보**: `# [Site Name] Site # :[Site ID]=[Site Name]`
- **Host ID**: `HOSTID=FLEXID=` 패턴
- **날짜 형식**: `dd-mmm-yyyy`, `dd mmm yyyy`
- **최대 파일 크기**: 10MB

## 🛠️ 유용한 명령어

### PM2 관리
```bash
pm2 status              # 프로세스 상태 확인
pm2 logs                # 모든 로그 확인
pm2 logs license-backend # 백엔드 로그만 확인
pm2 logs license-frontend # 프론트엔드 로그만 확인
pm2 monit               # 실시간 모니터링
pm2 restart all         # 모든 프로세스 재시작
pm2 stop all           # 모든 프로세스 중지
pm2 save               # 현재 설정 저장
```

### 시스템 상태 확인
```bash
# 백엔드 헬스 체크
curl http://localhost:3601/api/health

# 현재 시간 확인
curl http://localhost:3601/api/time

# 포트 사용 확인
netstat -tuln | grep -E ":(3600|3601)"
```

## 🚨 문제 해결

### 일반적인 문제
1. **포트 충돌**: `netstat -tuln | grep :3600` 으로 포트 사용 확인
2. **PM2 프로세스 오류**: `pm2 logs` 로 로그 확인 후 `pm2 restart all`
3. **데이터베이스 접근 오류**: SQLite 파일 권한 확인 `chmod 644 licenses.db`
4. **한국어 표시 오류**: 시스템 로케일 설정 확인 `locale`

### 로그 파일 위치
- PM2 로그: `/var/log/license-system/`
- 백엔드 로그: `backend-*.log`
- 프론트엔드 로그: `frontend-*.log`

## 🔐 보안

- JWT 토큰 기반 인증
- 파일 업로드 확장자 제한
- CORS 설정으로 내부 네트워크만 접근 허용
- 비밀번호 bcrypt 암호화
- 환경 변수를 통한 설정 분리

## 📞 지원

시스템 관련 문의사항이 있으시면:
- 로그 파일 확인: `pm2 logs`
- 시스템 상태 확인: `pm2 status`
- 백업 및 복구: `./scripts/backup-system.sh`

---
© 2024 EDNC Team. Built with ❤️ for Korean users.