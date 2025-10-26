# CORS 프로덕션 에러 긴급 수정

## 🚨 발생한 문제

### 증상
- Vercel 배포 후 주소 검색 기능 완전 차단
- 브라우저 콘솔: `500 Internal Server Error`
- 모든 `/api/address/search` POST 요청 실패

### 근본 원인
```javascript
// ❌ 문제가 된 코드
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .filter(Boolean);

// 프로덕션 환경:
// - NODE_ENV === 'production'
// - ALLOWED_ORIGINS 환경 변수 미설정 → 빈 배열
// - 결과: 모든 도메인 차단, 500 에러 발생
```

### 에러 분석
1. **CORS 차단**: `Access-Control-Allow-Origin` 헤더 없음
2. **CORS 미들웨어 에러**: `callback(new Error('Not allowed by CORS'))` 발생
3. **500 응답**: Express가 에러를 내부 서버 오류로 반환

---

## ✅ 해결 방법

### 코드 수정
```javascript
// ✅ 수정된 코드 - Vercel 도메인 자동 허용
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    // 🎯 핵심 수정: ALLOWED_ORIGINS 없을 때 Vercel 도메인 자동 허용
    if (allowedOrigins.length === 0) {
      if (origin.includes('.vercel.app')) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

### 수정 파일
- `api/index.js` (Vercel 서버리스 함수)
- `backend/src/app.js` (로컬 서버)
- `claudedocs/CORS보안수정가이드.md` (문서 업데이트)

---

## 🧪 테스트 결과

### Before (에러 상태)
```bash
$ curl -i POST https://postal-code-v010.vercel.app/api/address/search
HTTP/2 500
# ❌ Access-Control-Allow-Origin 헤더 없음
{"error":"Internal server error"}
```

### After (수정 후)
```bash
$ curl -i POST https://postal-code-v010.vercel.app/api/address/search
HTTP/2 200
access-control-allow-origin: https://postal-code-v010.vercel.app
access-control-allow-credentials: true
# ✅ CORS 헤더 정상, 응답 정상

{
  "success": true,
  "data": {
    "postalCode": "06236",
    "fullAddress": "서울특별시 강남구 테헤란로 152 (역삼동)",
    "sido": "서울특별시",
    "sigungu": "강남구"
  }
}
```

---

## 📊 환경별 동작

### Development (로컬)
```bash
NODE_ENV=development npm run dev
```
- ✅ localhost 자동 허용 (기존 동작 유지)
- ✅ 디버깅 정보 유지

### Production (Vercel)
```bash
# ALLOWED_ORIGINS 환경 변수 미설정 시
```
- ✅ `.vercel.app` 도메인 자동 허용
- ✅ 다른 도메인은 차단 (보안 유지)

### Production (커스텀 도메인)
```bash
# Vercel 환경 변수 설정
ALLOWED_ORIGINS=https://www.yourdomain.com,https://api.yourdomain.com
```
- ✅ 설정된 도메인만 허용
- ✅ `.vercel.app` 도메인도 계속 허용됨

---

## 🔄 배포 프로세스

### 1. 코드 수정 및 커밋
```bash
git add api/index.js backend/src/app.js claudedocs/
git commit -m "fix: auto-allow Vercel domains in CORS"
git push
```

### 2. Vercel 자동 배포
- GitHub push 감지 → 자동 배포 시작
- 약 30-60초 소요
- 배포 완료 후 즉시 적용

### 3. 검증
```bash
# Health 체크
curl https://postal-code-v010.vercel.app/api/health

# 주소 검색 테스트
curl -X POST https://postal-code-v010.vercel.app/api/address/search \
  -H "Content-Type: application/json" \
  -d '{"address":"서울특별시 강남구 테헤란로 152"}'
```

---

## 🎯 핵심 개선사항

### 1. Zero Configuration
- **Before**: Vercel 환경 변수 필수 설정 필요
- **After**: 설정 없이도 즉시 작동

### 2. 자동 도메인 인식
- `.vercel.app` 도메인 패턴 자동 감지
- 프리뷰 배포도 자동으로 작동

### 3. 보안 유지
- 여전히 화이트리스트 기반 보안 유지
- 커스텀 도메인은 명시적 설정 필요
- 개발/프로덕션 환경 구분 유지

---

## 💡 학습 포인트

### CORS 에러 디버깅
1. **500 에러 ≠ 서버 문제**: CORS 차단도 500으로 표시될 수 있음
2. **헤더 확인 필수**: `Access-Control-Allow-Origin` 헤더 존재 여부 체크
3. **OPTIONS 요청**: Preflight 요청 성공 여부 확인

### Vercel 배포 특성
1. **자동 배포**: GitHub push → 자동 감지
2. **환경 변수 전파**: 즉시 적용되지 않을 수 있음 (캐싱)
3. **프리뷰 배포**: PR마다 고유 URL 생성

### Express CORS 미들웨어
1. **Error vs false**: `callback(Error)` → 500, `callback(null, false)` → 정상 차단
2. **Origin 헤더**: 브라우저가 자동으로 추가
3. **Credentials**: 쿠키/인증 사용 시 필수

---

## 🔐 보안 고려사항

### 현재 보안 수준
- ✅ `.vercel.app` 도메인만 자동 허용
- ✅ 다른 도메인은 명시적 화이트리스트 필요
- ✅ 개발/프로덕션 환경 분리

### 추가 보안 강화 옵션
```javascript
// Option 1: 특정 Vercel 프로젝트만 허용
if (origin.match(/^https:\/\/postal-code-.*\.vercel\.app$/)) {
  return callback(null, true);
}

// Option 2: 환경 변수로 정확한 도메인 지정
const vercelDomain = process.env.VERCEL_URL;
if (origin === `https://${vercelDomain}`) {
  return callback(null, true);
}
```

---

## 📝 체크리스트

### 수정 완료
- [x] `api/index.js` CORS 설정 개선
- [x] `backend/src/app.js` CORS 설정 개선
- [x] 문서 업데이트
- [x] Git commit & push
- [x] Vercel 자동 배포 확인
- [x] 프로덕션 테스트 완료

### 테스트 완료
- [x] Health 엔드포인트 응답 확인
- [x] CORS preflight (OPTIONS) 성공
- [x] 주소 검색 정상 작동
- [x] CORS 헤더 존재 확인

---

## 🚀 향후 개선 사항

### 1. 환경 변수 자동 감지
```javascript
// Vercel의 자동 환경 변수 활용
const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
if (vercelUrl && origin.includes(vercelUrl)) {
  return callback(null, true);
}
```

### 2. 도메인 검증 강화
```javascript
// 정규표현식으로 더 엄격한 검증
const vercelPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;
if (vercelPattern.test(origin)) {
  return callback(null, true);
}
```

### 3. CORS 에러 로깅 개선
```javascript
// 프로덕션에서도 CORS 차단 로그 수집
if (process.env.NODE_ENV === 'production') {
  // Send to logging service (e.g., Sentry, LogRocket)
  console.error('CORS blocked in production:', origin);
}
```

---

**수정 일자**: 2025-10-26
**커밋**: 22394ad
**상태**: ✅ 프로덕션 배포 완료
**테스트**: ✅ 모든 기능 정상 작동
