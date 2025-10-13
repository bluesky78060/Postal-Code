(() => {
  // API 엔드포인트 자동 결정: window.API_BASE > 동일 오리진('/api') > localhost:3001
  const API_BASE = (() => {
    try {
      // 수동 오버라이드 (전역 또는 localStorage)
      if (window.API_BASE) return window.API_BASE.replace(/\/$/, '');
      const stored = window.localStorage && window.localStorage.getItem('API_BASE');
      if (stored) return stored.replace(/\/$/, '');
      // 동일 오리진 우선 (http/https인 경우에만)
      if (window.location && window.location.origin) {
        const proto = String(window.location.protocol || '').toLowerCase();
        if (proto.startsWith('http')) {
          return `${window.location.origin}/api`;
        }
      }
    } catch (_) {}
    // 최후 수단: 로컬 기본값
    return 'http://localhost:3001/api';
  })();
  if (String(window.location.protocol).toLowerCase().startsWith('file')) {
    console.warn('[App] file:// 로 열렸습니다. API 서버 주소를 localStorage.API_BASE에 설정하세요. 예) localStorage.setItem(\'API_BASE\', \'http://localhost:3005/api\')');
  }
  console.log('[App] Using API_BASE:', API_BASE);

  const PROGRESS_STEP_TEMPLATE = [
    { key: 'upload', label: '파일 업로드' },
    { key: 'dedupe', label: '중복 제거' },
    { key: 'lookup', label: '우편번호 조회' },
    { key: 'export', label: '엑셀 생성' }
  ];

  const cloneProgressSteps = (activeKey = null) => PROGRESS_STEP_TEMPLATE.map(step => {
    let status = 'pending';
    if (step.key === activeKey) {
      status = 'in-progress';
    } else if (step.key === 'upload' && activeKey !== 'upload') {
      status = 'done';
    }
    return { ...step, status };
  });

  function renderProgressSteps(containerId, steps) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const existingKeys = Array.from(container.querySelectorAll('li')).map(li => li.dataset.key);
    const newKeys = steps.map(step => step.key);
    if (existingKeys.length === newKeys.length && existingKeys.every((key, idx) => key === newKeys[idx])) {
      return;
    }
    container.innerHTML = steps.map(step => `
      <li data-key="${step.key}" class="${step.status || 'pending'}">
        <span class="step-box"></span>
        <span class="step-label">${step.label}</span>
      </li>
    `).join('');
  }

  function updateProgressSteps(containerId, steps) {
    const container = document.getElementById(containerId);
    if (!container) return;
    steps.forEach(step => {
      const li = container.querySelector(`li[data-key="${step.key}"]`);
      if (!li) return;
      li.classList.remove('pending', 'in-progress', 'done', 'error');
      li.classList.add(step.status || 'pending');
      const box = li.querySelector('.step-box');
      if (!box) return;
      if (step.status === 'done') {
        box.textContent = '✓';
      } else if (step.status === 'in-progress') {
        box.textContent = '…';
      } else if (step.status === 'error') {
        box.textContent = '⚠';
      } else {
        box.textContent = '';
      }
    });
  }

  function formatEtaMs(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `예상 남은 시간 약 ${minutes}분${seconds ? ` ${seconds}초` : ''}`;
    }
    return `예상 남은 시간 약 ${seconds}초`;
  }

  function deriveEtaFromStatus(status) {
    if (typeof status?.estimatedRemainingMs === 'number') {
      return formatEtaMs(status.estimatedRemainingMs);
    }
    const totalTarget = status.total ?? status.totalOriginal ?? status.maxRows;
    if (!status?.startTime || !status?.processed || !totalTarget || status.processed === 0) return '';
    const start = new Date(status.startTime).getTime();
    const elapsed = Date.now() - start;
    if (elapsed <= 0) return '';
    const remainingItems = Math.max(totalTarget - status.processed, 0);
    if (remainingItems <= 0) return '';
    const ratePerItem = elapsed / status.processed;
    if (!Number.isFinite(ratePerItem) || ratePerItem <= 0) return '';
    return formatEtaMs(remainingItems * ratePerItem);
  }

  function updateProgressCard(kind, status = {}, fallbackText = '') {
    const isUpload = kind === 'upload';
    const fill = document.getElementById(isUpload ? 'progressFill' : 'labelProgressFill');
    const textEl = document.getElementById(isUpload ? 'progressText' : 'labelProgressText');
    const etaEl = document.getElementById(isUpload ? 'progressEta' : 'labelProgressEta');
    const stepsContainer = isUpload ? 'uploadProgressSteps' : 'labelProgressSteps';

    const totalTarget = status.total ?? status.totalOriginal ?? status.maxRows ?? 0;
    
    const percent = Math.max(0, Math.min(100, status.progress ?? 0));
    if (fill) fill.style.width = percent + '%';

    let message = fallbackText;
    if (!message) {
      if (status.status === 'completed') {
        if (status.truncatedCount) {
          message = `처리 완료! (제한 ${status.maxRows || 0}건, ${status.truncatedCount}건 제외)`;
        } else {
          message = '처리 완료!';
        }
      } else if (status.status === 'error') {
        message = status.error ? `오류: ${status.error}` : '처리 중 오류가 발생했습니다.';
      } else if (typeof status.processed === 'number') {
        const denom = totalTarget || status.total || status.maxRows || 0;
        if (denom) {
          message = `처리 중... (${status.processed}/${denom})`;
        } else {
          message = `처리 중... (${status.processed})`;
        }
      } else {
        message = '처리 중...';
      }
    }
    if (textEl) textEl.textContent = message;

    const etaText = deriveEtaFromStatus(status);
    if (etaEl) {
      if (etaText) {
        etaEl.textContent = etaText;
        etaEl.classList.remove('hidden');
      } else {
        etaEl.textContent = '';
        etaEl.classList.add('hidden');
      }
    }

    const steps = Array.isArray(status.steps) && status.steps.length
      ? status.steps
      : cloneProgressSteps(status.status === 'processing' ? 'dedupe' : null);
    renderProgressSteps(stepsContainer, steps);
    updateProgressSteps(stepsContainer, steps);
  }

  // API 연결 상태 표시
  async function checkApiHealth() {
    const statusEl = document.getElementById('apiStatus');
    const dot = statusEl?.querySelector('.api-dot');
    const text = document.getElementById('apiStatusText');
    if (dot) { dot.classList.remove('ok', 'fail'); }
    if (text) { text.textContent = '확인 중...'; }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (dot) dot.classList.add('ok');
      if (text) text.textContent = `연결됨 (${new URL(API_BASE).origin})`;
      return data;
    } catch (e) {
      if (dot) dot.classList.add('fail');
      if (text) text.textContent = `연결 실패: ${e.message}`;
      return null;
    }
  }

  function saveApiBase() {
    const input = document.getElementById('apiBaseInput');
    const val = (input?.value || '').trim();
    if (!val) {
      window.localStorage.removeItem('API_BASE');
      alert('API 주소가 비어 있어 기본 규칙으로 복원합니다.');
    } else {
      window.localStorage.setItem('API_BASE', val);
      alert(`API 주소를 저장했습니다:\n${val}\n페이지를 새로고침합니다.`);
    }
    window.location.reload();
  }

  
  // 라벨 관련 전역 변수
  let labelData = null;
  let fieldMappings = {};
  let currentLabelJobId = null;
  let lastLabelStatus = null;
  // 모달 포커스 관리
  let lastFocusedElement = null;
  let modalKeydownHandler = null;

  function switchTab(tabName, clickedButton) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    // 탭 전환 시 진행 표시/결과 충돌 방지
    if (tabName === 'label') {
      const upProg = document.getElementById('uploadProgress');
      const upRes = document.getElementById('uploadResult');
      if (upProg) upProg.classList.add('hidden');
      if (upRes) { upRes.classList.add('hidden'); upRes.innerHTML = ''; }
    } else if (tabName === 'upload') {
      const lp = document.getElementById('labelUploadProgress');
      const ldp = document.getElementById('labelDataPreview');
      const lpv = document.getElementById('labelPreview');
      if (lp) lp.classList.add('hidden');
      if (ldp) ldp.classList.add('hidden');
      if (lpv) lpv.classList.add('hidden');
    }
  }

  async function searchAddress() {
    const address = document.getElementById('address').value.trim();
    const resultDiv = document.getElementById('searchResult');

    if (!address) {
      showResult(resultDiv, '주소를 입력해주세요.', 'error');
      return;
    }
    if (address.length < 2) {
      showResult(resultDiv, '주소는 2자 이상 입력해주세요.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/address/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        const result = data.data;
        showResult(resultDiv, `
          <h3>✅ 우편번호를 찾았습니다!</h3>
          <p><strong>우편번호:</strong> ${result.postalCode}</p>
          <p><strong>전체 주소:</strong> ${result.fullAddress}</p>
          <p><strong>시/도:</strong> ${result.sido}</p>
          <p><strong>시/군/구:</strong> ${result.sigungu}</p>
          <div style="margin-top:12px">
            <button class="btn" data-reset-search>↩️ 초기화</button>
          </div>
        `, 'success');
      } else {
        const errorMsg = data.error || '알 수 없는 오류가 발생했습니다.';
        showResult(resultDiv, `
          ❌ ${errorMsg}
          <div style="margin-top:12px">
            <button class="btn" data-reset-search>↩️ 초기화</button>
          </div>
        `, 'error');
        if (data.validationErrors && data.validationErrors.length > 0) {
          const details = data.validationErrors.map(err => err.message).join('<br>');
          showResult(resultDiv, `
            ❌ ${errorMsg}<br><small>${details}</small>
            <div style=\"margin-top:12px\">
              <button class=\"btn\" data-reset-search>↩️ 초기화</button>
            </div>
          `, 'error');
        }
      }
    } catch (error) {
      showResult(resultDiv, `
        ❌ 서버 연결 오류: ${error.message}
        <div style="margin-top:12px">
          <button class="btn" data-reset-search>↩️ 초기화</button>
        </div>
      `, 'error');
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) uploadFile(file);
  }

  async function uploadFile(file) {
    const progressDiv = document.getElementById('uploadProgress');
    const resultDiv = document.getElementById('uploadResult');

    if (!file.name.match(/\.(xls|xlsx)$/i)) {
      showResult(resultDiv, '❌ 엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showResult(resultDiv, '❌ 파일 크기는 10MB 이하여야 합니다.', 'error');
      return;
    }

    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    updateProgressCard('upload', { progress: 0, processed: 0, total: 0, steps: cloneProgressSteps('upload') }, '파일 업로드 중...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/file/upload`, { method: 'POST', body: formData });
      let data;
      try {
        data = await response.json();
      } catch (e) {
        const ct = response.headers.get('content-type') || '';
        const cd = response.headers.get('content-disposition') || '';
        if (/attachment/i.test(cd) || /application\/(vnd\.openxmlformats|octet-stream|zip)/i.test(ct)) {
          const blob = await response.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'postal_result.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          progressDiv.classList.add('hidden');
          showResult(resultDiv, `✅ 처리 파일을 다운로드했습니다.`, 'success');
          return;
        } else {
          throw e;
        }
      }
      if (data.success) {
        const jobId = data.data.jobId;
        checkProgress(jobId);
      } else {
        progressDiv.classList.add('hidden');
        showResult(resultDiv, `
          ❌ ${data.error}
          <div style="margin-top:12px">
            <button class="btn" data-reset-upload>↩️ 초기화</button>
          </div>
        `, 'error');
      }
    } catch (error) {
      progressDiv.classList.add('hidden');
      showResult(resultDiv, `
        ❌ 업로드 중 오류가 발생했습니다.
        <div style="margin-top:12px">
          <button class="btn" data-reset-upload>↩️ 초기화</button>
        </div>
      `, 'error');
    }
  }

  async function checkProgress(jobId) {
    try {
      const response = await fetch(`${API_BASE}/file/status/${jobId}`);
      const data = await response.json();
      if (data.success) {
        const status = data.data;
        updateProgressCard('upload', status);
        if (status.status === 'completed') {
          document.getElementById('uploadProgress').classList.add('hidden');
          const truncatedNote = status.truncatedCount ? `<p class="progress-note">⚠️ 최대 ${status.maxRows || 0}건까지만 처리되어 ${status.truncatedCount}건은 제외되었습니다.</p>` : '';
          showResult(document.getElementById('uploadResult'), `
            <h3>✅ 파일 처리가 완료되었습니다!</h3>
            <p><strong>처리된 행:</strong> ${status.processed}개</p>
            <p><strong>오류 행:</strong> ${status.errors?.length || 0}개</p>
            ${truncatedNote}
            <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" data-download-id="${jobId}">📥 다운로드</button>
              <button class="btn" data-reset-upload>↩️ 초기화</button>
            </div>
          `, 'success');
        } else if (status.status === 'error') {
          document.getElementById('uploadProgress').classList.add('hidden');
          showResult(document.getElementById('uploadResult'), `
            ❌ ${status.error}
            <div style="margin-top:12px">
              <button class="btn" data-reset-upload>↩️ 초기화</button>
            </div>
          `, 'error');
        } else {
          setTimeout(() => checkProgress(jobId), 2000);
        }
      }
    } catch (error) {
      document.getElementById('uploadProgress').classList.add('hidden');
      showResult(document.getElementById('uploadResult'), `
        ❌ 상태 확인 중 오류가 발생했습니다.
        <div style="margin-top:12px">
          <button class="btn" data-reset-upload>↩️ 초기화</button>
        </div>
      `, 'error');
    }
  }

  function downloadFile(jobId) {
    window.open(`${API_BASE}/file/download/${jobId}`, '_blank');
  }

  function resetSearchUI() {
    const input = document.getElementById('address');
    if (input) input.value = '';
    const resultDiv = document.getElementById('searchResult');
    resultDiv.classList.add('hidden');
    resultDiv.innerHTML = '';
    input && input.focus();
  }

  function resetUploadUI() {
    // Reset file input
    const fileInput = document.getElementById('file');
    if (fileInput) fileInput.value = '';
    // Hide progress
    const progressDiv = document.getElementById('uploadProgress');
    progressDiv.classList.add('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '처리 중...';
    const etaEl = document.getElementById('progressEta');
    if (etaEl) {
      etaEl.textContent = '';
      etaEl.classList.add('hidden');
    }
    const stepList = document.getElementById('uploadProgressSteps');
    if (stepList) stepList.innerHTML = '';
    // Hide result
    const resultDiv = document.getElementById('uploadResult');
    resultDiv.classList.add('hidden');
    resultDiv.innerHTML = '';
  }

  function showResult(element, html, type) {
    element.innerHTML = html;
    element.className = `result ${type}`;
    element.classList.remove('hidden');
  }

  // 라벨 관련 함수들
  function handleLabelFileSelect(event) {
    const file = event.target.files[0];
    if (file) processLabelFile(file);
  }

  async function processLabelFile(file) {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
      alert('엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.');
      return;
    }
    lastLabelStatus = null;

    console.log('파일 처리 시작:', file.name);
    
    // 진행 상황 표시
    document.getElementById('labelUploadProgress').classList.remove('hidden');
    updateProgressCard('label', { progress: 0, processed: 0, total: 0, steps: cloneProgressSteps('upload') }, '파일 업로드 중...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('API 호출:', `${API_BASE}/file/upload`);
      const response = await fetch(`${API_BASE}/file/upload`, { method: 'POST', body: formData });
      let data;
      try {
        data = await response.json();
      } catch (e) {
        const ct = response.headers.get('content-type') || '';
        const cd = response.headers.get('content-disposition') || '';
        if (/attachment/i.test(cd) || /application\/(vnd\.openxmlformats|octet-stream|zip)/i.test(ct)) {
          const blob = await response.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'postal_result.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          console.warn('라벨 모드 JSON 대신 파일 다운로드 응답 수신');
          document.getElementById('labelUploadProgress').classList.add('hidden');
          return;
        } else {
          throw e;
        }
      }
      
      console.log('서버 응답:', data);
      
      if (data.success) {
        const jobId = data.data.jobId;
        currentLabelJobId = jobId;
        console.log('JobID:', jobId);
        updateProgressCard('label', { progress: 10, processed: 0, total: 0, steps: cloneProgressSteps('dedupe') }, '파일 처리 중...');
        await waitForLabelProcessing(jobId);
      } else {
        document.getElementById('labelUploadProgress').classList.add('hidden');
        alert('파일 업로드 실패: ' + data.error);
      }
    } catch (error) {
      console.error('파일 처리 오류:', error);
      document.getElementById('labelUploadProgress').classList.add('hidden');
      alert('파일 처리 중 오류가 발생했습니다: ' + error.message);
      
      // 오류 발생 시 샘플 데이터로 대체
      console.log('샘플 데이터로 대체');
      lastLabelStatus = null;
      labelData = generateSampleData();
      showLabelDataPreview();
    }
  }

  async function waitForLabelProcessing(jobId) {
    try {
      const response = await fetch(`${API_BASE}/file/status/${jobId}`);
      const data = await response.json();
      
      if (data.success) {
        const status = data.data;
        updateProgressCard('label', status);
        
        if (status.status === 'completed') {
          document.getElementById('labelUploadProgress').classList.add('hidden');
          lastLabelStatus = status;
          // 처리된 파일에서 데이터 추출
          await loadLabelData(jobId);
        } else if (status.status === 'processing') {
          setTimeout(() => waitForLabelProcessing(jobId), 2000);
        } else {
          document.getElementById('labelUploadProgress').classList.add('hidden');
          alert('파일 처리 실패: ' + status.error);
        }
      }
    } catch (error) {
      document.getElementById('labelUploadProgress').classList.add('hidden');
      lastLabelStatus = null;
      alert('상태 확인 중 오류: ' + error.message);
    }
  }

  async function loadLabelData(jobId) {
    try {
      console.log('라벨 데이터 로드 시작:', jobId);
      // 새로운 label-data API 엔드포인트 사용
      const response = await fetch(`${API_BASE}/file/label-data/${jobId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('라벨 데이터 로드 성공:', data.data);
        labelData = {
          headers: data.data.headers,
          rows: data.data.rows
        };
        showLabelDataPreview();
      } else {
        throw new Error(data.error || '데이터 로드 실패');
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('실제 데이터 로드에 실패했습니다. 샘플 데이터를 사용합니다.');
      // 오류 시 샘플 데이터 사용
      labelData = generateSampleData();
      showLabelDataPreview();
    }
  }

  function generateSampleData() {
    return [
      { name: '홍길동', address: '서울특별시 강남구 테헤란로 123', postalCode: '06158' },
      { name: '김영희', address: '서울특별시 서초구 반포대로 45', postalCode: '06543' },
      { name: '이철수', address: '경기도 성남시 분당구 정자로 67', postalCode: '13561' },
      { name: '박민수', address: '인천광역시 연수구 송도과학로 89', postalCode: '21984' },
      { name: '정수진', address: '부산광역시 해운대구 우동 123-45', postalCode: '48058' },
      { name: '최지혜', address: '대구광역시 수성구 달구벌대로 678', postalCode: '42192' },
      { name: '한상호', address: '대전광역시 유성구 대학로 234', postalCode: '34141' },
      { name: '윤미경', address: '광주광역시 서구 상무대로 567', postalCode: '61949' },
      { name: '장동건', address: '울산광역시 남구 삼산로 890', postalCode: '44776' },
      { name: '송혜교', address: '세종특별자치시 한누리대로 123', postalCode: '30103' },
      { name: '강호동', address: '강원도 춘천시 중앙로 456', postalCode: '24341' },
      { name: '유재석', address: '충청북도 청주시 상당구 대성로 789', postalCode: '28644' },
      { name: '신동엽', address: '충청남도 천안시 동남구 병천면 123', postalCode: '31225' },
      { name: '김용만', address: '전라북도 전주시 완산구 효자동 456-78', postalCode: '54896' },
      { name: '조세호', address: '전라남도 목포시 용당로 234', postalCode: '58746' },
      { name: '김구라', address: '경상북도 대구시 중구 국채보상로 567', postalCode: '41911' },
      { name: '허경환', address: '경상남도 창원시 마산합포구 3·15대로 890', postalCode: '51329' },
      { name: '김영철', address: '제주특별자치도 제주시 연동 123-45', postalCode: '63212' }
    ];
  }

  function showLabelDataPreview() {
    if (!labelData) {
      alert('데이터가 없습니다.');
      return;
    }

    // 데이터 형식 확인 및 정규화
    let displayData;
    let columns;
    
    if (Array.isArray(labelData)) {
      // 기존 배열 형식 (샘플 데이터)
      if (labelData.length === 0) {
        alert('데이터가 없습니다.');
        return;
      }
      displayData = labelData;
      columns = Object.keys(labelData[0]);
    } else if (labelData.headers && labelData.rows) {
      // 새로운 형식 (API 응답)
      if (labelData.rows.length === 0) {
        alert('데이터가 없습니다.');
        return;
      }
      displayData = labelData.rows;
      columns = labelData.headers;
    } else {
      alert('잘못된 데이터 형식입니다.');
      return;
    }

    // 미리보기용 컬럼 중복 정리 (우편번호/도로명주소 등 동의어/중복값 제거)
    const previewColumns = dedupePreviewColumns(columns, displayData);

    // 데이터 테이블 생성
    const tableHtml = createDataTable(displayData, previewColumns);
    document.getElementById('labelDataTable').innerHTML = tableHtml;

    // 필드 매핑 UI 생성 (미리보기와 동일한 컬럼만 제공해 혼동 방지)
    const mappingColumns = Array.isArray(previewColumns) && previewColumns.length
      ? previewColumns
      : (Array.isArray(columns) ? columns : []);
    createFieldMappings(mappingColumns);

    const noteEl = document.getElementById('labelPreviewNote');
    if (noteEl) {
      if (lastLabelStatus?.truncatedCount) {
        noteEl.innerHTML = `⚠️ 최대 ${lastLabelStatus.maxRows || 0}건까지만 처리되어 ${lastLabelStatus.truncatedCount}건은 제외되었습니다.`;
        noteEl.classList.remove('hidden');
      } else {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
      }
    }

    // 미리보기 영역 표시
    document.getElementById('labelDataPreview').classList.remove('hidden');
  }

  // 미리보기 전용: 동의어/중복 값 컬럼 제거
  function dedupePreviewColumns(columns, data) {
    if (!Array.isArray(columns) || columns.length === 0) return columns || [];

    const lower = (s) => String(s || '').toLowerCase();
    const norm = (s) => lower(s).replace(/[\s_\/]/g, '');

    const groups = {
      postal: ['우편번호', 'postalcode', 'postal_code', 'postcode', 'zip', 'zipcode'],
      address: ['도로명주소', 'address', 'fulladdress', '전체주소', '주소'],
      name: ['성명', '이름', 'name']
    };

    const inGroup = (col, keys) => keys.includes(norm(col));

    // 중복 값 판정: 앞쪽 몇 행 비교로 동일 값이면 중복으로 간주
    const sameValues = (a, b) => {
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        const va = (typeof row === 'object' && !Array.isArray(row)) ? row[a] : row[columns.indexOf(a)];
        const vb = (typeof row === 'object' && !Array.isArray(row)) ? row[b] : row[columns.indexOf(b)];
        if ((va || '') !== (vb || '')) return false;
      }
      return true;
    };

    // 우선순위: address는 '도로명주소'를 선호, postal은 '우편번호' 또는 'postalCode'를 선호
    const preferOrder = {
      name: ['성명', '이름', 'name'],
      address: ['도로명주소', 'address', 'fullAddress', '전체주소', '주소'],
      postal: ['우편번호', 'postalCode', 'postal_code', 'postcode', 'zip', 'zipcode']
    };

    const chosen = new Set();
    let keptName = null;
    let keptAddress = null;
    let keptPostal = null;

    // 먼저 address/postal 그룹 처리
    // 이름 우선 선택(있으면)
    {
      const candidates = columns.filter(c => inGroup(c, groups.name));
      if (candidates.length) {
        const ordered = preferOrder.name
          .map(k => candidates.find(c => norm(c) === norm(k)))
          .filter(Boolean)
          .concat(candidates.filter(c => !preferOrder.name.some(k => norm(k) === norm(c))));
        keptName = ordered[0] || candidates[0];
        if (keptName) chosen.add(keptName);
      }
    }

    ['address', 'postal'].forEach((g) => {
      const candidates = columns.filter(c => inGroup(c, groups[g]));
      if (candidates.length === 0) return;
      // 동일 값 중복 제거
      let kept = null;
      // 우선순위에 따라 보관할 후보 선택
      const ordered = preferOrder[g]
        .map(k => candidates.find(c => norm(c) === norm(k)))
        .filter(Boolean)
        .concat(candidates.filter(c => !preferOrder[g].some(k => norm(k) === norm(c))));
      for (const col of ordered) {
        if (!kept) { kept = col; continue; }
        if (!sameValues(kept, col)) {
          // 값이 다르면 보조 컬럼으로 허용 (단, 미리보기에서는 하나만 보여주고, 매핑 선택에는 포함시키기 위해 result에 넣지 않음)
          continue;
        }
      }
      if (kept) {
        if (g === 'address') keptAddress = kept; else keptPostal = kept;
        chosen.add(kept);
      }
    });

    // 원하는 미리보기 순서: 성명 → 도로명주소 → 우편번호 → 나머지
    const orderedOut = [];
    if (keptName) orderedOut.push(keptName);
    if (keptAddress) orderedOut.push(keptAddress);
    if (keptPostal) orderedOut.push(keptPostal);

    columns.forEach((c) => {
      if (orderedOut.includes(c)) return;
      const normalizedColumn = norm(c);
      const previewHide = ['시도', '시도명', 'sido', '시군구', '시군구명', 'sigungu'];
      if (previewHide.some(pattern => normalizedColumn.includes(norm(pattern)))) return;
      // address/postal 그룹의 중복 후보는 미리보기에서는 제외
      if (inGroup(c, groups.address)) return;
      if (inGroup(c, groups.postal)) return;
      orderedOut.push(c);
    });

    return orderedOut.length ? orderedOut : columns;
  }

  function createDataTable(data, columns) {
    if (!data || data.length === 0) return '<p>데이터가 없습니다.</p>';

    // columns 매개변수가 없으면 첫 번째 객체의 키를 사용 (기존 동작)
    if (!columns && data[0]) {
      columns = Object.keys(data[0]);
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    
    // 헤더
    html += '<thead><tr>';
    columns.forEach(col => {
      html += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${col}</th>`;
    });
    html += '</tr></thead>';
    
    // 데이터 (최대 5행만 표시)
    html += '<tbody>';
    data.slice(0, 5).forEach(row => {
      html += '<tr>';
      columns.forEach((col, index) => {
        // 객체 형태면 키로 접근, 배열 형태면 인덱스로 접근
        const value = typeof row === 'object' && !Array.isArray(row) ? row[col] : row[index];
        html += `<td style="border: 1px solid #ddd; padding: 8px;">${value || ''}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    
    if (data.length > 5) {
      html += `<p style="margin-top: 10px; color: #666;">총 ${data.length}개 행 (5개만 표시)</p>`;
    }
    
    return html;
  }

  function createFieldMappings(columns) {
    const container = document.getElementById('labelFieldMapping');
    const fields = [
      { key: 'name', label: '이름' },
      { key: 'address', label: '주소' },
      { key: 'detail', label: '상세주소' },
      { key: 'postalCode', label: '우편번호' }
    ];

    const synonyms = {
      name: ['성명', '이름', 'name'],
      address: ['도로명주소', '전체주소', 'address', 'fulladdress', '주소'],
      detail: ['상세주소', '상세', '동호', '동/호', '동 호', '동', '호'],
      postalCode: ['우편번호', 'postalcode', 'postal_code', 'postcode', 'zip', 'zipcode']
    };
    const norm = (s) => String(s || '').toLowerCase();
    const isMatch = (col, key) => synonyms[key].some(k => norm(col).includes(norm(k)));

    let html = '';
    fields.forEach(field => {
      const selectId = `labelField-${field.key}`;
      html += `
        <div class="field-mapping">
          <label for="${selectId}">${field.label}:</label>
          <select id="${selectId}" data-field="${field.key}">
            <option value="">선택 안함</option>
            ${columns.map(col => `<option value="${col}" ${isMatch(col, field.key) ? 'selected' : ''}>${col}</option>`).join('')}
          </select>
        </div>
      `;
    });

    container.innerHTML = html;
    // 안전장치: 잘못 삽입된 CSS 텍스트 노드 제거
    try {
      Array.from(container.childNodes).forEach(n => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = (n.textContent||'').trim();
          if (t.startsWith('/*') || t.includes('.field-mapping')) {
            container.removeChild(n);
          }
        }
      });
      container.querySelectorAll('pre,code,style').forEach(el => el.remove());
    } catch(_) {}

    // 이벤트 리스너 추가
    container.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', (e) => {
        const field = e.target.getAttribute('data-field');
        const column = e.target.value;
        fieldMappings[field] = column;
      });
    });

    // 초기 매핑 설정
    fields.forEach(field => {
      const select = container.querySelector(`select[data-field="${field.key}"]`);
      if (select && select.value) {
        fieldMappings[field.key] = select.value;
      }
    });
  }

  function generateLabels() {
    if (!labelData || Object.keys(fieldMappings).length === 0) {
      alert('데이터와 필드 매핑을 확인해주세요.');
      return;
    }

    // 데이터 형식 확인
    let dataRows;
    let headers;

    if (Array.isArray(labelData)) {
      // 기존 배열 형식 (샘플 데이터)
      dataRows = labelData;
      headers = labelData.length > 0 ? Object.keys(labelData[0]) : [];
    } else if (labelData.headers && labelData.rows) {
      // 새로운 형식 (API 응답)
      dataRows = labelData.rows;
      headers = labelData.headers;
    } else {
      alert('잘못된 데이터 형식입니다.');
      return;
    }

    if (dataRows.length === 0) {
      alert('생성할 데이터가 없습니다.');
      return;
    }

    // 템플릿별 설정
    const template = document.getElementById('labelTemplate')?.value || '2x9';
    const templateMap = {
      '2x9': { perSheet: 18, sheetClass: 'label-sheet-2x9' },
      '3x7': { perSheet: 21, sheetClass: 'label-sheet-3x7' },
      '4x6': { perSheet: 24, sheetClass: 'label-sheet-4x6' },
    };
    const { perSheet, sheetClass } = templateMap[template] || templateMap['2x9'];

    // 모달용 컨테이너에 렌더링
    const labelSheetContainer = document.getElementById('labelModalSheet');
    if (!labelSheetContainer) {
      alert('라벨 모달 컨테이너를 찾을 수 없습니다.');
      return;
    }
    labelSheetContainer.innerHTML = '';

    const total = dataRows.length;
    const sheetCount = Math.ceil(total / perSheet) || 1;
    let dataIndex = 0;
    const nameSuffix = document.getElementById('nameSuffix')?.value || '';

    for (let s = 0; s < sheetCount; s++) {
      let sheetHtml = '';
      for (let i = 0; i < perSheet; i++) {
        if (dataIndex < total) {
          const rowData = dataRows[dataIndex];
          let name = '', address = '', detail = '', postalCode = '';

          if (typeof rowData === 'object' && !Array.isArray(rowData)) {
            // 객체 형태 (샘플 데이터)
            name = fieldMappings.name ? (rowData[fieldMappings.name] ?? '') : '';
            address = fieldMappings.address ? (rowData[fieldMappings.address] ?? '') : '';
            detail = fieldMappings.detail ? (rowData[fieldMappings.detail] ?? '') : '';
            postalCode = fieldMappings.postalCode ? (rowData[fieldMappings.postalCode] ?? '') : '';
          } else if (Array.isArray(rowData)) {
            // 배열 형태 (API 응답)
            const nameIndex = headers.indexOf(fieldMappings.name);
            const addressIndex = headers.indexOf(fieldMappings.address);
            const detailIndex = headers.indexOf(fieldMappings.detail);
            const postalCodeIndex = headers.indexOf(fieldMappings.postalCode);
            name = nameIndex >= 0 ? (rowData[nameIndex] ?? '') : '';
            address = addressIndex >= 0 ? (rowData[addressIndex] ?? '') : '';
            detail = detailIndex >= 0 ? (rowData[detailIndex] ?? '') : '';
            postalCode = postalCodeIndex >= 0 ? (rowData[postalCodeIndex] ?? '') : '';
          }

          // 길이 기준은 테이블 배치에서도 유지하되 여유 있게 조정
          const addressLines = [];
          if (address) addressLines.push(address);
          if (detail) addressLines.push(detail);
          const displayNameParts = [];
          if (name) displayNameParts.push(name);
          if (nameSuffix) displayNameParts.push(nameSuffix);
          const displayName = displayNameParts.join(' ');
          const combinedAddress = addressLines.join(' ');
          const isLong = combinedAddress.length > 36 || displayName.length > 20 || `${postalCode}`.length > 8;

          const addressBlock = addressLines.length
            ? addressLines.map(line => `<div class="label-address-line">${line}</div>`).join('')
            : '<div class="label-address-line"></div>';

          sheetHtml += `
            <div class="label-item${isLong ? ' long-content' : ''}">
              <div class="label-address-block">
                ${addressBlock}
              </div>
              <div class="label-name-line">${displayName}</div>
              <div class="label-postal-line">${postalCode ?? ''}</div>
            </div>
          `;
          dataIndex++;
        } else {
          // 남는 칸은 빈 셀로 채움
          sheetHtml += `<div class="label-item empty"></div>`;
        }
      }

      const sheet = document.createElement('div');
      sheet.className = `${sheetClass} label-preview`;
      sheet.innerHTML = sheetHtml;
      labelSheetContainer.appendChild(sheet);
    }

    // 모달 표시 + 포커스/배경 비활성화(inert)
    const modal = document.getElementById('labelModal');
    const appContainer = document.querySelector('.container');
    if (appContainer) appContainer.setAttribute('inert', '');
    if (modal) {
      lastFocusedElement = (document.activeElement && document.activeElement.focus) ? document.activeElement : null;
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      // 첫 포커스 대상
      const first = document.getElementById('btnModalClose') || modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (first && first.focus) first.focus();
      // 탭 포커스 트랩
      modalKeydownHandler = (e) => {
        if (e.key !== 'Tab') return;
        const focusables = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
          .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      };
      modal.addEventListener('keydown', modalKeydownHandler);
    }
    document.getElementById('labelPreview').classList.remove('hidden');
  }

  function printLabels() {
    // 인쇄 시 PDF 기본 파일명은 문서 title을 따릅니다.
    const originalTitle = document.title;
    const template = document.getElementById('labelTemplate')?.value || '2x9';
    const id = (typeof currentLabelJobId === 'string' && currentLabelJobId) 
      ? currentLabelJobId 
      : new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const nameSuffix = document.getElementById('nameSuffix')?.value || '';
    const suffix = nameSuffix ? `_${nameSuffix}` : '';
    // 파일명에서 한글/특수문자에 의해 시스템에서 조합형으로 보이는 문제 방지
    // 1) 우선 정상화(NFKD) 후 2) 영숫자, '-', '_'만 남김 3) 과도한 연속 구분자 정리
    const rawTitle = `labels_${template}_${id}${suffix}`;
    const safeTitle = rawTitle
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/-$/g, '')
      .slice(0, 100); // 너무 긴 파일명 방지

    document.title = safeTitle || 'labels';

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
      if (mql) mql.removeListener(beforeAfterHandler);
    };

    // 일부 브라우저 호환성: afterprint 이벤트 + matchMedia
    window.addEventListener('afterprint', restore);
    const mql = window.matchMedia && window.matchMedia('print');
    const beforeAfterHandler = (e) => { if (!e.matches) restore(); };
    if (mql && mql.addListener) mql.addListener(beforeAfterHandler);

    window.print();

    // Fallback: afterprint 미지원 브라우저 대비
    setTimeout(restore, 2000);
  }

  function closeLabelModal() {
    const modal = document.getElementById('labelModal');
    const appContainer = document.querySelector('.container');
    // 먼저 포커스를 모달 밖으로 이동
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      try { lastFocusedElement.focus(); } catch (_) {}
    } else {
      try { document.body.focus(); } catch (_) {}
    }
    if (modal) {
      if (modalKeydownHandler) modal.removeEventListener('keydown', modalKeydownHandler);
      modalKeydownHandler = null;
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (appContainer) appContainer.removeAttribute('inert');
  }

  async function downloadHwpx() {
    try {
      if (!currentLabelJobId) {
        alert('먼저 라벨 데이터를 업로드/처리해 주세요.');
        return;
      }
      const nameSuffix = document.getElementById('nameSuffix')?.value || '';
      const url = `${API_BASE}/file/hwpx/${currentLabelJobId}?nameSuffix=${encodeURIComponent(nameSuffix)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || '다운로드 실패');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `labels_${currentLabelJobId}.hwpx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (e) {
      console.error('HWPX 다운로드 실패:', e);
      alert('HWPX 다운로드 중 오류가 발생했습니다: ' + e.message);
    }
  }

  function downloadPDF() {
    // PDF 생성은 추후 구현
    alert('PDF 다운로드 기능은 준비 중입니다.');
  }

  function resetLabelUI() {
    labelData = null;
    fieldMappings = {};
    
    // 파일 입력 초기화
    const fileInput = document.getElementById('labelFile');
    if (fileInput) fileInput.value = '';
    
    // UI 요소들 숨기기
    document.getElementById('labelUploadProgress').classList.add('hidden');
    document.getElementById('labelDataPreview').classList.add('hidden');
    document.getElementById('labelPreview').classList.add('hidden');
    
    // 내용 초기화
    const tbl = document.getElementById('labelDataTable');
    const fmap = document.getElementById('labelFieldMapping');
    const sheet = document.getElementById('labelSheet');
    const modalSheet = document.getElementById('labelModalSheet');
    if (tbl) tbl.innerHTML = '';
    if (fmap) fmap.innerHTML = '';
    if (sheet) sheet.innerHTML = '';
    if (modalSheet) modalSheet.innerHTML = '';
    const noteEl = document.getElementById('labelPreviewNote');
    if (noteEl) {
      noteEl.textContent = '';
      noteEl.classList.add('hidden');
    }

    // 모달 닫기
    const modal = document.getElementById('labelModal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    const appContainer = document.querySelector('.container');
    if (appContainer) appContainer.removeAttribute('inert');
    
    // 진행 상황 초기화
    updateProgressCard('label', { progress: 0, processed: 0, total: 0, steps: cloneProgressSteps() }, '처리 중...');
    lastLabelStatus = null;
  }

  // Event wiring
  document.addEventListener('DOMContentLoaded', () => {
    // (removed) overly aggressive CSS cleanup that could remove required styles
    // API 바 초기화
    const apiInput = document.getElementById('apiBaseInput');
    if (apiInput) {
      apiInput.value = API_BASE;
    }
    const btnSaveApi = document.getElementById('btnSaveApiBase');
    if (btnSaveApi) btnSaveApi.addEventListener('click', saveApiBase);
    const btnCheckApi = document.getElementById('btnCheckApi');
    if (btnCheckApi) btnCheckApi.addEventListener('click', checkApiHealth);
    // 자동 연결 확인
    checkApiHealth();
    // Tabs
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab, btn);
      });
    });
    // Search button
    document.getElementById('btnSearch').addEventListener('click', searchAddress);
    // Enter to search
    document.getElementById('address').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchAddress();
    });
    // File trigger by clicking area
    const dropArea = document.getElementById('fileDropArea');
    dropArea.addEventListener('click', () => document.getElementById('file').click());
    // File input change
    document.getElementById('file').addEventListener('change', handleFileSelect);
    // Drag & drop
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) uploadFile(files[0]);
    });
    // Delegate buttons inside result (download/reset)
    document.getElementById('uploadResult').addEventListener('click', (e) => {
      const dl = e.target.closest('button[data-download-id]');
      if (dl) {
        downloadFile(dl.getAttribute('data-download-id'));
        return;
      }
      const reset = e.target.closest('button[data-reset-upload]');
      if (reset) {
        resetUploadUI();
        return;
      }
    });
    // Delegate search result reset
    document.getElementById('searchResult').addEventListener('click', (e) => {
      const reset = e.target.closest('button[data-reset-search]');
      if (reset) {
        resetSearchUI();
      }
    });

    // 라벨 관련 이벤트 리스너
    // 라벨 파일 드롭 영역
    const labelDropArea = document.getElementById('labelFileDropArea');
    labelDropArea.addEventListener('click', () => document.getElementById('labelFile').click());
    
    // 라벨 파일 입력
    document.getElementById('labelFile').addEventListener('change', handleLabelFileSelect);
    
    // 라벨 파일 드래그 앤 드롭
    labelDropArea.addEventListener('dragover', (e) => { 
      e.preventDefault(); 
      labelDropArea.classList.add('dragover'); 
    });
    labelDropArea.addEventListener('dragleave', () => labelDropArea.classList.remove('dragover'));
    labelDropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      labelDropArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) processLabelFile(files[0]);
    });
    
    // 라벨 생성 버튼
    document.getElementById('btnGenerateLabels').addEventListener('click', generateLabels);
    
    // 라벨 인쇄 버튼 (기존 영역)
    const btnPrint = document.getElementById('btnPrintLabels');
    if (btnPrint) btnPrint.addEventListener('click', printLabels);
    // 모달 버튼들
    const btnModalPrint = document.getElementById('btnModalPrint');
    if (btnModalPrint) btnModalPrint.addEventListener('click', printLabels);
    const btnModalClose = document.getElementById('btnModalClose');
    if (btnModalClose) btnModalClose.addEventListener('click', closeLabelModal);
    const btnModalReset = document.getElementById('btnModalReset');
    if (btnModalReset) btnModalReset.addEventListener('click', resetLabelUI);
    const modalEl = document.getElementById('labelModal');
    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'labelModal') closeLabelModal();
      });
    }
    
    // HWPX 다운로드 버튼
    const btnHwpx = document.getElementById('btnDownloadHWPX');
    if (btnHwpx) btnHwpx.addEventListener('click', downloadHwpx);
    const btnPdf = document.getElementById('btnDownloadPDF');
    if (btnPdf) btnPdf.addEventListener('click', downloadPDF);
    
    // 라벨 초기화 버튼
    document.getElementById('btnLabelReset').addEventListener('click', resetLabelUI);
    
    // 샘플 데이터 로드 버튼
    document.getElementById('btnLoadSampleData').addEventListener('click', () => {
      lastLabelStatus = null;
      labelData = generateSampleData();
      showLabelDataPreview();
    });
  });
})();
