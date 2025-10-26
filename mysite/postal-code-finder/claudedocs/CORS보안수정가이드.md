# CORS 보안 수정 가이드

## ✅ 수정 완료 내역

### 수정된 파일
1. `api/index.js` - Vercel 서버리스 CORS 설정
2. `backend/src/app.js` - 로컬 서버 CORS 설정
3. `.env.example` - 환경 변수 예시 추가

---

## 🔒 변경 사항

### Before (위험)
```javascript
app.use(cors({
  origin: true,  // ❌ 모든 출처 허용
  credentials: true
}));
```

### After (안전)
```javascript
app.use(cors({
  origin: function (origin, callback) {
    // 환경 변수로 관리되는 허용 목록만 접근 가능
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## 📋 배포 전 설정 필요

### 1. Vercel 환경 변수 설정

Vercel Dashboard → 프로젝트 → Settings → Environment Variables

```bash
# 변수명
ALLOWED_ORIGINS

# 값 (실제 도메인으로 변경)
https://your-postal-app.vercel.app,https://www.yourdomain.com
```

### 2. 로컬 개발 환경 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집 (개발 환경에서는 비워둬도 됨)
ALLOWED_ORIGINS=
```

### 3. 프로덕션 도메인 확인

```bash
# Vercel 배포 후 실제 도메인 확인
vercel domains ls

# 예시 출력:
# - your-app.vercel.app
# - www.yourdomain.com
```

---

## 🧪 테스트 방법

### 1. 로컬 개발 환경 테스트

```bash
# 서버 시작
cd backend
npm run dev

# 다른 터미널에서 테스트
curl -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3001/api/address/search

# 예상 결과: Access-Control-Allow-Origin: http://localhost:3001
```

### 2. Vercel 프로덕션 테스트

```bash
# 허용된 출처에서 요청 (성공해야 함)
curl -H "Origin: https://your-app.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-api.vercel.app/api/address/search

# 예상 결과: Access-Control-Allow-Origin: https://your-app.vercel.app

# 허용되지 않은 출처에서 요청 (실패해야 함)
curl -H "Origin: https://evil-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-api.vercel.app/api/address/search

# 예상 결과: CORS error 또는 빈 응답
```

### 3. 브라우저 콘솔 테스트

```javascript
// 허용된 출처의 페이지에서 실행
fetch('https://your-api.vercel.app/api/health')
  .then(res => res.json())
  .then(data => console.log('Success:', data))
  .catch(err => console.error('Error:', err));

// 성공하면 OK
```

---

## ⚠️ 문제 해결

### 문제 1: CORS 에러 발생

```
Access to fetch at 'https://...' from origin 'https://...'
has been blocked by CORS policy
```

**해결방법**:
1. Vercel 환경 변수에 해당 도메인 추가
2. 환경 변수 형식 확인 (쉼표로 구분, 공백 없음)
3. Vercel 재배포

```bash
# Vercel CLI로 환경 변수 설정
vercel env add ALLOWED_ORIGINS production
# 입력: https://your-app.vercel.app,https://www.yourdomain.com

# 재배포
vercel --prod
```

### 문제 2: 로컬 개발 시 CORS 에러

**해결방법**:
```bash
# .env 파일 확인
NODE_ENV=development  # 이것이 설정되어 있어야 함

# 또는 ALLOWED_ORIGINS에 localhost 추가
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 문제 3: 모바일 앱에서 접근 불가

**해결방법**:
```javascript
// origin이 null인 경우도 허용하도록 이미 설정됨
if (!origin) return callback(null, true);
```

---

## 📊 보안 개선 효과

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 무단 API 사용 | ✅ 가능 | ❌ 차단 |
| 데이터 유출 위험 | 높음 | 낮음 |
| API 비용 통제 | 불가능 | 가능 |
| DDoS 위험 | 높음 | 중간 |

---

## 🔄 추가 보안 개선 권장사항

### 1. Rate Limiting 강화
```javascript
// 현재는 /api/ 경로만 제한
// 모든 엔드포인트에 적용 권장
```

### 2. API 키 검증
```javascript
// 프론트엔드에서 API 키 검증 헤더 추가
// X-API-Key: your-secret-key
```

### 3. IP 화이트리스트 (선택사항)
```javascript
// 특정 IP에서만 접근 허용
// Vercel Pro 이상 플랜에서 가능
```

---

## 📝 체크리스트

### 배포 전
- [ ] `.env.example` 파일 검토
- [ ] Vercel 환경 변수 설정
- [ ] 로컬 테스트 완료
- [ ] CORS 로직 이해

### 배포 후
- [ ] 프로덕션 CORS 동작 확인
- [ ] 허용되지 않은 출처 차단 확인
- [ ] 허용된 출처 정상 작동 확인
- [ ] 에러 로그 모니터링 설정

---

## 📞 추가 지원

CORS 관련 문제 발생 시:
1. Vercel 로그 확인: `vercel logs`
2. 브라우저 Network 탭에서 OPTIONS 요청 확인
3. `console.warn('CORS blocked: ...')` 메시지 확인

**수정 일자**: 2025-10-26
**다음 리뷰**: 배포 후 1주일 이내
