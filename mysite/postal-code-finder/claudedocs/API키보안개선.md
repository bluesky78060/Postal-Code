# API 키 보안 개선 가이드

## ✅ 적용된 보안 개선

### 수정 일자
2025-10-26

### 수정 파일
- `api/index.js` - Vercel 서버리스
- `backend/src/app.js` - 로컬 서버

---

## 🔒 보안 개선 내용

### 1. 헬스 체크 엔드포인트 (`/api/health`)

#### Before
```javascript
// ❌ 모든 환경에서 API 키 정보 노출
{
  "status": "OK",
  "env": {
    "JUSO_API_KEY": true,  // 프로덕션에서도 노출
    "NODE_ENV": "production"
  }
}
```

#### After
```javascript
// ✅ 개발 환경에서만 노출
{
  "status": "OK",
  "timestamp": "2025-10-26T10:26:43.435Z",
  // 프로덕션: env 필드 없음
  // 개발: env 필드 포함
  ...(process.env.NODE_ENV === 'development' && {
    env: { JUSO_API_KEY: !!process.env.JUSO_API_KEY }
  })
}
```

**효과**:
- ✅ 프로덕션: API 키 정보 완전 숨김
- ✅ 개발: 디버깅 정보 유지

---

### 2. 테스트 엔드포인트 (`/api/test`, `/api/test-juso`)

#### Before
```javascript
// ❌ 프로덕션에서도 접근 가능
app.get('/api/test', (req, res) => {
  res.json({
    JUSO_API_KEY: process.env.JUSO_API_KEY ? 'Set' : 'Not set'
  });
});
```

#### After
```javascript
// ✅ 프로덕션에서 완전 차단
app.get('/api/test', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  // 개발 환경에서만 실행
});
```

**효과**:
- ✅ 프로덕션: 404 에러 (엔드포인트 없음)
- ✅ 개발: 정상 작동
- ✅ 공격자가 테스트 엔드포인트 발견 불가

---

### 3. 상세 로깅 제어

#### Before
```javascript
// ❌ 모든 환경에서 상세 로그 출력
console.log('JUSO API Full Response:', JSON.stringify(response.data, null, 2));
// 수백 줄의 JSON 데이터 로그 → 민감 정보 포함 가능
```

#### After
```javascript
// ✅ 개발 환경에서만 요약 로그
if (process.env.NODE_ENV === 'development') {
  console.log('JUSO API Response:', {
    keyword: address,
    resultCount: response.data?.results?.juso?.length || 0,
    errorCode: response.data?.results?.common?.errorCode
  });
}
```

**효과**:
- ✅ 프로덕션: 로그 파일 크기 감소
- ✅ 민감 정보 로그 기록 방지
- ✅ 개발: 필요한 정보만 요약하여 출력

---

## 📋 환경별 동작

### Development (개발)
```bash
NODE_ENV=development npm run dev
```

**동작**:
- ✅ `/api/health` - API 키 상태 표시
- ✅ `/api/test` - 정상 작동
- ✅ `/api/test-juso` - 정상 작동
- ✅ 상세 로그 출력

### Production (프로덕션)
```bash
NODE_ENV=production npm start
# 또는 Vercel 자동 배포
```

**동작**:
- ✅ `/api/health` - 기본 정보만 표시
- ❌ `/api/test` - 404 에러
- ❌ `/api/test-juso` - 404 에러
- ❌ 상세 로그 없음

---

## 🧪 테스트 방법

### 1. 로컬 개발 환경
```bash
# 서버 시작
npm run dev

# 헬스 체크 (API 키 정보 표시됨)
curl http://localhost:3005/api/health

# 예상 결과:
{
  "status": "OK",
  "provider": "juso",
  "keys": {
    "juso": true
  }
}
```

