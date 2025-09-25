# E2E 테스트 가이드

## Playwright E2E 테스트 설정 완료

### 테스트 구성
- **address-search.spec.js**: 주소 검색 기능 테스트
- **excel-upload.spec.js**: 엑셀 파일 업로드 기능 테스트
- **label-generation.spec.js**: 라벨 생성 및 HWPX 다운로드 테스트
- **ui-navigation.spec.js**: UI 네비게이션 및 반응형 디자인 테스트

### 실행 명령어

```bash
# 모든 테스트 실행
npm test

# UI 모드로 테스트 실행
npm run test:ui

# 브라우저를 보면서 테스트 실행
npm run test:headed

# 디버그 모드로 테스트 실행
npm run test:debug

# 특정 브라우저에서만 테스트 실행
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# 특정 테스트 파일만 실행
npx playwright test tests/address-search.spec.js
```

### 테스트 결과
- **주소 검색**: ✅ 정상 작동 (서울시청 주소로 우편번호 검색 성공)
- **UI 네비게이션**: ✅ 탭 전환 및 반응형 디자인 테스트 통과
- **파일 업로드**: ⚠️ 테스트 파일 존재 시에만 실행
- **라벨 생성**: ⚠️ 샘플 데이터 로드 후 라벨 생성 가능

### 주의사항
1. 테스트 실행 전 백엔드 서버가 포트 3005에서 실행 중이어야 함
2. `backend/.env` 파일에 `JUSO_API_KEY` 설정 필요
3. 일부 테스트는 실제 API 응답에 의존하므로 인터넷 연결 필요
4. 로컬 환경에서는 배포 정보 테스트가 스킵될 수 있음

### 테스트 커버리지
- ✅ 페이지 로드 및 기본 UI 요소 확인
- ✅ 주소 검색 API 호출 및 결과 표시
- ✅ 탭 전환 기능
- ✅ 반응형 디자인 (데스크톱, 태블릿, 모바일)
- ✅ 샘플 데이터를 이용한 라벨 생성
- ⚠️ 실제 엑셀 파일 업로드 (테스트 파일 필요)
- ⚠️ HWPX/PDF 다운로드 (브라우저 설정 의존)

### 개선 사항
1. 테스트용 샘플 엑셀 파일 추가
2. API 모킹을 통한 네트워크 의존성 제거
3. 다운로드 테스트 개선
4. 에러 상황 테스트 케이스 추가