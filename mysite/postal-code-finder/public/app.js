(() => {
  const API_BASE = `${window.location.origin}/api`;
  
  // 라벨 관련 전역 변수
  let labelData = null;
  let fieldMappings = {};
  let currentLabelJobId = null;

  function switchTab(tabName, clickedButton) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');
    document.getElementById(tabName).classList.add('active');
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
    updateProgress(0, '파일 업로드 및 처리 중...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/file/upload`, { method: 'POST', body: formData });
      
      // 응답 헤더 확인
      const contentType = response.headers.get('content-type') || '';
      const contentDisposition = response.headers.get('content-disposition') || '';

      // 첨부파일 다운로드 응답인지 우선 확인
      const looksLikeFile = /attachment/i.test(contentDisposition) ||
                            /application\/(vnd\.openxmlformats-officedocument|octet-stream)/i.test(contentType);

      // JSON 파싱 시도 (clone 사용, 실패 시 파일로 처리)
      let parsedJson = null;
      let isJson = /application\/json/i.test(contentType);
      if (!looksLikeFile) {
        try {
          parsedJson = await response.clone().json();
          isJson = true;
        } catch (_) {
          isJson = false;
        }
      }

      if (isJson && parsedJson) {
        // JSON 응답 (처리 결과)
        const data = parsedJson;
        progressDiv.classList.add('hidden');
        
        if (data.success) {
          if (data.data && data.data.jobId) {
            currentLabelJobId = data.data.jobId;
          }
          showResult(resultDiv, `
            <h3>✅ 파일 처리가 완료되었습니다!</h3>
            <p><strong>처리된 행:</strong> ${data.data.processed}개</p>
            <p><strong>성공:</strong> ${data.data.successful}개</p>
            <p><strong>실패:</strong> ${data.data.failed}개</p>
            <div style="margin-top:12px">
              <p>❌ 직접 다운로드 기능이 실패했습니다. 결과 데이터:</p>
              <button class="btn" data-reset-upload>↩️ 초기화</button>
            </div>
          `, 'success');
        } else {
          showResult(resultDiv, `
            ❌ ${data.error}
            <div style="margin-top:12px">
              <button class="btn" data-reset-upload>↩️ 초기화</button>
            </div>
          `, 'error');
        }
      } else {
        // 파일 다운로드 응답
        progressDiv.classList.add('hidden');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `postal_result_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showResult(resultDiv, `
          <h3>✅ 파일 처리 및 다운로드 완료!</h3>
          <p><strong>파일:</strong> ${file.name}</p>
          <p><strong>처리:</strong> 최대 200개 행 처리됨 (중복 제거 포함)</p>
          <p><strong>결과:</strong> 우편번호가 추가된 엑셀 파일이 다운로드되었습니다</p>
          <p><strong>📊 중복 주소가 자동으로 제거되었습니다</strong></p>
          <div style="margin-top:12px">
            <button class="btn" data-reset-upload>↩️ 초기화</button>
          </div>
        `, 'success');
      }
      
    } catch (error) {
      progressDiv.classList.add('hidden');
      showResult(resultDiv, `
        ❌ 업로드 중 오류가 발생했습니다: ${error.message}
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
        updateProgress(status.progress, `처리 중... (${status.processed}/${status.total})`);
        if (status.status === 'completed') {
          document.getElementById('uploadProgress').classList.add('hidden');
          showResult(document.getElementById('uploadResult'), `
            <h3>✅ 파일 처리가 완료되었습니다!</h3>
            <p><strong>처리된 행:</strong> ${status.processed}개</p>
            <p><strong>오류 행:</strong> ${status.errors?.length || 0}개</p>
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

  function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text;
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

    console.log('파일 처리 시작:', file.name);
    
    // 진행 상황 표시
    document.getElementById('labelUploadProgress').classList.remove('hidden');
    updateLabelProgress(0, '파일 업로드 중...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('API 호출:', `${API_BASE}/file/upload?mode=label`);
      const response = await fetch(`${API_BASE}/file/upload?mode=label`, { method: 'POST', body: formData });
      
      // 응답 헤더 확인
      const contentType = response.headers.get('content-type') || '';
      const contentDisposition = response.headers.get('content-disposition') || '';
      
      // 첨부파일 다운로드 응답인지 우선 확인
      const looksLikeFile = /attachment/i.test(contentDisposition) ||
                            /application\/(vnd\.openxmlformats-officedocument|octet-stream)/i.test(contentType);

      // JSON 파싱 시도 (clone 사용, 실패 시 파일로 처리)
      let parsedJson = null;
      let isJson = /application\/json/i.test(contentType);
      if (!looksLikeFile) {
        try {
          parsedJson = await response.clone().json();
          isJson = true;
        } catch (_) {
          isJson = false;
        }
      }

      if (isJson && parsedJson) {
        // JSON 응답 (처리 결과)
        const data = parsedJson;
        console.log('서버 응답:', data);
        
        if (data.success) {
          const jobId = data.data.jobId;
          currentLabelJobId = jobId;
          console.log('JobID:', jobId);
          updateLabelProgress(10, '파일 처리 중...');
          await waitForLabelProcessing(jobId);
        } else {
          document.getElementById('labelUploadProgress').classList.add('hidden');
          alert('파일 업로드 실패: ' + data.error);
        }
      } else {
        // 파일 다운로드 응답
        document.getElementById('labelUploadProgress').classList.add('hidden');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `postal_result_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✅ 라벨 파일 다운로드 완료');
        alert('파일 처리 및 다운로드가 완료되었습니다!');
        
        // 샘플 데이터로 라벨 미리보기 생성
        labelData = generateSampleData();
        showLabelDataPreview();
      }
    } catch (error) {
      console.error('파일 처리 오류:', error);
      document.getElementById('labelUploadProgress').classList.add('hidden');
      alert('파일 처리 중 오류가 발생했습니다: ' + error.message);
      
      // 오류 발생 시 샘플 데이터로 대체
      console.log('샘플 데이터로 대체');
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
        updateLabelProgress(status.progress, `처리 중... (${status.processed}/${status.total})`);
        
        if (status.status === 'completed') {
          updateLabelProgress(100, '처리 완료!');
          document.getElementById('labelUploadProgress').classList.add('hidden');
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
      alert('상태 확인 중 오류: ' + error.message);
    }
  }

  function updateLabelProgress(percent, text) {
    document.getElementById('labelProgressFill').style.width = percent + '%';
    document.getElementById('labelProgressText').textContent = text;
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

    // 데이터 테이블 생성
    const tableHtml = createDataTable(displayData, columns);
    document.getElementById('labelDataTable').innerHTML = tableHtml;

    // 필드 매핑 UI 생성
    createFieldMappings(columns);

    // 미리보기 영역 표시
    document.getElementById('labelDataPreview').classList.remove('hidden');
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
      { key: 'postalCode', label: '우편번호' }
    ];

    let html = '';
    fields.forEach(field => {
      html += `
        <div class="field-mapping">
          <label>${field.label}:</label>
          <select data-field="${field.key}">
            <option value="">선택 안함</option>
            ${columns.map(col => `<option value="${col}" ${col.toLowerCase().includes(field.key.toLowerCase()) ? 'selected' : ''}>${col}</option>`).join('')}
          </select>
        </div>
      `;
    });

    container.innerHTML = html;

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
      if (select.value) {
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

    const labelSheet = document.getElementById('labelSheet');
    let html = '';

    const perPage = 18; // 2열 × 9행
    const total = dataRows.length;
    const totalPages = Math.ceil(total / perPage) || 1;

    for (let p = 0; p < totalPages; p++) {
      html += '<div class="label-page">';
      const start = p * perPage;
      const end = Math.min(start + perPage, total);
      for (let i = start; i < end; i++) {
        const rowData = dataRows[i];
        let name = '', address = '', postalCode = '';
        if (typeof rowData === 'object' && !Array.isArray(rowData)) {
          name = fieldMappings.name ? rowData[fieldMappings.name] || '' : '';
          address = fieldMappings.address ? rowData[fieldMappings.address] || '' : '';
          postalCode = fieldMappings.postalCode ? rowData[fieldMappings.postalCode] || '' : '';
        } else if (Array.isArray(rowData)) {
          const nameIndex = headers.indexOf(fieldMappings.name);
          const addressIndex = headers.indexOf(fieldMappings.address);
          const postalCodeIndex = headers.indexOf(fieldMappings.postalCode);
          name = nameIndex >= 0 ? rowData[nameIndex] || '' : '';
          address = addressIndex >= 0 ? rowData[addressIndex] || '' : '';
          postalCode = postalCodeIndex >= 0 ? rowData[postalCodeIndex] || '' : '';
        }
        const nameSuffix = document.getElementById('nameSuffix')?.value || '';
        if (name && nameSuffix) {
          name = name + ' ' + nameSuffix;
        }
        
        // 절대 위치 계산: 2열 × 9행 레이아웃
        const labelIndex = i - start;
        const row = Math.floor(labelIndex / 2); // 0부터 시작
        const col = labelIndex % 2; // 0 또는 1
        
        // 좌표 계산 (mm 단위)
        // 첫 번째 컬럼: left = 0mm
        // 두 번째 컬럼: left = 100mm + 3mm = 103mm
        const left = col === 0 ? '0mm' : '103mm';
        // 각 행: top = row * 30mm
        const top = (row * 30) + 'mm';
        
        html += `
          <div class="label-item" style="left: ${left}; top: ${top};">
            <div class="address">${address}</div>
            <div class="name">${name}</div>
            <div class="postal-code">${postalCode}</div>
          </div>
        `;
      }
      const remaining = perPage - (end - start);
      for (let k = 0; k < remaining && remaining < perPage; k++) {
        const labelIndex = (end - start) + k;
        const row = Math.floor(labelIndex / 2); // 0부터 시작
        const col = labelIndex % 2; // 0 또는 1
        
        const left = col === 0 ? '0mm' : '103mm';
        const top = (row * 30) + 'mm';
        
        html += `<div class="label-item empty" style="left: ${left}; top: ${top};"></div>`;
      }
      html += '</div>';
    }

    labelSheet.innerHTML = html;
    document.getElementById('labelPreview').classList.remove('hidden');
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
    document.getElementById('labelDataTable').innerHTML = '';
    document.getElementById('labelFieldMapping').innerHTML = '';
    document.getElementById('labelSheet').innerHTML = '';
    
    // 진행 상황 초기화
    updateLabelProgress(0, '처리 중...');
  }

  // Event wiring
  document.addEventListener('DOMContentLoaded', () => {
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
    
    // HWPX 다운로드 버튼
    document.getElementById('btnDownloadHWPX').addEventListener('click', downloadHwpx);
    
    // PDF 다운로드 버튼
    document.getElementById('btnDownloadPDF').addEventListener('click', downloadPDF);
    
    // 라벨 초기화 버튼
    document.getElementById('btnLabelReset').addEventListener('click', resetLabelUI);
    
    // 샘플 데이터 로드 버튼
    document.getElementById('btnLoadSampleData').addEventListener('click', () => {
      labelData = generateSampleData();
      showLabelDataPreview();
    });
  });
})();
