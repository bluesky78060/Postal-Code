# 우편번호 자동 입력 시스템

엑셀 파일에서 주소를 읽어 자동으로 우편번호를 추가해주는 웹 애플리케이션입니다.

## 🚀 주요 기능

- **단일 주소 검색**: 주소 입력 시 실시간 우편번호 검색
- **엑셀 파일 처리**: 엑셀 파일 업로드 후 주소 컬럼에 우편번호 자동 추가
- **중복 데이터 제거**: 엑셀 업로드 시 중복된 주소 데이터 자동 제거
- **라벨 출력**: A4 용지에 2열 9행 라벨 출력 (100x30mm, 간격 없음)
- **실시간 진행률**: 파일 처리 진행 상황 실시간 확인
- **주소 자동완성**: 입력 중 주소 추천
- **배치 처리**: 여러 주소 한번에 처리

## 📁 프로젝트 구조

```
postal-code-finder/
├── backend/              # Node.js 백엔드
│   ├── src/
│   │   ├── controllers/  # API 컨트롤러
│   │   ├── routes/       # 라우트 정의
│   │   ├── services/     # 비즈니스 로직
│   │   ├── middleware/   # 미들웨어
│   │   ├── utils/        # 유틸리티 함수
│   │   └── app.js        # 메인 앱
│   ├── package.json
│   └── .env              # 환경 변수
├── frontend/             # 프론트엔드 파일
│   └── public/           # 정적 파일 (HTML, CSS, JS)
├── USB-Release/          # USB 배포용 파일
├── build-usb.bat         # USB 빌드 스크립트
├── start-windows.bat     # Windows 실행 스크립트
└── USB-실행방법.bat     # USB 실행 가이드
```

## 🛠️ 설치 및 실행

### 1. 백엔드 설정

```bash
cd backend
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음과 같이 설정하세요:

```bash
# Juso(도로명주소) API 키 (권장)
JUSO_API_KEY=YOUR_JUSO_CONF_KEY

# 서버 포트 설정
PORT=3005

# 프론트엔드 URL
FRONTEND_URL=http://localhost:3005
```

### 3. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

서버는 `http://localhost:3005`에서 실행됩니다.

## 🔑 Juso API 키 발급

1. [주소정보누리집](https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do) 접속
2. 회원가입 또는 로그인
3. "도로명주소 API 신청" 클릭
4. 신청서 작성 및 제출
5. 승인 완료 후 발급받은 인증키 확인
6. `.env` 파일의 `JUSO_API_KEY`에 키 입력

## 📡 API 엔드포인트

### 주소 검색
- `POST /api/address/search` - 단일 주소 검색
- `GET /api/address/autocomplete` - 주소 자동완성
- `GET /api/address/postal/:postalCode` - 우편번호로 주소 검색
- `POST /api/address/batch` - 배치 주소 검색

### 파일 처리
- `POST /api/file/upload` - 엑셀 파일 업로드
- `GET /api/file/status/:jobId` - 처리 상태 확인
- `GET /api/file/download/:fileId` - 처리된 파일 다운로드
- `GET /api/file/list` - 파일 목록 조회
- `DELETE /api/file/:fileId` - 파일 삭제

### 시스템
- `GET /api/health` - 서버 상태 확인

## 📋 사용 방법

### 1. 단일 주소 검색

```bash
curl -X POST http://localhost:3005/api/address/search \
  -H "Content-Type: application/json" \
  -d '{"address":"서울특별시 강남구 테헤란로 123"}'
```

### 2. 엑셀 파일 업로드

```bash
curl -X POST http://localhost:3005/api/file/upload \
  -F "file=@your-file.xlsx"
```

### 3. 처리 상태 확인

```bash
curl http://localhost:3005/api/file/status/job_1234567890_abc
```

## 📝 엑셀 파일 형식

- **지원 형식**: .xls, .xlsx
- **최대 크기**: 10MB
- **주소 컬럼명**: '주소', '주소지', 'address', 'addr' 등
- **최대 행 수**: 500개

### 예시 엑셀 구조

| 이름 | 주소 | 전화번호 |
|------|------|----------|
| 홍길동 | 서울특별시 강남구 테헤란로 123 | 010-1234-5678 |
| 김철수 | 부산광역시 해운대구 센텀로 456 | 010-9876-5432 |

처리 후:

| 이름 | 주소 | 전화번호 | 우편번호 |
|------|------|----------|----------|
| 홍길동 | 서울특별시 강남구 테헤란로 123 | 010-1234-5678 | 06159 |
| 김철수 | 부산광역시 해운대구 센텀로 456 | 010-9876-5432 | 48058 |

## 🏷️ 라벨 출력 기능

- **A4 용지**: 2열 9행 라벨 레이아웃
- **라벨 크기**: 100mm × 30mm (라벨 간 간격 없음)
- **출력 형식**: 오른쪽 정렬, 순서: 주소 → 성명 → 우편번호
- **호칭 옵션**: 성명 뒤에 "님" 또는 "귀하" 선택 가능
- **인쇄 최적화**: 브라우저 인쇄 기능으로 정확한 라벨 위치 출력

## 💾 USB 배포 기능

Node.js 설치 없이 사용할 수 있는 독립 실행파일을 제공합니다:

### USB 빌드 방법
```bash
# Windows에서 실행
build-usb.bat
```

### 생성되는 파일
```
USB-Release/
├── 우편번호찾기.exe     # 독립 실행파일
├── public/              # 웹 인터페이스 파일
├── .env                 # 환경 설정 파일
├── 사용법.md           # 사용자 가이드
└── data/               # 샘플 데이터 (선택사항)
```

### USB 사용법
1. USB-Release 폴더를 USB에 복사
2. `.env` 파일에서 `JUSO_API_KEY` 설정
3. `우편번호찾기.exe` 실행 또는 `USB-실행방법.bat` 실행
4. 브라우저에서 `http://localhost:3005` 접속

## ⚠️ 주의사항

- Juso API 키는 절대 클라이언트에 노출하지 마세요
- .env 파일을 git에 커밋하지 마세요
- API 호출 제한을 확인하세요
- Windows 방화벽에서 실행 허용이 필요할 수 있습니다
- 일부 백신 프로그램에서 실행파일을 오탐지할 수 있습니다

## 🔧 개발

### 의존성

- Node.js 16+
- npm 8+

### 주요 라이브러리

- Express.js - 웹 프레임워크
- Multer - 파일 업로드
- XLSX - 엑셀 파일 처리
- Axios - HTTP 클라이언트
- Helmet - 보안
- Express Rate Limit - API 제한
- PKG - 독립 실행파일 생성
- Node-cron - 스케줄링
- Compression - 응답 압축

### 시스템 요구사항

- **개발 환경**: Node.js 16+, npm 8+
- **USB 배포판**: Windows 10/11 (64비트), 최소 2GB RAM, 100MB 여유 공간

## 📞 문의

개발 관련 문의사항이 있으시면 GitHub 이슈를 등록해주세요.
