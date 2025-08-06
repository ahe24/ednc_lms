#!/bin/bash

# 한국어 로케일 설정
export LANG=ko_KR.UTF-8
export LC_TIME=ko_KR.UTF-8
export TZ=Asia/Seoul

# 시스템 시작 스크립트
echo "🚀 EDNC License 관리 시스템 시작 중..."
echo "📅 시작 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"

# 프로젝트 루트 디렉토리 설정
PROJECT_ROOT="/home/csjo/a3_claude/lms_ednc"
cd "$PROJECT_ROOT" || {
    echo "❌ 프로젝트 디렉토리를 찾을 수 없습니다: $PROJECT_ROOT"
    exit 1
}

# 환경 변수 로드
if [ -f "$PROJECT_ROOT/.env.global" ]; then
    source "$PROJECT_ROOT/.env.global"
    echo "✅ 환경 변수 로드 완료"
else
    echo "⚠️  .env.global 파일을 찾을 수 없습니다. 기본값을 사용합니다."
    export SERVER_IP="localhost"
    export FRONTEND_PORT="3600"
    export BACKEND_PORT="3601"
fi

# 필수 디렉토리 확인 및 생성
echo "📁 필수 디렉토리 확인 중..."
mkdir -p backend/database
mkdir -p backend/uploads

# 로그 디렉토리 생성 (권한 문제시 프로젝트 내부에 생성)
if ! mkdir -p /var/log/license-system 2>/dev/null; then
    echo "⚠️  /var/log/license-system 생성 권한이 없습니다. 프로젝트 내부에 생성합니다."
    mkdir -p logs
    LOG_DIR="$PROJECT_ROOT/logs"
else
    LOG_DIR="/var/log/license-system"
fi

echo "📄 로그 디렉토리: $LOG_DIR"

# 권한 설정
chmod 755 backend/database 2>/dev/null
chmod 755 backend/uploads 2>/dev/null
chmod 755 "$LOG_DIR" 2>/dev/null

# Node.js 및 npm 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되지 않았습니다."
    echo "   설치 방법: sudo dnf install -y nodejs npm"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm이 설치되지 않았습니다."
    echo "   설치 방법: sudo dnf install -y nodejs npm"
    exit 1
fi

echo "✅ Node.js $(node --version) 및 npm $(npm --version) 확인 완료"

# 백엔드 의존성 설치
echo "📦 백엔드 의존성 설치 중..."
cd "$PROJECT_ROOT/backend"
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    # npm 캐시 정리
    npm cache clean --force 2>/dev/null || true
    
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ 백엔드 의존성 설치 완료"
    else
        echo "❌ 백엔드 의존성 설치 실패. 수동 설치 스크립트를 실행해보세요:"
        echo "   ./scripts/install-deps.sh"
        exit 1
    fi
else
    echo "✅ 백엔드 의존성이 이미 설치되어 있습니다"
fi

# 데이터베이스 초기화
echo "🗄️  데이터베이스 초기화 중..."
npm run init-db
if [ $? -eq 0 ]; then
    echo "✅ 데이터베이스 초기화 완료"
else
    echo "⚠️  데이터베이스 초기화에서 경고가 발생했습니다 (계속 진행)"
fi

# 프론트엔드 의존성 설치
echo "📦 프론트엔드 의존성 설치 중..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ 프론트엔드 의존성 설치 완료"
    else
        echo "❌ 프론트엔드 의존성 설치 실패"
        exit 1
    fi
else
    echo "✅ 프론트엔드 의존성이 이미 설치되어 있습니다"
fi

# PM2 확인 및 설치
if ! command -v pm2 &> /dev/null; then
    echo "📥 PM2 설치 중..."
    npm install -g pm2
    if [ $? -eq 0 ]; then
        echo "✅ PM2 설치 완료"
    else
        echo "❌ PM2 설치 실패. 수동으로 설치해주세요: npm install -g pm2"
        exit 1
    fi
else
    echo "✅ PM2 $(pm2 --version) 확인 완료"
fi

# 프로젝트 루트로 이동
cd "$PROJECT_ROOT"

# 기존 프로세스 상태 확인
echo "📊 현재 프로세스 상태:"
pm2 status | grep -E "(license-frontend|license-backend)" || echo "   관련 프로세스가 실행 중이지 않습니다."

# 기존 프로세스 중지
echo "⏹️  기존 프로세스 중지 중..."
pm2 delete license-frontend license-backend 2>/dev/null || echo "   중지할 프로세스가 없습니다."

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
sleep 3
echo "   백엔드 서버 확인 중..."
if curl -s "http://localhost:${BACKEND_PORT}/api/health" > /dev/null 2>&1; then
    echo "✅ 백엔드 서버 정상 작동 중"
else
    echo "⚠️  백엔드 서버 연결 실패 (시작 중일 수 있습니다)"
fi

# 프론트엔드 확인 (포트만 체크)
echo "   프론트엔드 서버 확인 중..."
if netstat -tuln 2>/dev/null | grep -q ":${FRONTEND_PORT}" || ss -tuln 2>/dev/null | grep -q ":${FRONTEND_PORT}"; then
    echo "✅ 프론트엔드 서버 포트 활성화"
else
    echo "⚠️  프론트엔드 서버 포트 비활성화 (시작 중일 수 있습니다)"
fi

echo ""
echo "🎉 시스템 시작 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 프론트엔드: http://localhost:${FRONTEND_PORT}"
echo "🔌 백엔드 API: http://localhost:${BACKEND_PORT}"
echo "💾 데이터베이스: ${PROJECT_ROOT}/backend/database/licenses.db"
echo "📁 업로드 디렉토리: ${PROJECT_ROOT}/backend/uploads"
echo "📄 로그 디렉토리: ${LOG_DIR}"
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
echo "📞 로그인 정보:"
echo "   🔐 비밀번호: 70998 (힌트: same with Door lock)"
echo "   👤 사용자명: admin"
echo ""
echo "📅 완료 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"