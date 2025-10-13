# 클라이언트 측 엑셀 처리 구현 가이드

## 📋 개요

Vercel 배포 환경에서 실시간 업로드 진행률을 표시하기 위한 클라이언트 측 처리 방식 구현 가이드입니다.

### 왜 클라이언트 측 처리인가?

**현재 문제:**
- 로컬: 백그라운드 job tracking으로 실시간 진행률 표시 ✅
- Vercel: serverless 함수가 응답 전까지 모든 처리 완료 → 진행률 표시 불가 ❌

**클라이언트 측 처리의 장점:**
- ✅ 복잡도 낮음 (2/10)
- ✅ 실행 시간 제한 없음
- ✅ 실시간 진행률 완벽 제어
- ✅ 서버 부하 최소화
- ✅ 추가 비용 0원
- ✅ 로컬과 배포판 동일한 UX

---

## 🏗️ 아키텍처 변경

### Before (서버 측 처리)
```
브라우저 → 엑셀 파일 업로드 → 서버
                              ↓
                        서버에서 파싱
                              ↓
                        주소 처리 (블로킹)
                              ↓
                        엑셀 생성
                              ↓
브라우저 ← 다운로드 ←────────────┘
```

### After (클라이언트 측 처리)
```
브라우저 → 엑셀 파일 읽기 (xlsx.js)
    ↓
주소 배열 추출
    ↓
50개씩 배치 생성
    ↓
API 호출 (배치 1) → 서버 (/api/address/batch)
진행률 업데이트 20%
    ↓
API 호출 (배치 2) → 서버
진행률 업데이트 40%
    ↓
... (반복)
    ↓
모든 응답 수신 완료
    ↓
브라우저에서 엑셀 생성 (xlsx.js)
    ↓
다운로드
```

---

## 📦 필요한 라이브러리

### 1. XLSX.js (클라이언트용)

이미 서버에서 사용 중이므로, 클라이언트에서도 사용합니다.

**CDN 방식 (간단):**
```html
<!-- public/index.html -->
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
```

**NPM 방식 (번들링):**
```bash
npm install xlsx
```

---

## 🔧 구현 단계

### 1단계: 백엔드 - 배치 API 엔드포인트 생성

#### `api/index.js` 또는 `backend/src/routes/address.js`

```javascript
// 배치 주소 검색 엔드포인트
app.post('/api/address/batch', async (req, res) => {
  try {
    const { addresses } = req.body; // 주소 배열

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: '주소 배열이 필요합니다.'
      });
    }

    // 최대 100개로 제한 (과부하 방지)
    if (addresses.length > 100) {
      return res.status(400).json({
        success: false,
        error: '한 번에 최대 100개까지 처리 가능합니다.'
      });
    }

    const axios = require('axios');
    const results = [];

    // 각 주소 처리
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];

      if (!address || typeof address !== 'string') {
        results.push({
          index: i,
          originalAddress: address,
          success: false,
          error: '유효하지 않은 주소'
        });
        continue;
      }

      try {
        // JUSO API 호출
        const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
          params: {
            confmKey: process.env.JUSO_API_KEY,
            currentPage: 1,
            countPerPage: 1,
            keyword: address,
            resultType: 'json'
          },
          timeout: 5000
        });

        const apiResults = response.data?.results;
        const common = apiResults?.common;

        if (common?.errorCode === '0' && apiResults.juso?.[0]) {
          const juso = apiResults.juso[0];
          results.push({
            index: i,
            originalAddress: address,
            success: true,
            postalCode: juso.zipNo || '',
            fullAddress: juso.roadAddr || juso.jibunAddr || '',
            sido: juso.siNm || '',
            sigungu: juso.sggNm || ''
          });
        } else {
          results.push({
            index: i,
            originalAddress: address,
            success: false,
            error: '우편번호를 찾을 수 없습니다'
          });
        }
      } catch (apiError) {
        results.push({
          index: i,
          originalAddress: address,
          success: false,
          error: 'API 호출 실패: ' + apiError.message
        });
      }

      // API 호출 제한 (50ms 대기)
      if (i < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    res.json({
      success: true,
      data: {
        total: addresses.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      }
    });

  } catch (error) {
    console.error('Batch address search error:', error);
    res.status(500).json({
      success: false,
      error: '배치 처리 중 오류가 발생했습니다.'
    });
  }
});
```

---

### 2단계: 프론트엔드 - 클라이언트 측 엑셀 처리

#### `public/app.js` 수정

