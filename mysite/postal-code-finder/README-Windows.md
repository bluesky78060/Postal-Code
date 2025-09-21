# 🏠 우편번호 찾기 시스템 - Windows 설치 가이드

Windows 운영체제에서 우편번호 찾기 시스템을 로컬로 실행하는 방법을 안내합니다.

## 📋 시스템 요구사항

- **Windows 10/11** (권장)
- **Node.js 18.0** 이상
- **인터넷 연결** (API 호출용)
- **4GB RAM** 이상 권장

## 🚀 빠른 시작

### 1단계: Node.js 설치

1. [Node.js 공식 웹사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 다운로드한 설치 파일(.msi) 실행
3. 설치 마법사의 지시에 따라 설치 완료
4. 명령 프롬프트(cmd)를 열어 설치 확인:
   ```cmd
   node --version
   npm --version
   ```

### 2단계: 프로젝트 다운로드

#### 방법 A: Git 사용 (권장)
```cmd
git clone https://github.com/bluesky78060/Postal-Code.git
cd Postal-Code
```

#### 방법 B: ZIP 파일 다운로드
1. [GitHub 저장소](https://github.com/bluesky78060/Postal-Code)에서 "Code" → "Download ZIP" 클릭
2. 다운로드한 ZIP 파일을 원하는 위치에 압축 해제
3. 압축 해제한 폴더로 이동

### 3단계: API 키 설정

1. [주소정보누리집](https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do)에서 API 키 발급
   - 회원가입 → 신청 → 승인 대기 → API 키 발급
2. 프로젝트 루트 폴더에서 `start-windows.bat` 파일을 더블클릭
3. 처음 실행 시 `.env` 파일이 자동 생성됩니다
4. `.env` 파일을 메모장으로 열어서 다음 라인을 수정:
   ```
   JUSO_API_KEY=발급받은_API_키_입력
   ```
5. 파일을 저장하고 닫기

### 4단계: 프로그램 실행

1. `start-windows.bat` 파일을 더블클릭
2. 자동으로 필요한 패키지들이 설치됩니다
3. 서버가 시작되면 브라우저에서 다음 주소로 접속:
   ```
   http://localhost:3005
   ```

## 💡 사용 방법

### 주소 검색
1. "주소 검색" 탭에서 주소 입력
2. "우편번호 찾기" 버튼 클릭
3. 결과 확인

### 엑셀 파일 처리
1. "엑셀 업로드" 탭 선택
2. 주소가 포함된 엑셀 파일(.xlsx, .xls) 업로드
3. 자동 처리 완료 후 다운로드

### 라벨 출력
1. "라벨 출력" 탭 선택
2. 주소 데이터가 포함된 엑셀 파일 업로드
3. 필드 매핑 설정 (주소, 성명, 우편번호)
4. 호칭 선택 (님/귀하/없음)
5. 라벨 생성 후 프린트

## 🔧 문제 해결

### 일반적인 문제

**Q: Node.js 명령어를 인식하지 못해요**
- A: Node.js 설치 후 명령 프롬프트를 새로 열어주세요
- 시스템 재시작이 필요할 수 있습니다

**Q: 포트 3005가 이미 사용 중이라고 나와요**
- A: `.env` 파일에서 `PORT=3006` 등으로 변경하세요

**Q: API 오류가 발생해요**
- A: JUSO_API_KEY가 올바르게 설정되었는지 확인하세요
- API 키 발급 승인이 완료되었는지 확인하세요

**Q: 엑셀 파일 업로드가 안 돼요**
- A: 파일 크기가 10MB 이하인지 확인하세요
- 파일 형식이 .xlsx 또는 .xls인지 확인하세요

### 고급 설정

**포트 변경**
```
# .env 파일에서
PORT=원하는포트번호
```

**파일 크기 제한 변경**
```
# .env 파일에서 (바이트 단위)
MAX_FILE_SIZE=20971520  # 20MB
```

## 📁 프로젝트 구조

```
Postal-Code/
├── backend/                 # 백엔드 서버
│   ├── src/                # 소스 코드
│   ├── uploads/            # 업로드된 파일
│   ├── package.json        # 패키지 설정
│   └── .env               # 환경 설정
├── frontend/               # 프론트엔드
│   └── public/            # 웹 파일들
├── start-windows.bat      # Windows 실행 스크립트
└── README-Windows.md      # 이 문서
```

## 🆘 추가 지원

- **GitHub Issues**: [문제 신고](https://github.com/bluesky78060/Postal-Code/issues)
- **이메일 문의**: 프로젝트 관리자에게 연락

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

✨ **팁**: 프로그램을 종료하려면 명령 프롬프트 창에서 `Ctrl + C`를 누르세요.