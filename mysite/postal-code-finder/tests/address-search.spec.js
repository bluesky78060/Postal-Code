const { test, expect } = require('@playwright/test');

test.describe('주소 검색 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('페이지 로드 확인', async ({ page }) => {
    await expect(page).toHaveTitle('우편번호 자동 입력 시스템');
    await expect(page.locator('h1')).toContainText('우편번호 자동 입력');
  });

  test('주소 검색 탭 기본 상태', async ({ page }) => {
    // 주소 검색 탭이 활성화되어 있는지 확인
    const searchTab = page.locator('[data-tab="search"]');
    await expect(searchTab).toHaveClass(/active/);
    
    // 입력 필드와 버튼 확인
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#btnSearch')).toBeVisible();
  });

  test('주소 검색 실행', async ({ page }) => {
    // 서울시청 주소로 테스트
    await page.fill('#address', '서울특별시 중구 세종대로 110');
    await page.click('#btnSearch');

    // 결과 대기 및 확인 (최대 10초)
    await page.waitForSelector('#searchResult:not(.hidden)', { timeout: 10000 });
    
    const resultElement = page.locator('#searchResult');
    await expect(resultElement).toBeVisible();
    await expect(resultElement).toContainText('우편번호:');
    await expect(resultElement).toHaveClass(/success/);
  });

  test('유효하지 않은 주소 검색', async ({ page }) => {
    await page.fill('#address', '존재하지않는주소123');
    await page.click('#btnSearch');

    // 에러 결과 대기
    await page.waitForSelector('#searchResult:not(.hidden)', { timeout: 10000 });
    
    const resultElement = page.locator('#searchResult');
    await expect(resultElement).toBeVisible();
    // 에러 메시지 또는 결과 없음 확인
  });

  test('빈 입력으로 검색', async ({ page }) => {
    await page.click('#btnSearch');
    
    // 입력 검증 또는 에러 메시지 확인
    // 실제 동작에 따라 조정 필요
  });
});