```javascript
// XLSX 라이브러리가 로드되었는지 확인
function ensureXLSX() {
  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX 라이브러리가 로드되지 않았습니다.');
  }
}

// 클라이언트 측 엑셀 파일 처리
async function uploadFileClientSide(file) {
  const progressDiv = document.getElementById('uploadProgress');
  const resultDiv = document.getElementById('uploadResult');

  // 파일 검증
  if (!file.name.match(/\.(xls|xlsx)$/i)) {
    showResult(resultDiv, '❌ 엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showResult(resultDiv, '❌ 파일 크기는 10MB 이하여야 합니다.', 'error');
    return;
  }

  try {
    ensureXLSX();

    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');

    // 1단계: 파일 읽기 (10%)
    updateProgressCard('upload', {
      progress: 10,
      steps: cloneProgressSteps('upload')
    }, '파일 읽는 중...');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
      throw new Error('엑셀 파일이 비어있습니다.');
    }

    // 2단계: 데이터 파싱 (20%)
    updateProgressCard('upload', {
      progress: 20,
      steps: cloneProgressSteps('dedupe')
    }, '데이터 파싱 중...');

    const headers = jsonData[0] || [];
    const rows = jsonData.slice(1);

    // 주소 컬럼 찾기
    const addressColumnIndex = headers.findIndex(header =>
      typeof header === 'string' &&
      (header.includes('주소') || header.includes('address') || header.includes('addr'))
    );

    if (addressColumnIndex === -1) {
      throw new Error('주소 컬럼을 찾을 수 없습니다. 헤더에 "주소" 또는 "address"가 포함된 컬럼이 필요합니다.');
    }

    // 3단계: 중복 제거 (30%)
    updateProgressCard('upload', {
      progress: 30,
      steps: cloneProgressSteps('dedupe')
    }, '중복 주소 제거 중...');

    const { uniqueRows, duplicatesRemoved } = removeDuplicateRows(rows, addressColumnIndex);

    // 주소 배열 추출
    const addresses = uniqueRows.map(row => row[addressColumnIndex]).filter(addr => addr);

    if (addresses.length === 0) {
      throw new Error('처리할 주소가 없습니다.');
    }

    // 4단계: 배치 처리 (30% → 90%)
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      batches.push(addresses.slice(i, i + BATCH_SIZE));
    }

    const allResults = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchProgress = 30 + Math.round((i / batches.length) * 60);

      updateProgressCard('upload', {
        progress: batchProgress,
        processed: i * BATCH_SIZE,
        total: addresses.length,
        steps: cloneProgressSteps('lookup')
      }, `주소 검색 중... (${i + 1}/${batches.length} 배치)`);

      try {
        const response = await fetch(`${API_BASE}/address/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: batch })
        });

        const data = await response.json();

        if (data.success) {
          allResults.push(...data.data.results);
        } else {
          throw new Error(data.error || '배치 처리 실패');
        }
      } catch (batchError) {
        console.error(`배치 ${i + 1} 처리 오류:`, batchError);
        // 오류 발생 시 빈 결과 추가
        batch.forEach((addr, idx) => {
          allResults.push({
            index: i * BATCH_SIZE + idx,
            originalAddress: addr,
            success: false,
            error: batchError.message
          });
        });
      }

      // 배치 간 딜레이 (서버 부하 방지)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 5단계: 엑셀 생성 (95%)
    updateProgressCard('upload', {
      progress: 95,
      steps: cloneProgressSteps('export')
    }, '엑셀 파일 생성 중...');

    const resultWorkbook = createResultWorkbook(headers, uniqueRows, allResults, addressColumnIndex);

    // 6단계: 다운로드 (100%)
    updateProgressCard('upload', {
      progress: 100,
      steps: cloneProgressSteps('export')
    }, '처리 완료!');

    // 엑셀 파일 다운로드
    const wbout = XLSX.write(resultWorkbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postal_result_${new Date().getTime()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 결과 표시
    setTimeout(() => {
      progressDiv.classList.add('hidden');
      const successCount = allResults.filter(r => r.success).length;
      const failCount = allResults.filter(r => !r.success).length;

      showResult(resultDiv, `
        <h3>✅ 처리가 완료되었습니다!</h3>
        <p><strong>원본 행:</strong> ${rows.length}개</p>
        <p><strong>중복 제거:</strong> ${duplicatesRemoved}개</p>
        <p><strong>처리된 행:</strong> ${uniqueRows.length}개</p>
        <p><strong>성공:</strong> ${successCount}개 | <strong>실패:</strong> ${failCount}개</p>
        <div style="margin-top:12px">
          <button class="btn" data-reset-upload>↩️ 초기화</button>
        </div>
      `, 'success');
    }, 500);

  } catch (error) {
    console.error('클라이언트 측 처리 오류:', error);
    progressDiv.classList.add('hidden');
    showResult(resultDiv, `
      ❌ 파일 처리 중 오류가 발생했습니다: ${error.message}
      <div style="margin-top:12px">
        <button class="btn" data-reset-upload>↩️ 초기화</button>
      </div>
    `, 'error');
  }
}

