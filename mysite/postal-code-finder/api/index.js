// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

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

// 라우트 가져오기 (오류 처리 추가)
let addressRoutes, fileRoutes, errorHandler;
try {
  addressRoutes = require('../backend/src/routes/address');
  fileRoutes = require('../backend/src/routes/file');
  errorHandler = require('../backend/src/middleware/errorHandler');
} catch (error) {
  console.error('Routes loading error:', error);
  // 기본 라우트 설정
  addressRoutes = (req, res) => res.status(500).json({ error: 'Address routes not loaded' });
  fileRoutes = (req, res) => res.status(500).json({ error: 'File routes not loaded' });
  errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
}

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

    const result = {
      postalCode: juso.zipNo || '',
      fullAddress: juso.roadAddr || juso.jibunAddr || '',
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

// JUSO 검색 유틸 및 폴백(지역+건물명)
function extractComponents(address) {
  const norm = String(address || '').trim();
  const parts = norm.split(/\s+/).filter(Boolean);
  const comp = { sido: '', sigungu: '', dong: '' };
  const sidoSuffixes = ['특별시','광역시','특별자치시','도','특별자치도'];
  for (let i = 0; i < parts.length; i++) {
    if (sidoSuffixes.some(s => parts[i].endsWith(s))) {
      comp.sido = parts[i];
      if (i+1 < parts.length && /(시|군|구)$/.test(parts[i+1])) comp.sigungu = parts[i+1];
      break;
    }
  }
  for (let i = 0; i < parts.length; i++) { if (/(동|읍|면)$/.test(parts[i])) { comp.dong = parts[i]; break; } }
  return comp;
}
function extractBuildingBase(address) {
  const text = String(address || '').trim();
  const cleaned = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter(Boolean);
  const aptIdx = tokens.findIndex(t => /(아파트|빌라|APT)/i.test(t));
  if (aptIdx > 0) {
    const base = tokens[aptIdx - 1].replace(/[A-Za-z]+$/g, '').replace(/동$/, '');
    if (base && base.length >= 2) return base;
  }
  for (const t of tokens) {
    if (/^[A-Za-z가-힣]+[A-Za-z]?동$/i.test(t)) {
      const b = t.replace(/[A-Za-z]+$/g, '').replace(/동$/i, '');
      if (b && b.length >= 2) return b;
    }
  }
  const exclude = /(시|군|구|동|읍|면|리|로|길|가|번|호)$/;
  const cand = tokens.find(t => !/\d/.test(t) && !exclude.test(t) && t.length >= 2);
  return cand || '';
}
async function jusoSearch(keyword, size = 50) {
  const axios = require('axios');
  const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
    params: { confmKey: process.env.JUSO_API_KEY, currentPage: 1, countPerPage: size, keyword, resultType: 'json' },
    timeout: 7000
  });
  return response.data?.results;
}
function _norm(s) { return String(s || '').replace(/\s+/g, '').trim(); }
function regionMatchesCandidate(item, comp) {
  const si = _norm(item.siNm);
  const sgg = _norm(item.sggNm);
  const emd = _norm(item.emdNm || '');
  const li = _norm(item.liNm || '');
  const inSi = _norm(comp.sido);
  const inSgg = _norm(comp.sigungu);
  const inEmd = _norm(comp.dong);
  const inLi = _norm(comp.ri);
  if (inSi && si && si !== inSi) return false;
  if (inSgg && sgg && sgg !== inSgg) return false;
  // 읍/면/동 지정 시 반드시 일치
  if (inEmd && emd && emd !== inEmd) return false;
  // 리 정보가 있으면 li 또는 주소 문자열에 포함되는지 확인
  if (inLi) {
    const addrStr = _norm((item.roadAddr || '') + (item.jibunAddr || ''));
    if (li && li !== inLi && !addrStr.includes(inLi)) return false;
  }
  return true;
}
function candidateScore(item, input, base) {
  const t = (item.roadAddr || '') + ' ' + (item.jibunAddr || '') + ' ' + (item.bdNm || '');
  const a = _norm(input).toLowerCase();
  const b = _norm(t).toLowerCase();
  let common = 0;
  const aw = a.split(/(?=[가-힣A-Za-z0-9])/).filter(Boolean);
  const bw = b.split(/(?=[가-힣A-Za-z0-9])/).filter(Boolean);
  aw.forEach(w => { if (w.length > 1 && b.includes(w)) common += w.length; });
  let score = common;
  if (base && b.includes(_norm(base).toLowerCase())) score += 50;
  // 도로명/번지 숫자 일치 가산(간단)
  const num = input.match(/\d{1,4}(-\d{1,4})?/);
  if (num && b.includes(num[0].replace(/\s+/g,''))) score += 20;
  return score;
}
async function jusoSearchWithFallback(address) {
  try {
    const comp = extractComponents(address);
    const base = extractBuildingBase(address);
    const primary = await jusoSearch(address, 50).catch(() => null);
    let list = Array.isArray(primary?.juso) ? primary.juso : [];
    list = list.filter(it => regionMatchesCandidate(it, comp));
    if (primary?.common?.errorCode === '0' && list.length > 0) {
      list.sort((a, b) => candidateScore(b, address, base) - candidateScore(a, address, base));
      return { common: primary.common, juso: list };
    }
    const region = comp.sigungu || comp.sido || '';
    if (base && region) {
      const tries = [`${region} ${base} 아파트`, `${region} ${base}`];
      for (const k of tries) {
        const r = await jusoSearch(k, 50).catch(() => null);
        if (r?.common?.errorCode === '0' && Array.isArray(r?.juso) && r.juso.length > 0) {
          let cand = r.juso.filter(it => regionMatchesCandidate(it, comp));
          if (cand.length === 0) continue;
          cand.sort((a, b) => candidateScore(b, address, base) - candidateScore(a, address, base));
          return { common: r.common, juso: cand };
        }
      }
    }
    return primary;
  } catch (e) {
    return null;
  }
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
      const acceptJson = (req.headers['accept'] || '').includes('application/json');
      const mode = String((req.query.mode || req.headers['x-label-mode'] || (acceptJson ? 'label' : ''))).toLowerCase();
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
          // JUSO API 단건 호출 (폴백 사용 안 함)
          const axios = require('axios');
          const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
            params: {
              confmKey: process.env.JUSO_API_KEY,
              currentPage: 1,
              countPerPage: 1,
              keyword: address,
              resultType: 'json'
            },
            timeout: 7000
          });
          const results = response.data?.results;
          const common = results?.common;
          
          if (common?.errorCode === '0' && results.juso?.[0]) {
            const juso = results.juso[0];
            jobData.results.push({
              row: i + 2,
              originalAddress: address,
              postalCode: juso.zipNo || '',
              fullAddress: juso.roadAddr || juso.jibunAddr || '',
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
        const hasSido = existingColumns.some(col => col.includes('시도') || col.includes('시/도') || col.includes('sido'));
        const hasSigungu = existingColumns.some(col => col.includes('시군구') || col.includes('시/군/구') || col.includes('sigungu'));

        // 새로 추가할 컬럼들만 선별
        const newHeaders = [...headers];
        if (!hasPostalCode) newHeaders.push('우편번호');
        if (!hasFullAddress) newHeaders.push('도로명주소');
        if (!hasSido) newHeaders.push('시도');
        if (!hasSigungu) newHeaders.push('시군구');

        console.log('Original headers:', headers);
        console.log('Existing columns lowercase:', existingColumns);
        console.log('Duplicate check:', { hasPostalCode, hasFullAddress, hasSido, hasSigungu });
        console.log('New headers:', newHeaders);

        // 결과 데이터를 엑셀 형식으로 변환
        const resultData = [newHeaders];

        // 원본 데이터에 우편번호 정보 추가
        limitedRows.forEach((row, index) => {
          const result = jobData.results.find(r => r.row === index + 2);
          const newRow = Array.isArray(row) ? [...row] : Object.values(row || {});
          
          // 헤더와 행의 길이 맞춤
          while (newRow.length < headers.length) {
            newRow.push('');
          }
          
          // 중복되지 않는 컬럼들만 추가
          if (result) {
            if (!hasPostalCode) newRow.push(result.postalCode || '');
            if (!hasFullAddress) newRow.push(result.fullAddress || '');
            if (!hasSido) newRow.push(result.sido || '');
            if (!hasSigungu) newRow.push(result.sigungu || '');
          } else {
            // 실패한 경우 빈 값 (새로 추가되는 컬럼 수만큼)
            if (!hasPostalCode) newRow.push('');
            if (!hasFullAddress) newRow.push('');
            if (!hasSido) newRow.push('');
            if (!hasSigungu) newRow.push('');
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
          // JUSO API 단건 호출 (폴백 사용 안 함)
          const axios = require('axios');
          const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
            params: {
              confmKey: process.env.JUSO_API_KEY,
              currentPage: 1,
              countPerPage: 1,
              keyword: address,
              resultType: 'json'
            },
            timeout: 7000
          });
          const results = response.data?.results;
          const common = results?.common;
            
            if (common?.errorCode === '0' && results?.juso?.[0]) {
              const juso = results.juso[0];
              job.results.push({
                row: i + 2,
                originalAddress: address,
                postalCode: juso.zipNo || '',
                fullAddress: juso.roadAddr || juso.jibunAddr || '',
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
      // 상세주소 추출 유틸(간단 버전)
      function splitAddressDetail(address) {
        if (!address || typeof address !== 'string') return { main: '', detail: '' };
        let main = String(address).trim();
        const detailParts = [];
        const isUnitToken = (txt) => {
          const s = String(txt || '').trim();
          if (!s) return false;
          if (/(동|호|층)/i.test(s) && /\d/.test(s)) return true;
          if (/^[A-Za-z]?\d{1,4}-\d{1,4}(\s*(호|층))?$/i.test(s)) return true;
          return false;
        };
        // 괄호 안 내용: 동/호/층일 때만 상세로 이동
        main = main.replace(/\(([^)]+)\)/g, (_, inner) => { const t = inner.trim(); if (isUnitToken(t)) detailParts.push(t); return ''; });
        // 콤마 뒤 동/호 패턴 이동
        const segs = main.split(',').map(s => s.trim()).filter(Boolean);
        if (segs.length > 1) {
          const last = segs[segs.length - 1];
          if (isUnitToken(last)) { detailParts.push(last); segs.pop(); main = segs.join(', '); }
        }
        // 끝부분 토큰에서 동/호/층 추출
        const tokens = main.split(' ').filter(Boolean);
        const tail = [];
        while (tokens.length) {
          const tk = tokens[tokens.length - 1];
          if (/\d/.test(tk) && /(동|호|층)$/i.test(tk)) { tail.unshift(tk); tokens.pop(); continue; }
          if (/^[A-Za-z가-힣]+동$/i.test(tk) && tail.length) { tail.unshift(tk); tokens.pop(); continue; }
          break;
        }
        if (tail.length) { const t = tail.join(' ').trim(); if (isUnitToken(t)) detailParts.push(t); main = tokens.join(' ').trim(); }
        // 하이픈 패턴 (101-1203 등)
        if (!detailParts.length) {
          const m = main.match(/(?:\s|^)([A-Za-z]?\d{1,4}-\d{1,4}(?:\s*(?:호|층))?)\s*$/);
          if (m && m[1]) { const seg = m[1].trim(); if (isUnitToken(seg)) { detailParts.push(seg); main = main.slice(0, m.index).trim(); } }
        }
        const filtered = detailParts.filter(isUnitToken);
        const detail = filtered.join(' ').replace(/\s{2,}/g, ' ').trim();
        main = main.replace(/\s{2,}/g, ' ').trim();
        return { main, detail };
      }

      console.log('Generating Excel file for jobId:', jobId);
      console.log('Job data:', { 
        headersLength: job.headers?.length, 
        rowsLength: job.rows?.length, 
        resultsLength: job.results?.length 
      });
      
      // 안전한 헤더 처리 및 정렬 재구성
      const originalHeaders = Array.isArray(job.headers) ? job.headers : [];
      const norm = s => String(s || '').toLowerCase().replace(/[\s_\//]/g, '');
      const isAdminHeader = h => {
        const n = norm(h);
        return n.includes('시도') || n.includes('sido') || n.includes('시군구') || n.includes('sigungu') || n.includes('광역시') || n.includes('특별시');
      };
      const isRoadHeader = h => {
        const n = norm(h);
        return n.includes('도로명주소') || n.includes('road') || n.includes('fulladdress') || n.includes('전체주소');
      };
      const isDetailHeader = h => {
        const n = norm(h);
        return n.includes('상세주소') || n.includes('세부주소') || n.includes('동호') || n.includes('호수') || n.includes('호실');
      };
      const isPostalHeader = h => {
        const n = norm(h);
        return n.includes('우편번호') || n.includes('postal') || n.includes('zip');
      };
      // 시도/시군구 제거
      const filteredHeaders = originalHeaders.filter(h => !isAdminHeader(h));
      // 주소/상세/우편/도로명 헤더 제거하여 베이스 구성
      const baseHeaders = filteredHeaders.filter(h => !isRoadHeader(h) && !isDetailHeader(h) && !isPostalHeader(h));
      // 주소 컬럼 인덱스(업로드 시 저장)
      const addressIndex = typeof job.addressColumnIndex === 'number' ? job.addressColumnIndex : originalHeaders.findIndex(h => String(h).includes('주소'));

      // 최종 헤더: [베이스, 도로명주소, 상세주소, 우편번호]
      const newHeaders = [...baseHeaders, '도로명주소', '상세주소', '우편번호'];
      
      // 결과 데이터를 엑셀 형식으로 변환
      const resultData = [newHeaders];

      // 원본 데이터에 우편번호 정보 추가
      if (Array.isArray(job.rows)) {
        job.rows.forEach((row, index) => {
          const result = job.results?.find(r => r.row === index + 2);
          const rowArray = Array.isArray(row) ? row : Object.values(row || {});
          // 베이스 필드 채우기 (관리/중복 필드 제외, 기존 순서 유지)
          const baseOut = baseHeaders.map(h => {
            const idx = originalHeaders.indexOf(h);
            return idx >= 0 ? (rowArray[idx] ?? '') : '';
          });

          // 상세주소 계산: 기존 상세가 있더라도 동/호/층 등 유닛 정보만 사용
          const detailHeaderIndex = originalHeaders.findIndex(h => isDetailHeader(h));
          let detailValue = '';
          if (detailHeaderIndex !== -1) {
            const v = rowArray[detailHeaderIndex];
            const sanitized = splitAddressDetail(String(v || '')).detail;
            detailValue = (sanitized && String(sanitized).trim()) ? String(sanitized).trim() : '';
          }
          if (!detailValue) {
            const addr = addressIndex >= 0 ? (rowArray[addressIndex] || '') : '';
            const { detail } = splitAddressDetail(addr);
            detailValue = detail || '';
          }
          if (!detailValue) {
            const dongIndex = originalHeaders.findIndex(h => /(^|[^가-힣])동$|dong$/i.test(norm(h)) || norm(h).endsWith('동'));
            const hoIndex = originalHeaders.findIndex(h => norm(h).endsWith('호') || /hosu|room|unit/i.test(norm(h)));
            const parts = [];
            const dv = dongIndex >= 0 ? (rowArray[dongIndex] ?? '') : '';
            const hv = hoIndex >= 0 ? (rowArray[hoIndex] ?? '') : '';
            if (dv && String(dv).trim()) parts.push(`${String(dv).trim()}동`);
            if (hv && String(hv).trim()) parts.push(`${String(hv).trim()}호`);
            if (parts.length) detailValue = parts.join(' ');
          }

          const roadVal = result ? (result.fullAddress || '') : '';
          const postalVal = result ? (result.postalCode || '') : '';
          // 최종 컬럼 순서: [베이스..., 도로명주소, 상세주소, 우편번호]
          resultData.push([...baseOut, roadVal, detailValue || '', postalVal]);
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
    const hasSido = existingColumns.some(col => col.includes('시도') || col.includes('시/도') || col.includes('sido'));
    const hasSigungu = existingColumns.some(col => col.includes('시군구') || col.includes('시/군/구') || col.includes('sigungu'));

    const newHeaders = [...safeHeaders];
    if (!hasPostalCode) newHeaders.push('우편번호');
    if (!hasFullAddress) newHeaders.push('도로명주소');
    if (!hasSido) newHeaders.push('시도');
    if (!hasSigungu) newHeaders.push('시군구');

    const rows = Array.isArray(job.rows) ? job.rows : [];
    const resultRows = rows.map((row, index) => {
      const result = job.results?.find(r => r.row === index + 2);
      const newRow = Array.isArray(row) ? [...row] : Object.values(row || {});
      while (newRow.length < safeHeaders.length) newRow.push('');
      if (result) {
        if (!hasPostalCode) newRow.push(result.postalCode || '');
        if (!hasFullAddress) newRow.push(result.fullAddress || '');
        if (!hasSido) newRow.push(result.sido || '');
        if (!hasSigungu) newRow.push(result.sigungu || '');
      } else {
        if (!hasPostalCode) newRow.push('');
        if (!hasFullAddress) newRow.push('');
        if (!hasSido) newRow.push('');
        if (!hasSigungu) newRow.push('');
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

// HWPX 다운로드: 라벨 데이터를 HWPX로 패키징하여 반환
app.get('/api/file/hwpx/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const nameSuffix = req.query.nameSuffix || '';
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다.' });
    }
    const job = global.excelJobs[jobId];
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, error: '작업이 완료되지 않았습니다.' });
    }

    const { buildHwpxFromTemplate, detectColumns } = require('./hwpx');
    const headers = Array.isArray(job.headers) ? job.headers : [];
    const rows = Array.isArray(job.rows) ? job.rows : [];
    const cols = detectColumns(headers);

    // rows + results를 합쳐 최종 표시 데이터 구성
    // 주소는 항상 도로명주소(결과 fullAddress: roadAddr 우선)를 우선 사용
    const items = rows.map((row, idx) => {
      const arr = Array.isArray(row) ? row : Object.values(row || {});
      const get = i => (i >= 0 && i < arr.length) ? String(arr[i] || '') : '';
      const r = job.results?.find(r => r.row === idx + 2);
      
      // 1) 주소: 결과의 fullAddress(roadAddr 우선)를 최우선 사용, 없으면 원본 컬럼
      let address = r?.fullAddress || get(cols.address) || '';

      // 2) 성명: 원본 컬럼 우선
      let name = get(cols.name);

      // 3) 우편번호: 원본 컬럼 없으면 결과값 사용
      let postalCode = get(cols.postalCode);
      if (!postalCode) {
        postalCode = r?.postalCode || '';
      }

      return { address, name, postalCode };
    });

    const buf = await buildHwpxFromTemplate(items, { nameSuffix });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="labels_${jobId}.hwpx"`);
    return res.send(buf);
  } catch (error) {
    console.error('HWPX build error:', error);
    res.status(500).json({ success: false, error: 'HWPX 생성 중 오류가 발생했습니다.' });
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
