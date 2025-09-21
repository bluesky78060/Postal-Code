@echo off
chcp 65001 >nul
echo ========================================
echo 🏠 우편번호 찾기 시스템 시작
echo ========================================

REM Node.js 설치 확인
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌ 오류] Node.js가 설치되지 않았습니다.
    echo Node.js를 다운로드하여 설치하세요: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js 버전:
node --version

REM npm 설치 확인
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌ 오류] npm이 설치되지 않았습니다.
    pause
    exit /b 1
)

echo ✅ npm 버전:
npm --version
echo.

REM 백엔드 디렉터리로 이동
cd /d "%~dp0backend"

REM .env 파일 확인 및 생성
if not exist ".env" (
    echo [💡 알림] .env 파일이 없습니다. .env.example을 복사하여 생성합니다.
    copy ".env.example" ".env" >nul
    echo ✅ .env 파일이 생성되었습니다.
    echo.
    echo [📝 중요] .env 파일에서 JUSO_API_KEY를 설정해주세요:
    echo 1. https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do 에서 API 키 발급
    echo 2. .env 파일을 메모장으로 열어서 JUSO_API_KEY 값 변경
    echo 3. 저장 후 이 프로그램을 다시 실행하세요
    echo.
    pause
    exit /b 0
)

REM uploads 디렉터리 생성
if not exist "uploads" (
    mkdir "uploads"
    echo ✅ uploads 디렉터리가 생성되었습니다.
)

REM 의존성 설치
echo 📦 의존성 패키지를 설치합니다...
npm install

if %errorlevel% neq 0 (
    echo [❌ 오류] 패키지 설치에 실패했습니다.
    pause
    exit /b 1
)

echo.
echo ========================================
echo 🚀 서버를 시작합니다...
echo 📍 브라우저에서 다음 주소로 접속하세요:
echo    http://localhost:3005
echo.
echo 💡 종료하려면 Ctrl+C를 누르세요
echo ========================================
echo.

REM 개발 서버 시작
npm run dev

pause