// 중복 제거 함수
function removeDuplicateRows(rows, addressColumnIndex) {
  const seen = new Set();
  const uniqueRows = [];
  let duplicatesRemoved = 0;

  rows.forEach((row) => {
    const address = row[addressColumnIndex];
    if (!address) return;

    // 주소 정규화
    const normalizedAddress = String(address)
      .replace(/\s+/g, '')
      .replace(/[(),\-\.]/g, '')
      .toLowerCase();

    if (!seen.has(normalizedAddress)) {
      seen.add(normalizedAddress);
      uniqueRows.push(row);
    } else {
      duplicatesRemoved++;
    }
  });

  return { uniqueRows, duplicatesRemoved };
}

// 결과 엑셀 생성
function createResultWorkbook(headers, rows, results, addressColumnIndex) {
  // 기존 컬럼 확인
  const existingColumns = headers.map(h => String(h).toLowerCase());
  const hasPostalCode = existingColumns.some(col =>
    col.includes('우편번호') || col.includes('postal') || col.includes('zip')
  );
  const hasFullAddress = existingColumns.some(col =>
    col.includes('전체주소') || col.includes('full') || col.includes('road') || col.includes('도로명주소')
  );
  const hasSido = existingColumns.some(col =>
    col.includes('시도') || col.includes('시/도') || col.includes('sido')
  );
  const hasSigungu = existingColumns.some(col =>
    col.includes('시군구') || col.includes('시/군/구') || col.includes('sigungu')
  );

  // 새 헤더
  const newHeaders = [...headers];
  if (!hasPostalCode) newHeaders.push('우편번호');
  if (!hasFullAddress) newHeaders.push('도로명주소');
  if (!hasSido) newHeaders.push('시도');
  if (!hasSigungu) newHeaders.push('시군구');

  // 데이터 생성
  const resultData = [newHeaders];

  rows.forEach((row, index) => {
    const result = results.find(r => r.index === index);
    const newRow = [...row];

    // 헤더와 길이 맞추기
    while (newRow.length < headers.length) {
      newRow.push('');
    }

    // 결과 추가
    if (result && result.success) {
      if (!hasPostalCode) newRow.push(result.postalCode || '');
      if (!hasFullAddress) newRow.push(result.fullAddress || '');
      if (!hasSido) newRow.push(result.sido || '');
      if (!hasSigungu) newRow.push(result.sigungu || '');
    } else {
      if (!hasPostalCode) newRow.push('');
      if (!hasFullAddress) newRow.push('');
      if (!hasSido) newRow.push('');
      if (!hasSigungu) newRow.push('');
    }

    resultData.push(newRow);
  });

  // 워크북 생성
  const ws = XLSX.utils.aoa_to_sheet(resultData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');

  return wb;
}

// 기존 uploadFile 함수를 클라이언트 측으로 교체
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    // 클라이언트 측 처리 사용
    uploadFileClientSide(file);
  }
}
```

---

### 3단계: HTML에 XLSX 라이브러리 추가

#### `public/index.html` (또는 `frontend/public/index.html`)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>우편번호 자동 입력</title>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="label-print.css">
</head>
<body>
  <!-- 기존 HTML 내용 -->

  <!-- XLSX 라이브러리 추가 (app.js 전에 로드) -->
  <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>

  <!-- 기존 app.js -->
  <script src="app.js"></script>
</body>
</html>
```

---

## 🧪 테스트 시나리오

### 1. 소량 데이터 (10건)
```
예상 시간: 5-10초
진행률: 10% → 20% → 30% → 50% → 95% → 100%
```

### 2. 중량 데이터 (100건)
```
예상 시간: 30-60초
진행률: 실시간으로 부드럽게 증가
배치: 2개 (50건씩)
```

### 3. 대량 데이터 (500건)
```
예상 시간: 2-3분
진행률: 실시간으로 부드럽게 증가
배치: 10개 (50건씩)
```

