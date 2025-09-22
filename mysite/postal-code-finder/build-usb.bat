@echo off
chcp 65001 >nul
echo ========================================
echo 📦 USB 배포용 실행파일 빌드
echo ========================================

REM Node.js 설치 확인
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌ 오류] Node.js가 설치되지 않았습니다.
    echo Node.js를 다운로드하여 설치하세요: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 버전:
node --version

REM 백엔드 디렉터리로 이동
cd /d "%~dp0backend"

REM PKG 도구 설치
echo 📦 PKG 도구를 설치합니다...
npm install pkg --save-dev
if %errorlevel% neq 0 (
    echo [❌ 오류] PKG 설치에 실패했습니다.
    pause
    exit /b 1
)

REM 프로젝트 의존성 설치
echo 📦 프로젝트 의존성을 설치합니다...
npm install
if %errorlevel% neq 0 (
    echo [❌ 오류] 의존성 설치에 실패했습니다.
    pause
    exit /b 1
)

REM 빌드 디렉터리 정리
echo 🧹 이전 빌드 파일을 정리합니다...
if exist "..\dist" rmdir /s /q "..\dist"
if exist "..\USB-Release" rmdir /s /q "..\USB-Release"

REM Windows 실행파일 빌드
echo 🔨 Windows 실행파일을 빌드합니다...
npx pkg . --targets=node18-win-x64 --out-path=../dist

if %errorlevel% neq 0 (
    echo [❌ 오류] 빌드에 실패했습니다.
    pause
    exit /b 1
)

REM USB 배포 디렉터리 생성
echo 📁 USB 배포 디렉터리를 생성합니다...
cd ..
mkdir "USB-Release"
mkdir "USB-Release\data"

REM 실행파일 복사
echo 📋 파일들을 복사합니다...
copy "dist\postal-code-backend.exe" "USB-Release\우편번호찾기.exe"

REM 프론트엔드 파일 복사
xcopy "frontend\public" "USB-Release\public" /E /I /Y

REM 설정 파일 복사
copy "backend\.env.example" "USB-Release\.env"

REM 샘플 데이터 복사 (있는 경우)
if exist "backend\data" (
    xcopy "backend\data" "USB-Release\data" /E /I /Y
)

REM README 파일 복사
copy "README-Windows.md" "USB-Release\사용법.md"

echo ✅ 빌드가 완료되었습니다!
echo.
echo 📂 USB-Release 폴더에 다음 파일들이 생성되었습니다:
echo    - 우편번호찾기.exe (실행파일)
echo    - public\ (웹 인터페이스)
echo    - .env (설정파일)
echo    - 사용법.md (사용 가이드)
echo.
echo 💡 사용 방법:
echo 1. USB-Release 폴더 전체를 USB에 복사
echo 2. .env 파일에서 JUSO_API_KEY 설정
echo 3. 우편번호찾기.exe 실행
echo 4. 브라우저에서 http://localhost:3005 접속
echo.

pause