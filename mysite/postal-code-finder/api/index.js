// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 주소 문자열에서 '동', '호'를 추출하여 "102동 802호" 형태로 반환
function extractDongHo(input) {
  try {
    if (!input) return '';
    const s = String(input);
    // 주의: JS \b는 한글 경계에 안전하지 않으므로 공백/문자열끝을 경계로 사용
    // 1) 숫자 동 (예: 102동)
    const mDongNum = s.match(/(\d+(?:-\d+)?)\s*동(?=\s|$)/i);
    // 2) 문자 동 (예: 가동, 나동, A동, B동) — 한 글자만 허용해 '휴천동' 같은 행정동 오탐 방지
    const mDongAlpha = s.match(/(?:^|\s)([A-Za-z가-힣])\s*동(?=\s|$)/);
    const mHo = s.match(/(\d+(?:-\d+)?)\s*호(?=\s|$)/i);
    const parts = [];
    if (mDongNum) parts.push(`${mDongNum[1]}동`);
    else if (mDongAlpha) parts.push(`${mDongAlpha[1]}동`);
    if (mHo) parts.push(`${mHo[1]}호`);
    return parts.join(' ');
  } catch (_) { return ''; }
}

// 라벨 HTML (2열 x 9행) SSR 생성: 주소, 상세주소, 이름(+호칭), 우편번호
function buildLabelHtml(items = [], { nameSuffix = '' } = {}) {
  // 한 페이지당 18개 (2x9)
  const perPage = 18;
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));

  function renderPage(pageItems) {
    let cells = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 2; c++) {
        const idx = r * 2 + c;
        const it = pageItems[idx] || {};
        const addr = it.address || '';
        const detail = it.detailAddress || '';
        const nm = (it.name || '') + (nameSuffix ? ` ${nameSuffix}` : '');
        const zip = it.postalCode || '';
        cells += `
        <div class="label-item">
          <div class="addr">${escapeHtml(addr)}</div>
          ${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}
          <div class="name">${escapeHtml(nm)}</div>
          <div class="zip">${escapeHtml(zip)}</div>
        </div>`;
      }
    }
    return `<div class="label-page">${cells}</div>`;
  }

  const pagesHtml = pages.map(renderPage).join('\n');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
  .sheet { width: 210mm; margin: 0 auto; }
  .label-page { position: relative; width: 210mm; height: 297mm; page-break-after: always; box-sizing: border-box; padding: 8mm 0 12mm 5mm; }
  .label-item { position: absolute; width: 100mm; height: 30mm; box-sizing: border-box; padding: 3mm; display: flex; flex-direction: column; justify-content: space-between; }
  /* 그리드 배치: 2열 9행 */
  ${Array.from({length: 18}).map((_,i)=>{
    const row=Math.floor(i/2), col=i%2; const left = col===0?0:103; const top = row*30; 
    return `.label-item:nth-of-type(${i+1}){ left:${left}mm; top:${top}mm; }`;}).join('\n')}
  .addr{ font: 12pt/1.35 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; text-align:left; }
  .detail{ font: 11pt/1.3 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; text-align:left; }
  .name{ font: 14pt/1.2 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; text-align:right; font-weight:700; }
  .zip{ font: 13pt/1.2 'Courier New', monospace; letter-spacing:2px; text-align:right; }
