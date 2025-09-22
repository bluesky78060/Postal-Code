# Vercel 배포 가이드

## 🚀 Vercel에 배포하기

### 1. 준비사항
- GitHub 계정
- Vercel 계정 (GitHub로 로그인 가능)
- 환경변수 설정 준비

### 2. GitHub에 코드 업로드
```bash
# 현재 디렉토리에서 Git 초기화 (이미 되어있다면 스킵)
git add .
git commit -m "feat: Vercel 배포 설정 추가"
git push origin main
```

### 3. Vercel 배포 단계

#### 3-1. Vercel 사이트 접속
1. [vercel.com](https://vercel.com) 접속
2. "Sign up" 또는 "Log in" → GitHub 계정으로 로그인

#### 3-2. 프로젝트 가져오기
1. "New Project" 클릭
2. GitHub 저장소에서 `postal-code-finder` 선택
3. "Import" 클릭

#### 3-3. 프로젝트 설정
1. **Framework Preset**: "Other" 선택
2. **Root Directory**: 기본값 유지 ("./")
3. **Build Command**: 기본값 유지 또는 비워두기
4. **Output Directory**: 기본값 유지
5. **Install Command**: 기본값 유지

#### 3-4. 환경변수 설정
"Environment Variables" 섹션에서 다음 변수들을 추가:

```
JUSO_API_KEY=your_juso_api_key_here
POSTAL_PROVIDER=juso
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-app-name.vercel.app
```

> **중요**: `FRONTEND_URL`은 배포 후 실제 Vercel 도메인으로 업데이트해야 합니다.

#### 3-5. 배포 실행
1. "Deploy" 버튼 클릭
2. 배포 진행 상황 확인
3. 완료 후 도메인 확인

### 4. 배포 후 설정

#### 4-1. 도메인 확인 및 환경변수 업데이트
1. 배포 완료 후 할당된 도메인 확인 (예: `https://postal-code-finder-xxx.vercel.app`)
2. Vercel 프로젝트 설정에서 `FRONTEND_URL` 환경변수를 실제 도메인으로 업데이트
3. 재배포 (자동으로 트리거됨)

#### 4-2. 도메인 설정 (선택사항)
1. Vercel 프로젝트 설정 → "Domains"
2. 커스텀 도메인 추가 가능

### 5. 자동 배포 설정
- GitHub에 코드를 푸시하면 자동으로 Vercel에 배포됩니다
- `main` 브랜치에 푸시 시 프로덕션 배포
- 다른 브랜치에 푸시 시 프리뷰 배포

### 6. 트러블슈팅

#### 6-1. 일반적인 문제들

**파일 업로드 제한**:
- Vercel Hobby 플랜: 4.5MB
- 더 큰 파일이 필요하면 Pro 플랜 필요

**함수 실행 시간 제한**:
- Hobby 플랜: 10초
- Pro 플랜: 60초

**환경변수 문제**:
- Vercel 대시보드에서 환경변수 설정 확인
- 재배포 후 적용됨

#### 6-2. 로그 확인
1. Vercel 대시보드 → 프로젝트 → "Functions"
2. 함수 로그에서 에러 확인 가능

### 7. 생성된 파일들 설명

- `vercel.json`: Vercel 배포 설정
- `package.json`: 루트 패키지 설정
- `api/index.js`: Vercel 함수 진입점
- `.vercelignore`: 배포 시 제외할 파일들

### 8. 배포 완료 확인

배포가 성공하면 다음 기능들이 작동해야 합니다:
- ✅ 주소 검색
- ✅ 엑셀 파일 업로드
- ✅ 라벨 출력
- ✅ 파일 다운로드

### 9. 추가 팁

**무료 플랜 한계**:
- 월 100GB 대역폭
- 10초 함수 실행 시간
- 4.5MB 파일 크기 제한

**성능 최적화**:
- 이미지 최적화는 자동으로 적용됨
- Edge Network를 통한 빠른 응답

**보안**:
- HTTPS 자동 적용
- 환경변수는 안전하게 보관됨