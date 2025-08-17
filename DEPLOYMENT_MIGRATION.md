# 프로덕션 서버 마이그레이션 가이드

이 문서는 기존 프로덕션 서버에서 새로운 다중 제품 지원 기능으로 안전하게 마이그레이션하는 방법을 설명합니다.

## 🚨 중요 사항

- **반드시 서비스 중단 시간에 실행하세요**
- **백업이 자동으로 생성되지만, 별도 백업도 권장합니다**
- **테스트 서버에서 먼저 검증하세요**

## 📋 마이그레이션 절차

### 1단계: 코드 배포

```bash
# 프로덕션 서버에서
cd /opt/license-management
git pull origin main

# 새로운 의존성이 있는 경우에만 실행 (현재 마이그레이션에서는 불필요)
# npm install
```

**참고**: 이번 마이그레이션은 기존 라이브러리만 사용하므로 `npm install`이 필요하지 않습니다.

### 2단계: 서비스 중지

```bash
pm2 stop license-backend
pm2 stop license-frontend
```

### 3단계: 데이터베이스 마이그레이션 실행

```bash
cd backend
node scripts/production-migration.js
```

**실행 결과 예시:**
```
🚀 시작: 프로덕션 데이터베이스 마이그레이션
📅 시작 시간: 2025년 08월 18일 09시 30분 15초
💾 1단계: 데이터베이스 백업 생성 중...
✅ 백업 완료: /opt/license-management/backend/database/backup/licenses_backup_20250818_093015.db
🔧 2단계: 새 테이블 구조 생성 중...
✅ 새 테이블 구조 생성 완료
📊 3단계: 기존 데이터 마이그레이션 중...
📝 마이그레이션할 라이선스: 25개
🔄 처리 중: woori_license_20250815.txt
  📦 4개 제품 발견
🔄 처리 중: samsung_license_20250810.txt
  📦 2개 제품 발견
...
✅ 기존 데이터 마이그레이션 완료
🔍 4단계: 마이그레이션 검증 중...
📊 마이그레이션 결과:
  - 총 라이선스: 45개
  - 총 제품: 78개  
  - 연결된 기능: 850개
  - 미연결 기능: 0개
✅ 모든 기능이 제품에 올바르게 연결되었습니다
🎉 프로덕션 마이그레이션 완료!
📅 완료 시간: 2025년 08월 18일 09시 35분 42초
```

### 4단계: 서비스 재시작

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 5단계: 동작 확인

```bash
# API 테스트
curl -H "Authorization: Bearer <토큰>" http://localhost:3601/api/licenses/products

# 웹 인터페이스 확인
# http://your-server:3600 접속하여 제품별 표시 확인
```

## 🔄 롤백 방법

마이그레이션에 문제가 발생한 경우:

### 방법 1: 자동 백업에서 복원

```bash
cd backend
node scripts/restore-backup.js
```

### 방법 2: 수동 백업에서 복원

```bash
cd backend
node scripts/restore-backup.js licenses_backup_20250818_093015.db
```

### 방법 3: 서비스 롤백

```bash
git checkout previous-version
pm2 restart all
```

## 📊 마이그레이션 효과

### Before (기존 방식):
- woori_license.txt → **1개 라이선스** (xDX Designer, 30개 기능)

### After (새로운 방식):
- woori_license.txt → **4개 라이선스**:
  1. HDL Designer Ap SW (1개 기능)
  2. xDX Designer 040 Ap SW (13개 기능)
  3. PADS LS Suite Ap SW (7개 기능)  
  4. Questa Core VHDL LEGACY Ap SW (9개 기능)

## 🔍 문제 해결

### 마이그레이션 실패 시

1. **백업 확인**
   ```bash
   ls -la backend/database/backup/
   ```

2. **로그 확인**
   ```bash
   pm2 logs license-backend
   ```

3. **데이터베이스 상태 확인**
   ```bash
   sqlite3 backend/database/licenses.db ".tables"
   sqlite3 backend/database/licenses.db "SELECT COUNT(*) FROM products;"
   ```

### 일반적인 문제들

- **"no such table: products"** → 마이그레이션 스크립트 재실행
- **"constraint failed"** → 백업에서 복원 후 다시 시도
- **원본 파일 없음** → 기존 데이터로 단일 제품 생성 (정상 동작)

## 📞 지원

문제 발생 시:
1. 서비스를 즉시 중지
2. 백업에서 복원
3. 로그 파일 수집
4. 개발팀에 연락

---

**⚠️ 주의사항**: 마이그레이션은 되돌릴 수 없는 변경을 포함합니다. 반드시 백업을 확인하고 테스트 환경에서 먼저 검증하세요.