</style></head>
<body><div class="sheet">${pagesHtml}</div></body></html>`;
}

function escapeHtml(s='') {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// 설정 파일 가져오기 (Vercel 환경 고려)
let config;
try {
  config = require('../backend/src/config');
} catch (error) {
  console.error('Config loading error:', error);
  // Fallback config for Vercel
  config = {
    postal: { provider: 'juso' },
    jusoApiKey: process.env.JUSO_API_KEY,
    upload: { maxFileSize: 10 * 1024 * 1024 },
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
  };
}

// 서버리스 환경에서 백엔드 라우트(require)로 인한 부작용 방지
// (일부 라우트가 파일시스템에 디렉터리 생성 시도 → Vercel의 읽기전용 경로에서 오류)
// 이 파일 내에 구현된 인라인 라우트를 사용하고, 외부 라우트는 로드하지 않음
const addressRoutes = (req, res) => res.status(500).json({ error: 'Address routes not loaded' });
const fileRoutes = (req, res) => res.status(500).json({ error: 'File routes not loaded' });
const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

const app = express();

// Behind Vercel/Reverse proxies, trust X-Forwarded-* headers for correct IPs
// This prevents express-rate-limit v7 from throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', true);

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    }
  }
}));
app.use(compression());

// CORS 설정
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// API 제한 설정
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p.startsWith('/file/status') || p.startsWith('/file/download') || p === '/health';
  }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 간단한 테스트 라우트
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      JUSO_API_KEY: process.env.JUSO_API_KEY ? 'Set' : 'Not set',
      POSTAL_PROVIDER: process.env.POSTAL_PROVIDER
    }
  });
});

// JUSO API 키 테스트
app.get('/api/test-juso', async (req, res) => {
  try {
    const axios = require('axios');
    
    const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
      params: {
        confmKey: process.env.JUSO_API_KEY,
        currentPage: 1,
        countPerPage: 1,
        keyword: '서울시 강남구',
        resultType: 'json'
      },
      timeout: 10000
    });

    res.json({
      message: 'JUSO API 테스트',
      apiKey: process.env.JUSO_API_KEY ? '설정됨' : '미설정',
      response: response.data
    });

  } catch (error) {
    res.status(500).json({
      message: 'JUSO API 테스트 실패',
      error: error.message,
      apiKey: process.env.JUSO_API_KEY ? '설정됨' : '미설정'
    });
  }
});

// 실제 JUSO API 주소 검색
app.post('/api/address/search', async (req, res) => {
  const { address } = req.body;
  
  if (!address) {
    return res.status(400).json({ 
      success: false, 
      error: '주소를 입력해주세요.' 
    });
  }

  if (address.length < 2) {
    return res.status(400).json({ 
      success: false, 
      error: '주소는 2자 이상 입력해주세요.' 
    });
  }

  try {
    // 간단한 JUSO API 호출로 대체
    const axios = require('axios');
    
    const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
      params: {
        confmKey: process.env.JUSO_API_KEY,
        currentPage: 1,
        countPerPage: 1,
        keyword: address,
        resultType: 'json'
      },
      timeout: 10000
    });

    // 디버깅을 위한 로그
    console.log('JUSO API Full Response:', JSON.stringify(response.data, null, 2));
    
    const results = response.data?.results;
    
    if (!results) {
      throw new Error('JUSO API 응답이 없습니다');
    }
    
    // common 객체에서 errorCode 확인
    const common = results.common;
    if (!common) {
      throw new Error('JUSO API 응답 형식이 잘못되었습니다');
    }
    
    if (common.errorCode !== '0') {
      throw new Error(`JUSO API 오류 ${common.errorCode}: ${common.errorMessage || '알 수 없는 오류'}`);
    }

    const juso = results.juso?.[0];
    if (!juso) {
      return res.json({
        success: false,
        error: '해당 주소의 우편번호를 찾을 수 없습니다.'
      });
    }

    // 도로명주소에 원본의 동/호가 있으면 뒤에 덧붙임
    const baseFull = juso.roadAddr || juso.jibunAddr || '';
    const suffix = extractDongHo(address);
    const fullWithDongHo = suffix && !baseFull.includes(suffix) ? `${baseFull} ${suffix}` : baseFull;

    const result = {
      postalCode: juso.zipNo || '',
      fullAddress: fullWithDongHo,
      sido: juso.siNm || '',
      sigungu: juso.sggNm || ''
    };
    
    console.log('Parsed result:', result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Address search error:', error);
    res.status(500).json({
      success: false,
      error: '주소 검색 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 기존 라우트는 사용하지 않음 (위에서 직접 구현함)
// if (typeof addressRoutes === 'function' && addressRoutes.length < 3) {
//   app.use('/api/address', addressRoutes);
// } else {
//   console.log('Using fallback address routes');
// }

// 파일 업로드 라우트 직접 구현
const multer = require('multer');
const upload = multer({ 
  dest: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Initialize global job store for serverless runtime
if (!global.excelJobs) {
  global.excelJobs = {};
}

app.post('/api/file/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    // 엑셀 파일 검증
    const allowedTypes = ['.xls', '.xlsx'];
    const fileExtension = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: '엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.'
      });
    }

    // 임시 작업 ID 생성
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 엑셀 파일 읽기 시도
    try {
      const XLSX = require('xlsx');
      const fs = require('fs');
      
      console.log('Reading Excel file:', req.file.path);
      
      // 파일 읽기
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일이 비어있습니다.'
        });
      }

      // 헤더 행과 데이터 분리
      const headers = jsonData[0] || [];
      const rows = jsonData.slice(1);

      // 주소 컬럼 찾기
      const addressColumnIndex = headers.findIndex(header => 
        typeof header === 'string' && 
        (header.includes('주소') || header.includes('address') || header.includes('addr'))
      );

      if (addressColumnIndex === -1) {
        return res.status(400).json({
          success: false,
          error: '주소 컬럼을 찾을 수 없습니다. 헤더에 "주소" 또는 "address"가 포함된 컬럼이 필요합니다.'
        });
      }

      // 중복 제거 함수
      function removeDuplicateRows(rows, addressColumnIndex) {
        const seen = new Set();
        const uniqueRows = [];
        let duplicatesRemoved = 0;

        rows.forEach((row, index) => {
          const address = row[addressColumnIndex];
          if (!address) return;
          
          // 주소를 정규화 (공백, 특수문자 제거 후 비교)
          const normalizedAddress = String(address)
            .replace(/\s+/g, '') // 모든 공백 제거
            .replace(/[(),\-\.]/g, '') // 특수문자 제거
            .toLowerCase();
          
          if (!seen.has(normalizedAddress)) {
            seen.add(normalizedAddress);
            uniqueRows.push(row);
          } else {
            duplicatesRemoved++;
          }
        });

        return { uniqueRows, duplicatesRemoved };
      }

      // 중복 제거 실행
      const { uniqueRows, duplicatesRemoved } = removeDuplicateRows(rows, addressColumnIndex);
      
      // 처리할 데이터 개수 제한 (Vercel 함수 시간 제한 고려)
      const limitedRows = uniqueRows.slice(0, 200);

      console.log(`Excel parsed: ${headers.length} columns, ${rows.length} total rows`);
      console.log(`Duplicates removed: ${duplicatesRemoved}, Unique rows: ${uniqueRows.length}`);
      console.log(`Processing: ${limitedRows.length} rows (limited to 200)`);

      // Label mode: register job and return JSON (no download)
      const mode = String((req.query.mode || req.headers['x-label-mode'] || '')).toLowerCase();
      if (mode === 'label') {
        global.excelJobs[jobId] = {
          headers,
          rows: limitedRows,
          addressColumnIndex,
          filename: req.file.originalname,
          status: 'uploaded',
          processed: 0,
          results: [],
          errors: [],
          duplicatesRemoved,
          originalRowCount: rows.length,
          uniqueRowCount: uniqueRows.length,
          createdAt: new Date()
        };

        try { fs.unlinkSync(req.file.path); } catch {}

        return res.json({
          success: true,
          data: {
            jobId,
            filename: req.file.originalname,
            originalRows: rows.length,
            duplicatesRemoved,
            uniqueRows: uniqueRows.length,
            status: 'uploaded'
          }
        });
      }

      // 즉시 처리 방식 (기본: 다운로드)
      console.log('Starting immediate processing...');
      
      const jobData = {
        headers,
        rows: limitedRows,
        addressColumnIndex,
        filename: req.file.originalname,
        status: 'processing',
        processed: 0,
        results: [],
        errors: [],
        duplicatesRemoved: duplicatesRemoved,
        originalRowCount: rows.length,
        uniqueRowCount: uniqueRows.length,
        createdAt: new Date()
      };

      // 즉시 주소 처리 시작
      for (let i = 0; i < limitedRows.length; i++) {
        const row = limitedRows[i];
        const address = row[addressColumnIndex];
        
        if (!address || typeof address !== 'string') {
          jobData.errors.push({ row: i + 2, error: '주소가 없습니다' });
          continue;
        }

        try {
          // JUSO API 호출
          const axios = require('axios');
          const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
            params: {
              confmKey: process.env.JUSO_API_KEY,
              currentPage: 1,
              countPerPage: 1,
              keyword: address,
              resultType: 'json'
            },
            timeout: 5000
          });

          const results = response.data?.results;
          const common = results?.common;
          
          if (common?.errorCode === '0' && results.juso?.[0]) {
            const juso = results.juso[0];
            const baseFull = juso.roadAddr || juso.jibunAddr || '';
            jobData.results.push({
              row: i + 2,
              originalAddress: address,
              postalCode: juso.zipNo || '',
              fullAddress: baseFull,
              sido: juso.siNm || '',
              sigungu: juso.sggNm || ''
            });
          } else {
            jobData.errors.push({ 
              row: i + 2, 
              address: address,
              error: '우편번호를 찾을 수 없습니다' 
            });
          }
        } catch (apiError) {
          jobData.errors.push({ 
            row: i + 2, 
            address: address,
            error: 'API 호출 실패: ' + apiError.message 
          });
        }

        jobData.processed = i + 1;
        
        // API 호출 제한을 위한 지연
        if (i < limitedRows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      jobData.status = 'completed';
      jobData.progress = 100;

      // 임시 파일 삭제
      fs.unlinkSync(req.file.path);

      // 즉시 엑셀 파일 생성 및 다운로드 응답
      try {
        const XLSX = require('xlsx');
        
        // 기존 컬럼 중에서 중복될 수 있는 컬럼들 확인
        const existingColumns = headers.map(h => String(h).toLowerCase());
        const hasPostalCode = existingColumns.some(col => col.includes('우편번호') || col.includes('postal') || col.includes('zip'));
        const hasFullAddress = existingColumns.some(col => col.includes('전체주소') || col.includes('full') || col.includes('road') || col.includes('도로명주소'));
        const hasDetail = existingColumns.some(col => col.includes('상세'));
        // '시도', '시군구' 컬럼 제거 후 우편번호/도로명주소만 추가
        const removeHeader = (h) => {
          const s = String(h || '').toLowerCase();
          return s.includes('시도') || s.includes('시/도') || s.includes('sido') ||
                 s.includes('시군구') || s.includes('시/군/구') || s.includes('sigungu');
        };
        const keepIndices = headers.map((h, i) => ({ h, i })).filter(x => !removeHeader(x.h)).map(x => x.i);
        const baseHeaders = keepIndices.map(i => headers[i]);
        const newHeaders = [...baseHeaders];
        if (!hasFullAddress) newHeaders.push('도로명주소');
        if (!hasDetail) newHeaders.push('상세주소');
        if (!hasPostalCode) newHeaders.push('우편번호');

        console.log('Original headers:', headers);
        console.log('Existing columns lowercase:', existingColumns);
        console.log('Duplicate check:', { hasPostalCode, hasFullAddress });
        console.log('New headers:', newHeaders);

        // 결과 데이터를 엑셀 형식으로 변환
        const resultData = [newHeaders];

        // 원본 데이터에 우편번호 정보 추가
        limitedRows.forEach((row, index) => {
          const result = jobData.results.find(r => r.row === index + 2);
          const sourceRow = Array.isArray(row) ? row : Object.values(row || {});
          const newRow = keepIndices.map(i => sourceRow[i] ?? '');
          const detail = extractDongHo(sourceRow[addressColumnIndex]);
          
          // 중복되지 않는 컬럼들만 추가
          if (result) {
            if (!hasFullAddress) newRow.push(result.fullAddress || '');
            if (!hasDetail) newRow.push(detail || '');
            if (!hasPostalCode) newRow.push(result.postalCode || '');
          } else {
            // 실패한 경우 빈 값 (새로 추가되는 컬럼 수만큼)
            if (!hasFullAddress) newRow.push('');
            if (!hasDetail) newRow.push(detail || '');
            if (!hasPostalCode) newRow.push('');
          }
          
          resultData.push(newRow);
        });

        // 워크북 생성
        const ws = XLSX.utils.aoa_to_sheet(resultData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');

        // 파일을 버퍼로 생성
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        console.log('Excel file generated, size:', buffer.length);

        // 다운로드 응답
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="postal_result_${new Date().getTime()}.xlsx"`);
        res.send(buffer);

      } catch (excelGenError) {
        console.error('Excel generation error:', excelGenError);
        
        // 엑셀 생성 실패 시 JSON 응답
        res.json({
          success: true,
          data: {
            jobId: jobId,
            filename: req.file.originalname,
            originalRows: jobData.originalRowCount,
            duplicatesRemoved: jobData.duplicatesRemoved,
            uniqueRows: jobData.uniqueRowCount,
            processedRows: limitedRows.length,
            successful: jobData.results.length,
            failed: jobData.errors.length,
            headers: headers,
            addressColumn: headers[addressColumnIndex],
            status: 'completed',
            results: jobData.results,
            errors: jobData.errors,
            message: `처리 완료: 원본 ${jobData.originalRowCount}개 → 중복제거 ${jobData.duplicatesRemoved}개 → 고유 ${jobData.uniqueRowCount}개 → 처리 ${limitedRows.length}개 (성공 ${jobData.results.length}개, 실패 ${jobData.errors.length}개) [엑셀 생성 오류: ${excelGenError.message}]`
          }
        });
      }

    } catch (excelError) {
      console.error('Excel processing error:', excelError);
      
      // 임시 파일 삭제
      if (req.file.path && require('fs').existsSync(req.file.path)) {
        require('fs').unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        error: '엑셀 파일을 읽을 수 없습니다: ' + excelError.message
      });
    }

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: '파일 업로드 중 오류가 발생했습니다.'
    });
  }
});