### 2. 프로덕션 시뮬레이션
```bash
# 환경 변수 설정하여 실행
NODE_ENV=production node backend/src/app.js

# 헬스 체크 (API 키 정보 숨김)
curl http://localhost:3005/api/health

# 예상 결과:
{
  "status": "OK",
  "timestamp": "2025-10-26T10:26:47.953Z"
}

# 테스트 엔드포인트 (404)
curl http://localhost:3005/api/test
# 예상 결과: 404 Not found
```

### 3. Vercel 배포 후
```bash
# Vercel은 자동으로 NODE_ENV=production 설정
curl https://your-app.vercel.app/api/health

# API 키 정보 숨김 확인
curl https://your-app.vercel.app/api/test
# 404 에러 확인
```

---

## 🔐 보안 강화 효과

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| **헬스 체크 정보 노출** | 모든 환경 | 개발만 |
| **테스트 엔드포인트** | 공개 | 개발만 |
| **상세 로그** | 항상 출력 | 개발만 |
| **프로덕션 로그 크기** | 크다 | 작다 |
| **정보 수집 가능성** | 높음 | 낮음 |
| **디버깅 편의성** | 유지 | 유지 |

---

## 🎯 실용적 보안 원칙

### 균형잡힌 접근
```
보안 ←→ 개발 편의성
```

이번 개선은 두 가지를 모두 만족:
1. **프로덕션**: 정보 노출 최소화
2. **개발**: 디버깅 정보 유지

### API 키 상태 정보의 필요성
```
API 키 없음 → 서비스 불가
∴ 개발 환경에서는 API 키 상태 확인 필요
```

**결정**: 개발 환경에서만 노출하여 양쪽 요구사항 충족

---

## ⚠️ 주의사항

### Vercel 환경 변수 확인
```bash
# Vercel Dashboard에서 확인
NODE_ENV=production (자동 설정)
JUSO_API_KEY=your_key_here (수동 설정 필요)
```

### 로컬 개발 시
```bash
# .env 파일
NODE_ENV=development
JUSO_API_KEY=your_key_here
```

### 로그 모니터링
프로덕션에서 문제 발생 시:
```bash
# Vercel 로그 확인
vercel logs --follow

# 에러만 필터링
vercel logs | grep ERROR
```

---

## 📊 추가 개선 가능 항목

### 미래 개선 계획

1. **구조화된 로깅**
   ```javascript
   // Winston 또는 Pino 사용
   logger.info('address-search', { keyword, resultCount });
   ```

2. **로그 레벨 제어**
   ```javascript
   // 환경별 로그 레벨
   development: 'debug'
   production: 'error'
   ```

3. **민감 정보 자동 마스킹**
   ```javascript
   // 로그에서 자동으로 마스킹
   { apiKey: 'abc***xyz' }
   ```

---

## 🔄 체크리스트

### 배포 전
- [x] 개발 환경 테스트
- [x] 프로덕션 시뮬레이션
- [x] API 키 정보 숨김 확인
- [x] 테스트 엔드포인트 차단 확인

### 배포 후
- [ ] Vercel 헬스 체크 확인
- [ ] 테스트 엔드포인트 404 확인
- [ ] 로그 크기 모니터링
- [ ] 서비스 정상 작동 확인

---

## 📞 문제 해결

### Q1: 개발 환경에서도 API 키 정보가 안 보여요
```bash
# NODE_ENV 확인
echo $NODE_ENV

# 없거나 development가 아니면:
export NODE_ENV=development
npm run dev
```

### Q2: 프로덕션에서 디버깅이 필요해요
```bash
# 임시로 로그 활성화 (권장하지 않음)
NODE_ENV=development npm start

# 또는 별도 디버그 엔드포인트 추가 (인증 필요)
```

### Q3: Vercel에서 NODE_ENV가 production이 아니에요
```bash
# Vercel은 자동으로 설정하지만, 확인:
vercel env ls

# production 환경이 맞는지 확인
```

---

**수정 일자**: 2025-10-26
**다음 리뷰**: 2025-11-26
**관련 문서**: `claudedocs/코드분석보고서.md`, `claudedocs/CORS보안수정가이드.md`
