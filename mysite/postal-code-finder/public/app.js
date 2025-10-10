(() => {
  // API 엔드포인트 자동 결정: window.API_BASE > localStorage.API_BASE > 동일 오리진('/api') > localhost:3001
  const API_BASE = (() => {
    try {
      if (window.API_BASE) return window.API_BASE.replace(/\/$/, '');
      const stored = window.localStorage && window.localStorage.getItem('API_BASE');
      if (stored) return stored.replace(/\/$/, '');
      if (window.location && window.location.origin) {
        const proto = String(window.location.protocol || '').toLowerCase();
        if (proto.startsWith('http')) return `${window.location.origin}/api`;
      }
    } catch (_) {}
    return 'http://localhost:3001/api';
  })();
  if (String(window.location.protocol).toLowerCase().startsWith('file')) {
    console.warn('[App] file:// 로 열렸습니다. localStorage.API_BASE를 설정하세요. 예) localStorage.setItem(\'API_BASE\', \'http://localhost:3005/api\')');
  }
  console.log('[App] Using API_BASE:', API_BASE);

  // API 상태 표시
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
      if (dot) dot.classList.add('ok');
      if (text) text.textContent = `연결됨 (${new URL(API_BASE).origin})`;
      return true;
    } catch (e) {
      if (dot) dot.classList.add('fail');
      if (text) text.textContent = `연결 실패: ${e.message}`;
      return false;
    }
  }
  function saveApiBase() {
    const input = document.getElementById('apiBaseInput');
    const val = (input?.value || '').trim();
    if (!val) { window.localStorage.removeItem('API_BASE'); }
    else { window.localStorage.setItem('API_BASE', val); }
    window.location.reload();
  }


  // 라벨 상태
  let labelData = null;
  let fieldMappings = {};
  let currentLabelJobId = null;
  // 모달 포커스 관리
  let lastFocusedElement = null;
  let modalKeydownHandler = null;

  function switchTab(tabName, clickedButton) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    if (tabName === 'label') {
      const upProg = document.getElementById('uploadProgress');
      const upRes = document.getElementById('uploadResult');
      if (upProg) upProg.classList.add('hidden');
      if (upRes) { upRes.classList.add('hidden'); upRes.innerHTML=''; }
    } else if (tabName === 'upload') {
      const lp = document.getElementById('labelUploadProgress');
      const ldp = document.getElementById('labelDataPreview');
      const lpv = document.getElementById('labelPreview');
      if (lp) lp.classList.add('hidden');
      if (ldp) ldp.classList.add('hidden');
      if (lpv) lpv.classList.add('hidden');
    }
  }

  function showResult(element, html, type) {
    element.innerHTML = html;
    element.className = `result ${type}`;
    element.classList.remove('hidden');
  }

  async function searchAddress() {
    const address = document.getElementById('address').value.trim();
    const resultDiv = document.getElementById('searchResult');
    if (!address) { showResult(resultDiv, '주소를 입력해주세요.', 'error'); return; }
    if (address.length < 2) { showResult(resultDiv, '주소는 2자 이상 입력해주세요.', 'error'); return; }
    try {
      const response = await fetch(`${API_BASE}/address/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
      const data = await response.json();
      if (response.ok && data.success) {
        const r = data.data;
        showResult(resultDiv, `
          <h3>✅ 우편번호를 찾았습니다!</h3>
          <p><strong>우편번호:</strong> ${r.postalCode}</p>
          <p><strong>전체 주소:</strong> ${r.fullAddress}</p>
          <p><strong>시/도:</strong> ${r.sido}</p>
          <p><strong>시/군/구:</strong> ${r.sigungu}</p>
          <div style="margin-top:12px"><button class="btn" data-reset-search>↩️ 초기화</button></div>
        `, 'success');
      } else {
        const msg = data.error || '알 수 없는 오류가 발생했습니다.';
        showResult(resultDiv, `❌ ${msg}<div style="margin-top:12px"><button class="btn" data-reset-search>↩️ 초기화</button></div>`, 'error');
      }
    } catch (e) {
      showResult(resultDiv, `❌ 서버 연결 오류: ${e.message}<div style="margin-top:12px"><button class="btn" data-reset-search>↩️ 초기화</button></div>`, 'error');
    }
  }

  function handleFileSelect(e) { const f = e.target.files[0]; if (f) uploadFile(f); }
  function handleLabelFileSelect(e) { const f = e.target.files[0]; if (f) uploadLabelFile(f); }

  async function uploadFile(file) {
    const progressDiv = document.getElementById('uploadProgress');
    const resultDiv = document.getElementById('uploadResult');
    if (!file.name.match(/\.(xls|xlsx)$/i)) { showResult(resultDiv, '❌ 엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showResult(resultDiv, '❌ 파일 크기는 10MB 이하여야 합니다.', 'error'); return; }
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE}/file/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) {
        const jobId = data.data.jobId; currentLabelJobId = jobId; checkProgress(jobId);
      } else {
        progressDiv.classList.add('hidden');
        showResult(resultDiv, `❌ ${data.error}<div style="margin-top:12px"><button class="btn" data-reset-upload>↩️ 초기화</button></div>`, 'error');
      }
    } catch (e) {
      progressDiv.classList.add('hidden');
      showResult(resultDiv, `❌ 업로드 중 오류가 발생했습니다.<div style="margin-top:12px"><button class="btn" data-reset-upload>↩️ 초기화</button></div>`, 'error');
    }
  }

  // 라벨 업로드 전용 흐름 (라벨 탭의 진행률/미리보기 UI를 사용)
  async function uploadLabelFile(file) {
    // 확장자/크기 검사
    if (!file.name.match(/\.(xls|xlsx)$/i)) { alert('엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('파일 크기는 10MB 이하여야 합니다.'); return; }

    // 라벨 진행바 표시
    // 다른 진행바/결과는 숨김 보장
    const upProg = document.getElementById('uploadProgress');
    const upRes = document.getElementById('uploadResult');
    if (upProg) upProg.classList.add('hidden');
    if (upRes) { upRes.classList.add('hidden'); upRes.innerHTML=''; }

    const prog = document.getElementById('labelUploadProgress');
    prog.classList.remove('hidden');
    updateLabelProgress(0, '파일 업로드 중...');

    try {
      const formData = new FormData(); formData.append('file', file);
      const response = await fetch(`${API_BASE}/file/upload?mode=label`, { 
        method: 'POST', 
        headers: { 'x-label-mode': '1', 'Accept': 'application/json' },
        body: formData 
      });

      // 응답 헤더 확인 (파일/JSON 분기)
      const contentType = response.headers.get('content-type') || '';
      let data = null;
      if (/application\/json/i.test(contentType)) {
        try { data = await response.json(); } catch (_) { data = null; }
      } else {
        // 일부 환경에서 content-type이 잘못 설정될 수 있으므로 텍스트 후 JSON 재시도
        try { const txt = await response.text(); data = JSON.parse(txt); } catch { data = null; }
      }

      if (data && data.success && data.data && data.data.jobId) {
        currentLabelJobId = data.data.jobId;
        updateLabelProgress(10, '파일 처리 중...');
        await waitForLabelProcessingLabel(currentLabelJobId);
      } else {
        prog.classList.add('hidden');
        alert('라벨 업로드 실패: 서버가 라벨 모드(JSON) 응답을 반환하지 않았습니다. 관리자에게 문의해 주세요.');
      }
    } catch (e) {
      prog.classList.add('hidden');
      alert('라벨 파일 처리 중 오류가 발생했습니다: ' + e.message);
    }
  }

  async function waitForLabelProcessingLabel(jobId){
    try {
      const res = await fetch(`${API_BASE}/file/status/${jobId}`);
      const data = await res.json();
      if (data.success){
        const st = data.data;
        updateLabelProgress(st.progress, `처리 중... (${st.processed}/${st.total})`);
        if (st.status === 'completed'){
          updateLabelProgress(100, '처리 완료!');
          document.getElementById('labelUploadProgress').classList.add('hidden');
          await loadLabelData(jobId);
        } else if (st.status === 'processing'){
          setTimeout(()=>waitForLabelProcessingLabel(jobId), 1200);
        } else {
          document.getElementById('labelUploadProgress').classList.add('hidden');
          alert('파일 처리 실패: ' + (st.error || ''));
        }
      }
    } catch (e){
      document.getElementById('labelUploadProgress').classList.add('hidden');
      alert('상태 확인 중 오류: ' + e.message);
    }
  }

  async function checkProgress(jobId) {
    try {
      const res = await fetch(`${API_BASE}/file/status/${jobId}`);
      const data = await res.json();
      if (data.success) {
        const st = data.data; updateProgress(st.progress, `처리 중... (${st.processed}/${st.total})`);
        if (st.status === 'completed') {
          document.getElementById('uploadProgress').classList.add('hidden');
          showResult(document.getElementById('uploadResult'), `
            <h3>✅ 파일 처리가 완료되었습니다!</h3>
            <p><strong>처리된 행:</strong> ${st.processed}개</p>
            <p><strong>오류 행:</strong> ${st.errors?.length || 0}개</p>
            <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" data-reset-upload>↩️ 초기화</button>
            </div>
          `, 'success');
        } else if (st.status === 'error') {
          document.getElementById('uploadProgress').classList.add('hidden');
          showResult(document.getElementById('uploadResult'), `❌ ${st.error}<div style="margin-top:12px"><button class="btn" data-reset-upload>↩️ 초기화</button></div>`, 'error');
        } else { setTimeout(()=>checkProgress(jobId), 2000); }
      }
    } catch (e) {
      document.getElementById('uploadProgress').classList.add('hidden');
      showResult(document.getElementById('uploadResult'), `❌ 상태 확인 중 오류가 발생했습니다.<div style="margin-top:12px"><button class="btn" data-reset-upload>↩️ 초기화</button></div>`, 'error');
    }
  }
  function updateProgress(p, t){ document.getElementById('progressFill').style.width = p + '%'; document.getElementById('progressText').textContent = t; }

  // 라벨 데이터 로딩/미리보기
  async function loadLabelData(jobId){
    try {
      const res = await fetch(`${API_BASE}/file/label-data/${jobId}`);
      const data = await res.json();
      if (data.success){ labelData = { headers: data.data.headers, rows: data.data.rows }; showLabelDataPreview(); }
      else throw new Error(data.error || '데이터 로드 실패');
    } catch (e){ alert('데이터 로드 실패: ' + e.message); }
  }

  function generateSampleData(){ return [
    { name: '홍길동', address: '서울특별시 강남구 테헤란로 123', detail: '101동 202호', postalCode: '06158' },
    { name: '김영희', address: '서울특별시 서초구 반포대로 45', detail: '301동 1203호', postalCode: '06543' }
  ]; }

  function showLabelDataPreview(){
    if (!labelData){ alert('데이터가 없습니다.'); return; }
    let displayData, columns;
    if (Array.isArray(labelData)){ if (labelData.length===0){ alert('데이터가 없습니다.'); return; } displayData = labelData; columns = Object.keys(labelData[0]); }
    else if (labelData.headers && labelData.rows){ if (labelData.rows.length===0){ alert('데이터가 없습니다.'); return; } displayData = labelData.rows; columns = labelData.headers; }
    else { alert('잘못된 데이터 형식입니다.'); return; }
    const previewColumns = dedupePreviewColumns(columns, displayData);
    document.getElementById('labelDataTable').innerHTML = createDataTable(displayData, previewColumns);
    createFieldMappings(previewColumns);
    document.getElementById('labelDataPreview').classList.remove('hidden');
  }

  function dedupePreviewColumns(columns, data){
    if (!Array.isArray(columns) || columns.length===0) return columns||[];
    const lower = s=>String(s||'').toLowerCase(); const norm = s=>lower(s).replace(/[\s_]/g,'');
    const groups = { postal: ['우편번호','postalcode','postal_code','postcode','zip','zipcode'], address: ['도로명주소','address','fulladdress','전체주소','주소'], name: ['성명','이름','name'] };
    const inGroup = (c, ks)=> ks.includes(norm(c));
    const sameValues=(a,b)=>{ for(let i=0;i<Math.min(10,data.length);i++){ const row=data[i]; const va=(typeof row==='object'&&!Array.isArray(row))?row[a]:row[columns.indexOf(a)]; const vb=(typeof row==='object'&&!Array.isArray(row))?row[b]:row[columns.indexOf(b)]; if((va||'')!==(vb||'')) return false; } return true; };
    const preferOrder={ name:['성명','이름','name'], address:['도로명주소','address','fullAddress','전체주소','주소'], postal:['우편번호','postalCode','postal_code','postcode','zip','zipcode'] };
    const chosen=new Set(); let keptName=null, keptAddress=null, keptPostal=null;
    { const cands=columns.filter(c=>inGroup(c,groups.name)); if(cands.length){ const ordered=preferOrder.name.map(k=>cands.find(c=>norm(c)===norm(k))).filter(Boolean).concat(cands.filter(c=>!preferOrder.name.some(k=>norm(k)===norm(c)))); keptName=ordered[0]||cands[0]; if(keptName) chosen.add(keptName);} }
    ['address','postal'].forEach(g=>{ const cands=columns.filter(c=>inGroup(c,groups[g])); if(cands.length===0) return; let kept=null; const ordered=preferOrder[g].map(k=>cands.find(c=>norm(c)===norm(k))).filter(Boolean).concat(cands.filter(c=>!preferOrder[g].some(k=>norm(k)===norm(c)))); for(const col of ordered){ if(!kept){ kept=col; continue;} if(!sameValues(kept,col)){ continue; } } if(kept){ if(g==='address') keptAddress=kept; else keptPostal=kept; chosen.add(kept);} });
    const out=[]; if(keptName) out.push(keptName); if(keptAddress) out.push(keptAddress); if(keptPostal) out.push(keptPostal);
    columns.forEach(c=>{ if(out.includes(c)) return; if(inGroup(c,groups.address)) return; if(inGroup(c,groups.postal)) return; out.push(c); });
    return out.length?out:columns;
  }

  function createDataTable(data, columns){ if(!data||data.length===0) return '<p>데이터가 없습니다.</p>';
    if(!columns&&data[0]) columns=Object.keys(data[0]);
    let html='<table style="width: 100%; border-collapse: collapse;">'; html+='<thead><tr>';
    columns.forEach(col=>{ html+=`<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${col}</th>`; });
    html+='</tr></thead><tbody>'; data.slice(0,5).forEach(row=>{ html+='<tr>'; columns.forEach((col,idx)=>{ const v=(typeof row==='object'&&!Array.isArray(row))?row[col]:row[idx]; html+=`<td style=\"border: 1px solid #ddd; padding: 8px;\">${v||''}</td>`; }); html+='</tr>'; }); html+='</tbody></table>';
    if(data.length>5) html+=`<p style="margin-top: 10px; color: #666;">총 ${data.length}개 행 (5개만 표시)</p>`; return html; }

  function createFieldMappings(columns){
    const container=document.getElementById('labelFieldMapping');
    const fields=[ {key:'name',label:'이름'}, {key:'address',label:'주소'}, {key:'detail',label:'상세주소'}, {key:'postalCode',label:'우편번호'} ];
    const rowStyle = 'display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:16px 24px;margin:10px 0 14px 0';
    const lblStyle = 'min-width:120px;font-weight:600;';
    const selStyle = 'padding:8px 10px;border:1px solid #ddd;border-radius:6px;min-width:200px;background:#fff;';
    let html=''; fields.forEach(f=>{ html+=`<div class="field-mapping" style="${rowStyle}"><label style="${lblStyle}">${f.label}:</label><select data-field="${f.key}" style="${selStyle}"><option value="">선택 안함</option>${columns.map(col=>`<option value="${col}" ${col.toLowerCase().includes(f.key.toLowerCase())?'selected':''}>${col}</option>`).join('')}</select></div>`; });
    container.innerHTML=html;
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
    // 동의어 기반 자동 매핑 보강
    try {
      const synonyms = {
        name: ['성명','이름','name'],
        address: ['도로명주소','전체주소','address','fulladdress','주소'],
        detail: ['상세주소','상세','동호','동/호','동 호','동','호'],
        postalCode: ['우편번호','postalcode','postal_code','postcode','zip','zipcode']
      };
      const norm = s => String(s||'').toLowerCase();
      const best = (cols, keys) => {
        for (const k of keys) {
          const nk = norm(k);
          const hit = cols.find(c => norm(c).includes(nk));
          if (hit) return hit;
        }
        return '';
      };
      container.querySelectorAll('select').forEach(sel => {
        const key = sel.getAttribute('data-field');
        if (!sel.value) {
          const pick = best(columns, synonyms[key] || []);
          if (pick) sel.value = pick;
        }
      });
    } catch(_) {}
    container.querySelectorAll('select').forEach(sel=>{ sel.addEventListener('change',(e)=>{ const field=e.target.getAttribute('data-field'); const column=e.target.value; fieldMappings[field]=column; }); });
    fields.forEach(f=>{ const sel=container.querySelector(`select[data-field="${f.key}"]`); if(sel&&sel.value){ fieldMappings[f.key]=sel.value; } });
  }

  function generateLabels(){
    if(!labelData||Object.keys(fieldMappings).length===0){ alert('데이터와 필드 매핑을 확인해주세요.'); return; }
    let dataRows, headers; if(Array.isArray(labelData)){ dataRows=labelData; headers=labelData.length>0?Object.keys(labelData[0]):[]; }
    else if(labelData.headers&&labelData.rows){ dataRows=labelData.rows; headers=labelData.headers; }
    else{ alert('잘못된 데이터 형식입니다.'); return; }
    if(dataRows.length===0){ alert('생성할 데이터가 없습니다.'); return; }

    const template=document.getElementById('labelTemplate')?.value||'2x9';
    const templateMap={ '2x9':{perSheet:18,sheetClass:'label-sheet-2x9'}, '3x7':{perSheet:21,sheetClass:'label-sheet-3x7'}, '4x6':{perSheet:24,sheetClass:'label-sheet-4x6'} };
    const { perSheet, sheetClass }=templateMap[template]||templateMap['2x9'];

    const sheetContainer=document.getElementById('labelModalSheet'); if(!sheetContainer){ alert('라벨 모달 컨테이너를 찾을 수 없습니다.'); return; } sheetContainer.innerHTML='';
    const total=dataRows.length; const sheetCount=Math.ceil(total/perSheet)||1; let dataIndex=0; const nameSuffix=document.getElementById('nameSuffix')?.value||'';
    for(let s=0;s<sheetCount;s++){
      let sheetHtml=''; for(let i=0;i<perSheet;i++){
        if(dataIndex<total){ const row=dataRows[dataIndex]; let name='',address='',detail='',postalCode='';
          if(typeof row==='object'&&!Array.isArray(row)){ name=fieldMappings.name? (row[fieldMappings.name]??''):''; address=fieldMappings.address? (row[fieldMappings.address]??''):''; detail=fieldMappings.detail? (row[fieldMappings.detail]??''):''; postalCode=fieldMappings.postalCode? (row[fieldMappings.postalCode]??''):''; }
          else if(Array.isArray(row)){ const nameIdx=headers.indexOf(fieldMappings.name); const addrIdx=headers.indexOf(fieldMappings.address); const detIdx=headers.indexOf(fieldMappings.detail); const pcIdx=headers.indexOf(fieldMappings.postalCode); name=nameIdx>=0?(row[nameIdx]??''):''; address=addrIdx>=0?(row[addrIdx]??''):''; detail=detIdx>=0?(row[detIdx]??''):''; postalCode=pcIdx>=0?(row[pcIdx]??''):''; }
          if(name&&nameSuffix) name = name + ' ' + nameSuffix;
          const isLong = `${address}`.length>25 || `${name}`.length>18 || `${detail}`.length>20;
          sheetHtml += `<div class="label-item${isLong?' long-content':''}"><div class="label-address">${address??''}</div>${detail?`<div class=\"label-detail\">${detail}</div>`:''}<div class="label-name">${name??''}</div><div class="label-postal-code">${postalCode??''}</div></div>`;
          dataIndex++;
        } else { sheetHtml += `<div class="label-item empty"></div>`; }
      }
      const sheet=document.createElement('div'); sheet.className=`${sheetClass} label-preview`; sheet.innerHTML=sheetHtml; sheetContainer.appendChild(sheet);
    }
    // 모달 표시 + 포커스/배경 비활성화(inert)
    const modal=document.getElementById('labelModal'); const appContainer=document.querySelector('.container'); if(appContainer) appContainer.setAttribute('inert','');
    if(modal){ lastFocusedElement=(document.activeElement&&document.activeElement.focus)?document.activeElement:null; modal.classList.add('active'); modal.setAttribute('aria-hidden','false'); const first=document.getElementById('btnModalClose')||modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if(first&&first.focus) first.focus(); modalKeydownHandler=(e)=>{ if(e.key!=='Tab') return; const focusables=Array.from(modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hasAttribute('disabled')&&el.offsetParent!==null); if(focusables.length===0) return; const firstEl=focusables[0]; const lastEl=focusables[focusables.length-1]; if(e.shiftKey){ if(document.activeElement===firstEl){ e.preventDefault(); lastEl.focus(); } } else { if(document.activeElement===lastEl){ e.preventDefault(); firstEl.focus(); } } }; modal.addEventListener('keydown', modalKeydownHandler); }
    document.getElementById('labelPreview').classList.remove('hidden');
  }

  function printLabels(){
    const originalTitle=document.title; const template=document.getElementById('labelTemplate')?.value||'2x9';
    const id=(typeof currentLabelJobId==='string'&&currentLabelJobId)?currentLabelJobId:new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
    const nameSuffix=document.getElementById('nameSuffix')?.value||''; const suffix=nameSuffix?`_${nameSuffix}`:''; document.title=`labels_${template}_${id}${suffix}`;
    const restore=()=>{ document.title=originalTitle; window.removeEventListener('afterprint', restore); if(mql) mql.removeListener(beforeAfterHandler); };
    window.addEventListener('afterprint', restore); const mql=window.matchMedia&&window.matchMedia('print'); const beforeAfterHandler=(e)=>{ if(!e.matches) restore(); }; if(mql&&mql.addListener) mql.addListener(beforeAfterHandler); window.print(); setTimeout(restore,2000);
  }

  function closeLabelModal(){
    const modal=document.getElementById('labelModal'); const appContainer=document.querySelector('.container');
    if(lastFocusedElement&&document.contains(lastFocusedElement)){ try{ lastFocusedElement.focus(); }catch(_){} } else { try{ document.body.focus(); }catch(_){} }
    if(modal){ if(modalKeydownHandler) modal.removeEventListener('keydown', modalKeydownHandler); modalKeydownHandler=null; modal.classList.remove('active'); modal.setAttribute('aria-hidden','true'); }
    if(appContainer) appContainer.removeAttribute('inert');
  }

  function resetUploadUI(){ const fileInput=document.getElementById('file'); if(fileInput) fileInput.value=''; const progressDiv=document.getElementById('uploadProgress'); progressDiv.classList.add('hidden'); document.getElementById('progressFill').style.width='0%'; document.getElementById('progressText').textContent='처리 중...'; const resultDiv=document.getElementById('uploadResult'); resultDiv.classList.add('hidden'); resultDiv.innerHTML=''; }
  function resetSearchUI(){ const input=document.getElementById('address'); if(input) input.value=''; const resultDiv=document.getElementById('searchResult'); resultDiv.classList.add('hidden'); resultDiv.innerHTML=''; input&&input.focus(); }
  function updateLabelProgress(p,t){ document.getElementById('labelProgressFill').style.width=p+'%'; document.getElementById('labelProgressText').textContent=t; }

  function resetLabelUI(){ labelData=null; fieldMappings={}; const fileInput=document.getElementById('labelFile'); if(fileInput) fileInput.value=''; document.getElementById('labelUploadProgress').classList.add('hidden'); document.getElementById('labelDataPreview').classList.add('hidden'); document.getElementById('labelPreview').classList.add('hidden'); const tbl=document.getElementById('labelDataTable'); const fmap=document.getElementById('labelFieldMapping'); const sheet=document.getElementById('labelSheet'); const modalSheet=document.getElementById('labelModalSheet'); if(tbl) tbl.innerHTML=''; if(fmap) fmap.innerHTML=''; if(sheet) sheet.innerHTML=''; if(modalSheet) modalSheet.innerHTML=''; const modal=document.getElementById('labelModal'); if(modal){ modal.classList.remove('active'); modal.setAttribute('aria-hidden','true'); } const appContainer=document.querySelector('.container'); if(appContainer) appContainer.removeAttribute('inert'); updateLabelProgress(0,'처리 중...'); }

  // Wire events
  document.addEventListener('DOMContentLoaded', ()=>{
    // (removed) overly aggressive CSS cleanup that could remove required styles
    const apiInput=document.getElementById('apiBaseInput'); if(apiInput) apiInput.value=API_BASE;
    const btnSaveApi=document.getElementById('btnSaveApiBase'); if(btnSaveApi) btnSaveApi.addEventListener('click', saveApiBase);
    const btnCheckApi=document.getElementById('btnCheckApi'); if(btnCheckApi) btnCheckApi.addEventListener('click', checkApiHealth);
    checkApiHealth();
    document.querySelectorAll('.tab').forEach(btn=>{ btn.addEventListener('click',()=>{ const tab=btn.getAttribute('data-tab'); switchTab(tab, btn); }); });
    document.getElementById('btnSearch').addEventListener('click', searchAddress);
    document.getElementById('address').addEventListener('keypress', (e)=>{ if(e.key==='Enter') searchAddress(); });
    const dropArea=document.getElementById('fileDropArea'); dropArea.addEventListener('click', ()=>document.getElementById('file').click());
    document.getElementById('file').addEventListener('change', handleFileSelect);
    dropArea.addEventListener('dragover', (e)=>{ e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea.addEventListener('dragleave', ()=>dropArea.classList.remove('dragover'));
    dropArea.addEventListener('drop', (e)=>{ e.preventDefault(); dropArea.classList.remove('dragover'); const files=e.dataTransfer.files; if(files.length>0) uploadFile(files[0]); });
    document.getElementById('uploadResult').addEventListener('click',(e)=>{ const reset=e.target.closest('button[data-reset-upload]'); if(reset){ resetUploadUI(); return; } });
    document.getElementById('searchResult').addEventListener('click', (e)=>{ const reset=e.target.closest('button[data-reset-search]'); if(reset){ resetSearchUI(); } });

    const labelDropArea=document.getElementById('labelFileDropArea'); labelDropArea.addEventListener('click', ()=>document.getElementById('labelFile').click());
    document.getElementById('labelFile').addEventListener('change', handleLabelFileSelect);
    labelDropArea.addEventListener('dragover', (e)=>{ e.preventDefault(); labelDropArea.classList.add('dragover'); });
    labelDropArea.addEventListener('dragleave', ()=>labelDropArea.classList.remove('dragover'));
    labelDropArea.addEventListener('drop', (e)=>{ e.preventDefault(); labelDropArea.classList.remove('dragover'); const files=e.dataTransfer.files; if(files.length>0) uploadLabelFile(files[0]); });

    document.getElementById('btnGenerateLabels').addEventListener('click', generateLabels);
    const btnPrint=document.getElementById('btnPrintLabels'); if(btnPrint) btnPrint.addEventListener('click', printLabels);
    const btnModalPrint=document.getElementById('btnModalPrint'); if(btnModalPrint) btnModalPrint.addEventListener('click', printLabels);
    const btnModalClose=document.getElementById('btnModalClose'); if(btnModalClose) btnModalClose.addEventListener('click', closeLabelModal);
    const btnModalReset=document.getElementById('btnModalReset'); if(btnModalReset) btnModalReset.addEventListener('click', resetLabelUI);
    const modalEl=document.getElementById('labelModal'); if(modalEl){ modalEl.addEventListener('click',(e)=>{ if(e.target&&e.target.id==='labelModal') closeLabelModal(); }); }
    document.getElementById('btnLabelReset').addEventListener('click', resetLabelUI);
    document.getElementById('btnLoadSampleData').addEventListener('click', ()=>{ labelData=generateSampleData(); showLabelDataPreview(); });
  });
})();
