@echo off
chcp 65001 >nul
echo ========================================
echo 🏠 우편번호 찾기 시스템 (USB 버전)
echo ========================================
echo.
echo 💡 사용 방법:
echo.
echo 1️⃣ API 키 설정 (최초 1회만)
echo    - .env 파일을 메모장으로 열기
echo    - JUSO_API_KEY=your_juso_api_key_here 부분 수정
echo    - https://www.juso.go.kr 에서 API 키 발급 받기
echo.
echo 2️⃣ 프로그램 실행
echo    - 우편번호찾기.exe 더블클릭
echo    - 브라우저에서 http://localhost:3005 접속
echo.
echo 3️⃣ 프로그램 종료
echo    - 명령 프롬프트 창에서 Ctrl+C 누르기
echo.

set /p choice="지금 실행하시겠습니까? (Y/N): "
if /i "%choice%"=="Y" (
    echo.
    echo 🚀 우편번호 찾기 시스템을 시작합니다...
    echo 📍 브라우저에서 http://localhost:3005 로 접속하세요
    echo 💡 종료하려면 Ctrl+C를 누르세요
    echo.
    start "" "우편번호찾기.exe"
    timeout /t 3
    start "" "http://localhost:3005"
) else (
    echo.
    echo 💡 실행을 원할 때 "우편번호찾기.exe"를 더블클릭하세요.
)

echo.
pause