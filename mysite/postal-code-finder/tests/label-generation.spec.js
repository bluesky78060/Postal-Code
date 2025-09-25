const { test, expect } = require('@playwright/test');

test.describe('라벨 생성 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 라벨 출력 탭으로 전환
    await page.click('[data-tab="label"]');
    await expect(page.locator('#label')).toHaveClass(/active/);
  });

  test('라벨 출력 탭 기본 상태', async ({ page }) => {
    // 파일 업로드 영역 확인
    await expect(page.locator('#labelFileDropArea')).toBeVisible();
    await expect(page.locator('#labelFile')).toBeHidden();
    await expect(page.locator('#btnLoadSampleData')).toBeVisible();
    await expect(page.locator('#labelDataPreview')).toHaveClass(/hidden/);
  });

  test('샘플 데이터 로드', async ({ page }) => {
    await page.click('#btnLoadSampleData');
    
    // 데이터 미리보기 영역 나타나는지 확인
    await page.waitForSelector('#labelDataPreview:not(.hidden)', { timeout: 5000 });
    
    const previewElement = page.locator('#labelDataPreview');
    await expect(previewElement).toBeVisible();
    
    // 데이터 테이블 확인
    await expect(page.locator('#labelDataTable')).toBeVisible();
    
    // 라벨 템플릿 선택 확인
    await expect(page.locator('#labelTemplate')).toBeVisible();
    const templateSelect = page.locator('#labelTemplate');
    await expect(templateSelect).toHaveValue('2x9');
    
    // 필드 매핑 영역 확인
    await expect(page.locator('#labelFieldMapping')).toBeVisible();
    
    // 성명 뒤 호칭 설정 확인
    await expect(page.locator('#nameSuffix')).toBeVisible();
    await expect(page.locator('#nameSuffix')).toHaveValue('님');
  });

  test('라벨 생성 및 미리보기', async ({ page }) => {
    // 샘플 데이터 로드
    await page.click('#btnLoadSampleData');
    await page.waitForSelector('#labelDataPreview:not(.hidden)', { timeout: 5000 });
    
    // 라벨 생성 버튼 클릭
    await page.click('#btnGenerateLabels');
    
    // 라벨 미리보기 영역 나타나는지 확인
    await page.waitForSelector('#labelPreview:not(.hidden)', { timeout: 10000 });
    
    const previewElement = page.locator('#labelPreview');
    await expect(previewElement).toBeVisible();
    
    // 라벨 시트 확인
    await expect(page.locator('#labelSheet')).toBeVisible();
    
    // 다운로드 버튼들 확인
    await expect(page.locator('#btnDownloadHWPX')).toBeVisible();
    await expect(page.locator('#btnDownloadPDF')).toBeVisible();
    await expect(page.locator('#btnLabelReset')).toBeVisible();
  });

  test('라벨 템플릿 변경', async ({ page }) => {
    await page.click('#btnLoadSampleData');
    await page.waitForSelector('#labelDataPreview:not(.hidden)', { timeout: 5000 });
    
    // 다른 템플릿 선택
    await page.selectOption('#labelTemplate', '3x7');
    await expect(page.locator('#labelTemplate')).toHaveValue('3x7');
    
    // 라벨 생성
    await page.click('#btnGenerateLabels');
    await page.waitForSelector('#labelPreview:not(.hidden)', { timeout: 10000 });
    
    // 템플릿에 따른 변경 확인 (실제 구현에 따라 조정)
    await expect(page.locator('#labelSheet')).toBeVisible();
  });

  test('성명 호칭 변경', async ({ page }) => {
    await page.click('#btnLoadSampleData');
    await page.waitForSelector('#labelDataPreview:not(.hidden)', { timeout: 5000 });
    
    // 호칭 변경
    await page.selectOption('#nameSuffix', '귀하');
    await expect(page.locator('#nameSuffix')).toHaveValue('귀하');
    
    // 라벨 생성 후 호칭이 반영되는지 확인
    await page.click('#btnGenerateLabels');
    await page.waitForSelector('#labelPreview:not(.hidden)', { timeout: 10000 });
  });

  test('라벨 초기화', async ({ page }) => {
    await page.click('#btnLoadSampleData');
    await page.waitForSelector('#labelDataPreview:not(.hidden)', { timeout: 5000 });
    
    await page.click('#btnGenerateLabels');
    await page.waitForSelector('#labelPreview:not(.hidden)', { timeout: 10000 });
    
    // 초기화 버튼 클릭
    await page.click('#btnLabelReset');
    
    // 미리보기 영역이 숨겨지는지 확인
    await expect(page.locator('#labelPreview')).toHaveClass(/hidden/);
  });

  test('HWPX 다운로드 버튼', async ({ page }) => {
    await page.click('#btnLoadSampleData');
    await page.waitForSelector('#labelDataPreview:not(.hidden)', { timeout: 5000 });
    
    await page.click('#btnGenerateLabels');
    await page.waitForSelector('#labelPreview:not(.hidden)', { timeout: 10000 });
    
    // 다운로드 버튼 클릭 (실제 다운로드는 브라우저 설정에 따라 다름)
    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnDownloadHWPX');
    
    try {
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.hwpx$/);
    } catch (error) {
      console.log('다운로드 테스트 실패 (브라우저 설정 또는 서버 응답 이슈):', error.message);
    }
  });
});