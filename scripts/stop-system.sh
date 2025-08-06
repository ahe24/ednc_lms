#!/bin/bash

# 한국어 로케일 설정
export LANG=ko_KR.UTF-8
export LC_TIME=ko_KR.UTF-8
export TZ=Asia/Seoul

echo "🛑 EDNC License 관리 시스템 중지 중..."
echo "📅 중지 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"

# 현재 상태 확인
echo "📊 현재 프로세스 상태:"
pm2 status | grep -E "(license-frontend|license-backend)" || echo "   관련 프로세스가 실행 중이지 않습니다."

# 프로세스 중지
echo "⏹️  프로세스 중지 중..."
pm2 stop license-frontend license-backend 2>/dev/null || echo "   중지할 프로세스가 없습니다."

# 프로세스 삭제
echo "🗑️  프로세스 삭제 중..."
pm2 delete license-frontend license-backend 2>/dev/null || echo "   삭제할 프로세스가 없습니다."

# 최종 상태 확인
echo "📋 최종 상태 확인:"
pm2 status

echo ""
echo "✅ 시스템 중지 완료!"
echo "📅 완료 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"