app.get('/api/file/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({
        success: false,
        error: '작업을 찾을 수 없습니다.'
      });
    }

    const job = global.excelJobs[jobId];
    
    if (job.status === 'uploaded') {
      // 주소 처리 시작
      job.status = 'processing';
      job.processed = 0;
      job.results = [];
      job.errors = [];

      // 백그라운드에서 주소 처리 (실제로는 동기 처리)
      try {
        for (let i = 0; i < job.rows.length; i++) {
          const row = job.rows[i];
          const address = row[job.addressColumnIndex];
          
          if (!address || typeof address !== 'string') {
            job.errors.push({ row: i + 2, error: '주소가 없습니다' });
            continue;
          }

          try {
            // JUSO API 호출
            const axios = require('axios');
            const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
              params: {
                confmKey: process.env.JUSO_API_KEY,
                currentPage: 1,
                countPerPage: 1,
                keyword: address,
                resultType: 'json'
              },
              timeout: 5000
            });

            const results = response.data?.results;
            const common = results?.common;
            
            if (common?.errorCode === '0' && results.juso?.[0]) {
              const juso = results.juso[0];
              const baseFull = juso.roadAddr || juso.jibunAddr || '';
              job.results.push({
                row: i + 2,
                originalAddress: address,
                postalCode: juso.zipNo || '',
                fullAddress: baseFull,
                sido: juso.siNm || '',
                sigungu: juso.sggNm || ''
              });
            } else {
              job.errors.push({ 
                row: i + 2, 
                address: address,
                error: '우편번호를 찾을 수 없습니다' 
              });
            }
          } catch (apiError) {
            job.errors.push({ 
              row: i + 2, 
              address: address,
              error: 'API 호출 실패: ' + apiError.message 
            });
          }

          job.processed = i + 1;
          
          // API 호출 제한을 위한 지연 (더 짧게)
          if (i < job.rows.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50)); // 100ms에서 50ms로 단축
          }
        }

        job.status = 'completed';
        job.progress = 100;
        
      } catch (processingError) {
        job.status = 'error';
        job.error = processingError.message;
      }
    }

    res.json({
      success: true,
      data: {
        status: job.status,
        progress: Math.round((job.processed / job.rows.length) * 100),
        processed: job.processed || 0,
        total: job.rows.length,
        errors: job.errors || [],
        results: job.results || [],
        message: job.status === 'completed' ? 
          `처리 완료: ${job.results?.length || 0}개 성공, ${job.errors?.length || 0}개 실패` :
          job.status === 'processing' ? '주소 검색 중...' : '대기 중'
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: '상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// 다운로드 기능
app.get('/api/file/download/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({
        success: false,
        error: '작업을 찾을 수 없습니다.'
      });
    }

    const job = global.excelJobs[jobId];
    
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: '작업이 완료되지 않았습니다.'
      });
    }

    try {
      // 엑셀 파일 생성
      const XLSX = require('xlsx');
      
      console.log('Generating Excel file for jobId:', jobId);
      console.log('Job data:', { 
        headersLength: job.headers?.length, 
        rowsLength: job.rows?.length, 
        resultsLength: job.results?.length 
      });
      
      // 안전한 헤더 처리
      const safeHeaders = Array.isArray(job.headers) ? job.headers : [];
      
      // 기존 컬럼 중에서 중복될 수 있는 컬럼들 확인
      const existingColumns = safeHeaders.map(h => String(h).toLowerCase());
      const hasPostalCode = existingColumns.some(col => col.includes('우편번호') || col.includes('postal') || col.includes('zip'));
      const hasFullAddress = existingColumns.some(col => col.includes('전체주소') || col.includes('full') || col.includes('road') || col.includes('도로명주소'));
      const hasDetail = existingColumns.some(col => col.includes('상세'));
      // '시도', '시군구' 제거 후 우편번호/도로명주소만 추가
      const removeHeader = (h) => {
        const s = String(h || '').toLowerCase();
        return s.includes('시도') || s.includes('시/도') || s.includes('sido') ||
               s.includes('시군구') || s.includes('시/군/구') || s.includes('sigungu');
      };
      const keepIndices = safeHeaders.map((h, i) => ({ h, i })).filter(x => !removeHeader(x.h)).map(x => x.i);
      const baseHeaders = keepIndices.map(i => safeHeaders[i]);
      const newHeaders = [...baseHeaders];
      if (!hasFullAddress) newHeaders.push('도로명주소');
      if (!hasDetail) newHeaders.push('상세주소');
      if (!hasPostalCode) newHeaders.push('우편번호');
      
      // 결과 데이터를 엑셀 형식으로 변환
      const resultData = [newHeaders];

      // 원본 데이터에 우편번호 정보 추가
      if (Array.isArray(job.rows)) {
        job.rows.forEach((row, index) => {
          const result = job.results?.find(r => r.row === index + 2);
          const sourceRow = Array.isArray(row) ? row : Object.values(row || {});
          // 주소 컬럼 자동 탐색 (시/군/구 제거 이후에도 유지)
          const addrIdx = safeHeaders.findIndex(h => typeof h === 'string' && (h.includes('주소') || /addr|address/i.test(h)));
          const newRow = keepIndices.map(i => sourceRow[i] ?? '');
          const detail = extractDongHo(addrIdx >= 0 ? sourceRow[addrIdx] : '');
          
          // 중복되지 않는 컬럼들만 추가
          if (result) {
            if (!hasFullAddress) newRow.push(result.fullAddress || '');
            if (!hasDetail) newRow.push(detail || '');
            if (!hasPostalCode) newRow.push(result.postalCode || '');
          } else {
            // 실패한 경우 빈 값 (새로 추가되는 컬럼 수만큼)
            if (!hasFullAddress) newRow.push('');
            if (!hasDetail) newRow.push(detail || '');
            if (!hasPostalCode) newRow.push('');
          }
          
          resultData.push(newRow);
        });
      }

      console.log('Result data rows:', resultData.length);

      // 워크북 생성
      const ws = XLSX.utils.aoa_to_sheet(resultData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');

      // 파일을 버퍼로 생성
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      console.log('Excel buffer size:', buffer.length);

      // 다운로드 응답
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="postal_result_${new Date().getTime()}.xlsx"`);
      res.send(buffer);

    } catch (excelGenError) {
      console.error('Excel generation error:', excelGenError);
      return res.status(500).json({
        success: false,
        error: '엑셀 파일 생성 중 오류가 발생했습니다: ' + excelGenError.message
      });
    }

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: '다운로드 중 오류가 발생했습니다.'
    });
  }
});

// 라벨 데이터 JSON 반환 (처리 완료 후)
app.get('/api/file/label-data/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다.' });
    }
    const job = global.excelJobs[jobId];
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, error: '작업이 완료되지 않았습니다.' });
    }

    const safeHeaders = Array.isArray(job.headers) ? job.headers : [];
    const existingColumns = safeHeaders.map(h => String(h).toLowerCase());
    const hasPostalCode = existingColumns.some(col => col.includes('우편번호') || col.includes('postal') || col.includes('zip'));
    const hasFullAddress = existingColumns.some(col => col.includes('전체주소') || col.includes('full') || col.includes('road') || col.includes('도로명주소'));
    const hasDetail = existingColumns.some(col => col.includes('상세'));
    // '시도', '시군구' 제거 후 우편번호/도로명주소만 추가
    const removeHeader = (h) => {
      const s = String(h || '').toLowerCase();
      return s.includes('시도') || s.includes('시/도') || s.includes('sido') ||
             s.includes('시군구') || s.includes('시/군/구') || s.includes('sigungu');
    };
    const keepIndices = safeHeaders.map((h, i) => ({ h, i })).filter(x => !removeHeader(x.h)).map(x => x.i);
    const baseHeaders = keepIndices.map(i => safeHeaders[i]);
    const newHeaders = [...baseHeaders];
    if (!hasFullAddress) newHeaders.push('도로명주소');
    if (!hasDetail) newHeaders.push('상세주소');
    if (!hasPostalCode) newHeaders.push('우편번호');

    const rows = Array.isArray(job.rows) ? job.rows : [];
    const resultRows = rows.map((row, index) => {
      const result = job.results?.find(r => r.row === index + 2);
      const sourceRow = Array.isArray(row) ? row : Object.values(row || {});
      const addrIdx = safeHeaders.findIndex(h => typeof h === 'string' && (h.includes('주소') || /addr|address/i.test(h)));
      const newRow = keepIndices.map(i => sourceRow[i] ?? '');
      const detail = extractDongHo(addrIdx >= 0 ? sourceRow[addrIdx] : '');
      if (result) {
        if (!hasFullAddress) newRow.push(result.fullAddress || '');
        if (!hasDetail) newRow.push(detail || '');
        if (!hasPostalCode) newRow.push(result.postalCode || '');
      } else {
        if (!hasFullAddress) newRow.push('');
        if (!hasDetail) newRow.push(detail || '');
        if (!hasPostalCode) newRow.push('');
      }
      return newRow;
    });

    const jsonRows = resultRows.map(arr => {
      const obj = {};
      newHeaders.forEach((h, i) => { obj[h] = arr[i] || ''; });
      return obj;
    });

    res.json({ success: true, data: { headers: newHeaders, rows: jsonRows } });
  } catch (error) {
    console.error('Label data error:', error);
    res.status(500).json({ success: false, error: '라벨 데이터 생성 중 오류가 발생했습니다.' });
  }
});

// HWPX 다운로드: 새로운 HWPX 생성기 사용
app.get('/api/file/hwpx/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const nameSuffix = req.query.nameSuffix || '';
    
    // 작업 존재 여부 확인
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다.' });
    }
    
    const job = global.excelJobs[jobId];
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, error: '작업이 완료되지 않았습니다.' });
    }

    // 새로운 HWPX 생성기 사용
    const { HwpxGenerator } = require('./hwpx-generator');
    const generator = new HwpxGenerator();
    
    // 컬럼 탐지를 위한 기존 로직 재사용
    const { detectColumns } = require('./hwpx');
    const headers = Array.isArray(job.headers) ? job.headers : [];
    const rows = Array.isArray(job.rows) ? job.rows : [];
    const cols = detectColumns(headers);
    
    console.log('HWPX Generator: Processing', rows.length, 'items');
    console.log('HWPX Generator: Column detection result:', cols);

    // 라벨 데이터 구성
    const items = rows.map((row, idx) => {
      const arr = Array.isArray(row) ? row : Object.values(row || {});
      const get = i => (i >= 0 && i < arr.length) ? String(arr[i] || '') : '';
      const r = job.results?.find(r => r.row === idx + 2);
      
      // 주소: API 결과 우선, 없으면 원본 데이터
      let address = r?.fullAddress || get(cols.address) || '';
      let detailAddress = get(cols.detailAddress);
      let name = get(cols.name);
      
      // 우편번호: 원본 컬럼 우선, 없으면 API 결과
      let postalCode = get(cols.postalCode);
      if (!postalCode) {
        postalCode = r?.postalCode || '';
      }

      return { address, detailAddress, name, postalCode };
    });

    // HWPX 생성
    const buffer = await generator.generate(items, { nameSuffix });
    
    // 응답 헤더 설정
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="labels_${jobId}.hwpx"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('HWPX Generator Error:', error);
    res.status(500).json({ 
      success: false, 
      error: `HWPX 생성 실패: ${error.message}` 
    });
  }
});

// 기존 fileRoutes는 사용하지 않음
// if (typeof fileRoutes === 'function' && fileRoutes.length < 3) {
//   app.use('/api/file', fileRoutes);
// } else {
//   console.log('Using fallback file routes');
// }

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    vercel: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      env: process.env.VERCEL_ENV || null,
      region: process.env.VERCEL_REGION || null
    }
  });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `파일 크기가 너무 큽니다. 최대 10MB 입니다.` });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
app.use(errorHandler);

// 404 핸들러
app.use('*', (req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

module.exports = app;