### 4. 오류 시나리오
- 잘못된 주소: 개별 행 실패, 나머지는 계속 처리
- 네트워크 오류: 배치 실패 시 빈 값으로 처리, 다음 배치 계속
- 파일 형식 오류: 즉시 오류 메시지 표시

---

## 📊 성능 최적화

### 1. 배치 크기 조정

```javascript
// 네트워크 속도에 따라 조정
const BATCH_SIZE = 50; // 기본값

// 빠른 네트워크: 100
// 느린 네트워크: 25
```

### 2. API 호출 딜레이

```javascript
// 서버 부하 방지
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 딜레이
```

### 3. 메모리 최적화

대용량 파일 처리 시:
```javascript
// 스트리밍 방식으로 변경 (선택사항)
const readStream = file.stream();
const reader = readStream.getReader();
// ... chunk 단위로 처리
```

---

## 🔄 마이그레이션 계획

### Phase 1: 백엔드 준비 (1시간)
1. `/api/address/batch` 엔드포인트 구현
2. 로컬에서 테스트
3. Vercel에 배포

### Phase 2: 프론트엔드 구현 (2-3시간)
1. XLSX 라이브러리 추가
2. `uploadFileClientSide` 함수 구현
3. 헬퍼 함수들 구현 (중복 제거, 엑셀 생성)

### Phase 3: 통합 테스트 (1시간)
1. 로컬 환경 테스트
2. Vercel 배포 환경 테스트
3. 다양한 파일 크기로 테스트

### Phase 4: 배포 (30분)
1. 최종 검증
2. 프로덕션 배포
3. 모니터링

**총 예상 시간: 4-5시간**

---

## ⚠️ 주의사항

### 1. 브라우저 호환성

XLSX.js는 대부분의 모던 브라우저를 지원하지만, IE는 미지원입니다.

### 2. 파일 크기 제한

클라이언트 측 처리는 브라우저 메모리를 사용하므로:
- 권장: 10MB 이하, 1000행 이하
- 최대: 50MB, 5000행

### 3. API 제한

JUSO API는 초당 10건 제한이 있으므로:
- 배치 크기: 50건
- 배치 간 딜레이: 100ms

### 4. 에러 핸들링

개별 주소 실패 시에도 전체 처리를 중단하지 않고 계속 진행합니다.

---

## 🎯 기대 효과

### 사용자 경험
- ✅ 실시간 진행률 표시
- ✅ 로컬과 배포판 동일한 UX
- ✅ 빠른 처리 속도 (배치 병렬 처리)

### 개발 효율
- ✅ 서버 부하 감소
- ✅ Vercel 실행 시간 제한 우회
- ✅ 확장 가능한 아키텍처

### 비용 절감
- ✅ 추가 인프라 불필요
- ✅ serverless 함수 실행 시간 감소
- ✅ 외부 저장소 불필요

---

## 📚 참고 자료

- [XLSX.js 공식 문서](https://docs.sheetjs.com/)
- [Vercel Serverless Functions 제한](https://vercel.com/docs/functions/serverless-functions/runtimes#limits)
- [JUSO API 문서](https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do)

---

## 🆘 트러블슈팅

### Q1: XLSX is not defined 오류
```javascript
// HTML에서 XLSX 라이브러리가 app.js보다 먼저 로드되었는지 확인
// CDN이 차단되었는지 확인 (CSP 정책)
```

### Q2: 진행률이 업데이트되지 않음
```javascript
// updateProgressCard 함수 호출 확인
// DOM 요소 ID 확인 (progressFill, progressText)
```

### Q3: 배치 처리가 너무 느림
```javascript
// BATCH_SIZE 증가 (50 → 100)
// 배치 간 딜레이 감소 (100ms → 50ms)
```

### Q4: 메모리 부족 오류
```javascript
// 파일 크기 제한 강화
// 배치 처리 후 메모리 해제 (results = null)
```

---

## ✅ 체크리스트

구현 전 확인사항:
- [ ] XLSX.js 라이브러리 추가
- [ ] `/api/address/batch` 엔드포인트 구현
- [ ] 기존 코드 백업
- [ ] 로컬 환경 테스트

구현 후 확인사항:
- [ ] 진행률 표시 작동 확인
- [ ] 다운로드 파일 정상 확인
- [ ] 오류 처리 확인
- [ ] Vercel 배포 환경 테스트
- [ ] 성능 측정 (100건 기준 1분 이내)

---

**작성일:** 2025-01-12
**버전:** 1.0
**작성자:** Claude Code Assistant
