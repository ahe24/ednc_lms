#!/bin/bash

# 한국어 로케일 설정
export LANG=ko_KR.UTF-8
export LC_TIME=ko_KR.UTF-8
export TZ=Asia/Seoul

PROJECT_ROOT="/home/csjo/a3_claude/lms_ednc"
BACKUP_DIR="/backup/license-system"
DATE=$(date +%Y%m%d_%H%M%S)
DATE_KO=$(date '+%Y년 %m월 %d일 %H시 %M분')

echo "🗄️  EDNC License 관리 시스템 백업 시작"
echo "📅 백업 시간: ${DATE_KO}"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

echo "📂 백업 대상:"
echo "   - SQLite 데이터베이스: ${PROJECT_ROOT}/backend/database/licenses.db"
echo "   - 업로드된 파일: ${PROJECT_ROOT}/backend/uploads/"
echo "   - 환경 설정: ${PROJECT_ROOT}/.env.global"

# SQLite 데이터베이스 백업
DB_PATH="${PROJECT_ROOT}/backend/database/licenses.db"
if [ -f "${DB_PATH}" ]; then
    echo "💾 데이터베이스 백업 중..."
    if command -v sqlite3 &> /dev/null; then
        sqlite3 "${DB_PATH}" ".backup '${BACKUP_DIR}/licenses_${DATE}.db'"
        if [ $? -eq 0 ]; then
            echo "✅ 데이터베이스 백업 완료: licenses_${DATE}.db"
            BACKUP_SIZE=$(du -h "${BACKUP_DIR}/licenses_${DATE}.db" | cut -f1)
            echo "   파일 크기: ${BACKUP_SIZE}"
        else
            echo "❌ 데이터베이스 백업 실패"
        fi
    else
        # sqlite3가 없으면 단순 복사
        cp "${DB_PATH}" "${BACKUP_DIR}/licenses_${DATE}.db"
        echo "✅ 데이터베이스 파일 복사 완료: licenses_${DATE}.db"
    fi
else
    echo "⚠️  데이터베이스 파일을 찾을 수 없습니다: ${DB_PATH}"
fi

# 업로드된 파일 백업
UPLOAD_DIR="${PROJECT_ROOT}/backend/uploads"
if [ -d "${UPLOAD_DIR}" ]; then
    echo "📁 업로드 파일 백업 중..."
    tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C "${PROJECT_ROOT}/backend" uploads/
    if [ $? -eq 0 ]; then
        echo "✅ 업로드 파일 백업 완료: uploads_$DATE.tar.gz"
        UPLOAD_SIZE=$(du -h "${BACKUP_DIR}/uploads_${DATE}.tar.gz" | cut -f1)
        echo "   파일 크기: ${UPLOAD_SIZE}"
        FILE_COUNT=$(find "${UPLOAD_DIR}" -type f | wc -l)
        echo "   백업된 파일 개수: ${FILE_COUNT}개"
    else
        echo "❌ 업로드 파일 백업 실패"
    fi
else
    echo "⚠️  업로드 디렉토리를 찾을 수 없습니다: ${UPLOAD_DIR}"
fi

# 환경 설정 파일 백업
ENV_FILE="${PROJECT_ROOT}/.env.global"
if [ -f "${ENV_FILE}" ]; then
    echo "⚙️  환경 설정 파일 백업 중..."
    cp "${ENV_FILE}" "$BACKUP_DIR/env_global_$DATE.backup"
    if [ $? -eq 0 ]; then
        echo "✅ 환경 설정 백업 완료: env_global_$DATE.backup"
    else
        echo "❌ 환경 설정 백업 실패"
    fi
fi

# PM2 설정 백업
ECOSYSTEM_FILE="${PROJECT_ROOT}/ecosystem.config.js"
if [ -f "${ECOSYSTEM_FILE}" ]; then
    echo "🔧 PM2 설정 파일 백업 중..."
    cp "${ECOSYSTEM_FILE}" "$BACKUP_DIR/ecosystem_$DATE.backup"
    echo "✅ PM2 설정 백업 완료: ecosystem_$DATE.backup"
fi

# 백업 완료 후 정리 작업
echo ""
echo "🧹 이전 백업 파일 정리 중..."

# 7일 이상된 백업 파일 삭제
DELETED_DB=$(find $BACKUP_DIR -name "licenses_*.db" -mtime +7 -delete -print 2>/dev/null | wc -l)
DELETED_UPLOADS=$(find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete -print 2>/dev/null | wc -l)
DELETED_CONFIG=$(find $BACKUP_DIR -name "env_global_*.backup" -mtime +7 -delete -print 2>/dev/null | wc -l)
DELETED_ECOSYSTEM=$(find $BACKUP_DIR -name "ecosystem_*.backup" -mtime +7 -delete -print 2>/dev/null | wc -l)

TOTAL_DELETED=$((DELETED_DB + DELETED_UPLOADS + DELETED_CONFIG + DELETED_ECOSYSTEM))

if [ $TOTAL_DELETED -gt 0 ]; then
    echo "🗑️  ${TOTAL_DELETED}개의 오래된 백업 파일을 삭제했습니다"
    [ $DELETED_DB -gt 0 ] && echo "   - 데이터베이스: ${DELETED_DB}개"
    [ $DELETED_UPLOADS -gt 0 ] && echo "   - 업로드 파일: ${DELETED_UPLOADS}개"
    [ $DELETED_CONFIG -gt 0 ] && echo "   - 환경 설정: ${DELETED_CONFIG}개"
    [ $DELETED_ECOSYSTEM -gt 0 ] && echo "   - PM2 설정: ${DELETED_ECOSYSTEM}개"
else
    echo "🔍 삭제할 오래된 백업 파일이 없습니다"
fi

# 현재 백업 디렉토리 용량 확인
if command -v du &> /dev/null; then
    BACKUP_TOTAL_SIZE=$(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)
    BACKUP_FILE_COUNT=$(find $BACKUP_DIR -type f | wc -l)
else
    BACKUP_TOTAL_SIZE="확인 불가"
    BACKUP_FILE_COUNT="확인 불가"
fi

echo ""
echo "📊 백업 완료 요약:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 백업 일시: ${DATE_KO}"
echo "📂 백업 위치: ${BACKUP_DIR}"
echo "💾 전체 백업 크기: ${BACKUP_TOTAL_SIZE}"
echo "📄 총 백업 파일 수: ${BACKUP_FILE_COUNT}개"
echo "🔄 자동 정리: 7일 이상 된 파일 ${TOTAL_DELETED}개 삭제"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🎉 백업 작업이 성공적으로 완료되었습니다!"
echo "📅 완료 시간: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"