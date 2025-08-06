#!/bin/bash

# 한국어 로케일 설정
export LANG=ko_KR.UTF-8
export LC_TIME=ko_KR.UTF-8
export TZ=Asia/Seoul

echo "📦 의존성 설치 시작..."
PROJECT_ROOT="/home/csjo/a3_claude/lms_ednc"
cd "$PROJECT_ROOT" || exit 1

# npm 캐시 정리
echo "🧹 npm 캐시 정리 중..."
npm cache clean --force

# 백엔드 의존성 설치
echo "📦 백엔드 의존성 설치 중..."
cd backend
rm -rf node_modules package-lock.json
npm install

if [ $? -eq 0 ]; then
    echo "✅ 백엔드 의존성 설치 완료"
else
    echo "❌ 백엔드 의존성 설치 실패"
    exit 1
fi

# 프론트엔드 의존성 설치
echo "📦 프론트엔드 의존성 설치 중..."
cd ../frontend
rm -rf node_modules package-lock.json
npm install

if [ $? -eq 0 ]; then
    echo "✅ 프론트엔드 의존성 설치 완료"
else
    echo "❌ 프론트엔드 의존성 설치 실패"
    exit 1
fi

echo "🎉 모든 의존성 설치 완료!"