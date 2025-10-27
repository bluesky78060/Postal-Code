// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
let helmet, compression, rateLimit;
try {
  helmet = require('helmet');
  compression = require('compression');
  rateLimit = require('express-rate-limit');
} catch (_) {}
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
// Minimal health handler (works even if further init fails)
function rawHealth(res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({
    status: 'OK',
    timestamp: new Date().toISOString(),
    // API 키 정보는 개발 환경에서만 노출
    ...(process.env.NODE_ENV === 'development' && {
      env: {
        JUSO_API_KEY: !!process.env.JUSO_API_KEY,
        NODE_ENV: process.env.NODE_ENV,
      }
    })
  }));
}
app.get('/api/health', (req, res) => rawHealth(res));

// Behind Vercel/Reverse proxies, trust X-Forwarded-* headers for correct IPs
// This prevents express-rate-limit v7 from throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', true);

// 보안/압축 미들웨어 (로컬/서버 환경에 따라 조건 적용)
if (helmet) {
  try {
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
  } catch (_) {}
}
if (compression) {
  try { app.use(compression()); } catch (_) {}
}

// CORS 설정 - 보안 강화
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// 개발 환경에서는 localhost 허용
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  );
}

app.use(cors({
  origin: function (origin, callback) {
    // 출처가 없는 경우 (same-origin, 모바일 앱, Postman 등)
    if (!origin) return callback(null, true);

    // Vercel 배포: ALLOWED_ORIGINS가 비어있으면 같은 도메인 자동 허용
    if (allowedOrigins.length === 0) {
      // Vercel 배포 도메인 패턴 허용 (vercel.app)
      if (origin.includes('.vercel.app')) {
        return callback(null, true);
      }
    }

    // 허용 목록 확인
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// API 제한 설정
if (rateLimit) {
  try {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const p = req.path || '';
        return p.startsWith('/file/status') || p.startsWith('/file/download') || p === '/health';
      }
    });
    app.use('/api/', limiter);
  } catch (_) {}
}

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 간단한 테스트 라우트 (개발 환경에서만 활성화)
app.get('/api/test', (req, res) => {
  // 프로덕션에서는 접근 차단
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      JUSO_API_KEY: !!process.env.JUSO_API_KEY, // Set/Not set 대신 boolean
      POSTAL_PROVIDER: process.env.POSTAL_PROVIDER
    }
  });
});

// JUSO API 키 테스트 (개발 환경에서만 활성화)
app.get('/api/test-juso', async (req, res) => {
  // 프로덕션에서는 접근 차단
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

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
      hasApiKey: !!process.env.JUSO_API_KEY,
      response: response.data
    });

  } catch (error) {
    res.status(500).json({
      message: 'JUSO API 테스트 실패',
      error: error.message,
      hasApiKey: !!process.env.JUSO_API_KEY
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

    // 개발 환경에서만 상세 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('JUSO API Response:', {
        keyword: address,
        resultCount: response.data?.results?.juso?.length || 0,
        errorCode: response.data?.results?.common?.errorCode
      });
    }

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

// JUSO 검색 유틸 (폴백은 비활성화 가능하며, 기본은 직접검색만 수행)
const BUILDING_KEYWORDS = [
  '아파트','apt','빌라','빌리지','오피스텔','주상복합','상가',
  '타워','캐슬','파크','팰리스','하이츠','하이빌','메트로',
  '리젠시','리첼','푸르지오','자이','e편한세상','힐스테이트'
];
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
  // 키워드가 토큰에 포함될 경우, 바로 앞 토큰(또는 붙어있는 접두)을 단지명으로 판단
  const aptIdx = tokens.findIndex(t => BUILDING_KEYWORDS.some(k => t.toLowerCase().includes(k)));
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
    // Fallback 비활성화: 직접 검색만 수행하고 검증 통과 후보가 없으면 실패 처리
    const primary = await jusoSearch(address, 50).catch(() => null);
    return primary;
  } catch (e) {
    return null;
  }
}
// 상세주소 추출: 동/호/층만 포함, 지번 제외
function splitAddressDetail(address) {
  if (!address || typeof address !== 'string') return { main: '', detail: '' };
  let main = String(address).trim();
  const detailParts = [];

  // 유닛 토큰 판별: 동/호/층이 포함된 경우만 (지번 제외)
  const isUnitToken = (txt) => {
    const s = String(txt || '').trim();
    if (!s) return false;

    // 지번 패턴 제외 (예: 123-45, 1234, 123-4567 등 순수 숫자+하이픈)
    if (/^[\d-]+$/.test(s)) return false;
    if (/^\d{1,4}-\d{1,4}$/.test(s) && !/(동|호|층)/.test(s)) return false;

    // 동/호/층이 명시적으로 포함된 경우만 유효
    if (/(동|호|층)/.test(s)) {
      // "101동", "A동", "203호", "5층" 등
      if (/^[A-Za-z가-힣]?\d{1,4}(동|호|층)$/.test(s)) return true;
      // "101동 203호", "A동 501호" 등
      if (/^[A-Za-z가-힣]?\d{1,4}(동|호|층)\s+\d{1,4}(동|호|층)$/.test(s)) return true;
      // "101-203호", "A-501호" 등 (하이픈 포함하되 동/호/층이 있는 경우)
      if (/^[A-Za-z]?\d{1,4}-\d{1,4}(호|층)$/.test(s)) return true;
      return true;
    }

    return false;
  };

  // 괄호 안 유닛만 상세로 이동
  main = main.replace(/\(([^)]+)\)/g, (_, inner) => {
    const t = inner.trim();
    if (isUnitToken(t)) detailParts.push(t);
    return '';
  });

  // 콤마 뒤 유닛 이동
  const segs = main.split(',').map(s => s.trim()).filter(Boolean);
  if (segs.length > 1) {
    const last = segs[segs.length - 1];
    if (isUnitToken(last)) {
      detailParts.push(last);
      segs.pop();
      main = segs.join(', ');
    }
  }

  // 끝부분 토큰 추출 (동/호/층이 명시된 경우만)
  const tokens = main.split(' ').filter(Boolean);
  const tail = [];
  while (tokens.length) {
    const tk = tokens[tokens.length - 1];
    // 동/호/층이 붙어있는 토큰만 추출
    if (/(동|호|층)$/.test(tk) && /\d/.test(tk)) {
      tail.unshift(tk);
      tokens.pop();
      continue;
    }
    // 이미 tail에 뭔가 있고 현재가 "A동" 형태면 추가
    if (/^[A-Za-z가-힣]+동$/i.test(tk) && tail.length) {
      tail.unshift(tk);
      tokens.pop();
      continue;
    }
    break;
  }

  if (tail.length) {
    const t = tail.join(' ').trim();
    if (isUnitToken(t)) {
      detailParts.push(t);
      main = tokens.join(' ').trim();
    }
  }

  const filtered = detailParts.filter(isUnitToken);
  const detail = filtered.join(' ').replace(/\s{2,}/g, ' ').trim();
  main = main.replace(/\s{2,}/g, ' ').trim();
  return { main, detail };
}

// 입력 주소와 후보 결과의 일치 여부를 엄격 검증
function extractNumbersToken(s) {
  const m = String(s || '').match(/\d{1,4}(?:-\d{1,4})?/);
  return m ? m[0] : '';
}
function extractRoadFromInput(s) {
  const m = String(s || '').match(/([^\s]+(?:로|길))/);
  return m ? m[1] : '';
}
function verifyJusoCandidate(input, item) {
  // 지역 일치: 시/도, 시/군/구 필수. 읍/면/동/리는 있으면 일치 요구.
  const comp = extractComponents(input);
  if (!regionMatchesCandidate(item, comp)) return false;
  // 주소 핵심 토큰 일치: 리/도로명/번지 중 하나 이상 포함
  const addrStr = ((item.roadAddr || '') + ' ' + (item.jibunAddr || '')).replace(/\s+/g, '');
  const riToken = (comp.ri || comp.dong || '').replace(/\s+/g, '');
  const roadToken = extractRoadFromInput(input).replace(/\s+/g, '');
  const numToken = extractNumbersToken(input);
  let ok = false;
  if (riToken && addrStr.includes(riToken)) ok = true;
  if (!ok && roadToken && addrStr.includes(roadToken)) ok = true;
  if (!ok && numToken && addrStr.includes(numToken.replace(/\s+/g, ''))) ok = true;
  return ok;
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
      const limitedRows = uniqueRows.slice(0, 500);

      console.log(`Excel parsed: ${headers.length} columns, ${rows.length} total rows`);
      console.log(`Duplicates removed: ${duplicatesRemoved}, Unique rows: ${uniqueRows.length}`);
      console.log(`Processing: ${limitedRows.length} rows (limited to 500)`);

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

      // 병렬 처리 함수 (동시성 10개로 증가)
      const addressDetailCache = new Map(); // splitAddressDetail 결과 캐싱
      const concurrency = 10; // 5 → 10으로 성능 향상
      const batchDelay = 100; // 배치 간 100ms 지연

      // 배치 생성
      const batches = [];
      for (let i = 0; i < limitedRows.length; i += concurrency) {
        batches.push(limitedRows.slice(i, Math.min(i + concurrency, limitedRows.length)));
      }

      console.log(`Processing ${limitedRows.length} addresses in ${batches.length} batches (concurrency: ${concurrency})`);

      // 배치별 병렬 처리
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const startIdx = batchIdx * concurrency;

        const batchPromises = batch.map(async (row, idx) => {
          const globalIdx = startIdx + idx;
          const address = row[addressColumnIndex];

          if (!address || typeof address !== 'string') {
            return { type: 'error', row: globalIdx + 2, error: '주소가 없습니다' };
          }

          try {
            // 캐싱된 splitAddressDetail 사용
            let cached = addressDetailCache.get(address);
            if (!cached) {
              cached = splitAddressDetail(address);
              addressDetailCache.set(address, cached);
            }

            const { main } = cached;
            const results = await jusoSearch(main || address, 50);
            const common = results?.common;

            if (common?.errorCode === '0' && Array.isArray(results?.juso)) {
              const cand = results.juso.find(it => verifyJusoCandidate(address, it));
              if (cand) {
                return {
                  type: 'success',
                  row: globalIdx + 2,
                  originalAddress: address,
                  postalCode: cand.zipNo || '',
                  fullAddress: cand.roadAddr || cand.jibunAddr || '',
                  sido: cand.siNm || '',
                  sigungu: cand.sggNm || ''
                };
              }
            }

            return {
              type: 'error',
              row: globalIdx + 2,
              address: address,
              error: '우편번호를 찾을 수 없습니다'
            };
          } catch (apiError) {
            return {
              type: 'error',
              row: globalIdx + 2,
              address: address,
              error: 'API 호출 실패: ' + apiError.message
            };
          }
        });

        // 배치 내 병렬 실행
        const batchResults = await Promise.all(batchPromises);

        // 결과 분류
        batchResults.forEach(result => {
          if (result.type === 'success') {
            jobData.results.push(result);
          } else {
            jobData.errors.push(result);
          }
        });

        jobData.processed = Math.min(startIdx + batch.length, limitedRows.length);

        // 배치 간 지연 (API 속도 제한 준수)
        if (batchIdx < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }

        console.log(`Batch ${batchIdx + 1}/${batches.length} completed - Success: ${jobData.results.length}, Errors: ${jobData.errors.length}`);
      }

      jobData.status = 'completed';
      jobData.progress = 100;

      // 임시 파일 삭제
      fs.unlinkSync(req.file.path);

      console.log('Processing completed - Success:', jobData.results.length, 'Errors:', jobData.errors.length);

      // Excel 파일 즉시 생성
      try {
        const XLSX = require('xlsx');

        // 시도/시군구 제외한 헤더 생성
        const newHeaders = headers.filter(h => {
          const lower = String(h).toLowerCase();
          return !lower.includes('시도') && !lower.includes('시/도') && !lower.includes('sido') &&
                 !lower.includes('시군구') && !lower.includes('시/군/구') && !lower.includes('sigungu');
        });
        newHeaders.push('도로명주소', '상세주소', '우편번호');

        // 결과 데이터를 엑셀 형식으로 변환
        const resultData = [newHeaders];

        // Map 기반 O(1) 조회로 최적화
        const resultsMap = new Map(
          jobData.results.map(r => [r.row, r])
        );

        // 원본 데이터에 우편번호 정보 추가
        limitedRows.forEach((row, index) => {
          const result = resultsMap.get(index + 2); // O(1) 조회
          const originalRow = Array.isArray(row) ? [...row] : Object.values(row || {});

          // 캐시된 상세주소 사용
          const originalAddress = originalRow[addressColumnIndex] || '';
          const cached = addressDetailCache.get(originalAddress);
          const detail = cached ? cached.detail : splitAddressDetail(originalAddress).detail;

          // 시도/시군구를 제외한 원본 데이터 복사
          const newRow = [];
          headers.forEach((h, idx) => {
            const lower = String(h).toLowerCase();
            const isSidoOrSigungu = lower.includes('시도') || lower.includes('시/도') || lower.includes('sido') ||
                                    lower.includes('시군구') || lower.includes('시/군/구') || lower.includes('sigungu');
            if (!isSidoOrSigungu) {
              newRow.push(originalRow[idx] || '');
            }
          });

          // 새 컬럼 추가: 도로명주소, 상세주소, 우편번호
          newRow.push(result ? (result.fullAddress || '') : '');
          newRow.push(detail || '');
          newRow.push(result ? (result.postalCode || '') : '');

          resultData.push(newRow);
        });

        // 워크북 생성
        const ws = XLSX.utils.aoa_to_sheet(resultData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');

        // 파일을 버퍼로 생성
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Base64로 인코딩하여 응답에 포함
        const base64Excel = buffer.toString('base64');

        console.log('Excel file generated - Success:', jobData.results.length, 'Errors:', jobData.errors.length);

        // JSON 응답에 Excel 데이터 포함
        return res.json({
          success: true,
          data: {
            jobId: jobId,
            filename: req.file.originalname,
            originalRows: rows.length,
            duplicatesRemoved: duplicatesRemoved,
            uniqueRows: uniqueRows.length,
            processedRows: limitedRows.length,
            successful: jobData.results.length,
            failed: jobData.errors.length,
            status: 'completed',
            excelData: base64Excel,
            message: `처리 완료: ${limitedRows.length}개 처리 (성공 ${jobData.results.length}개, 오류 ${jobData.errors.length}개)`
          }
        });
      } catch (excelError) {
        console.error('Excel generation error:', excelError);
        return res.status(500).json({
          success: false,
          error: '엑셀 파일 생성 중 오류가 발생했습니다: ' + excelError.message
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

      // 병렬 배치 처리로 성능 개선
      try {
        const BATCH_SIZE = 10; // 동시에 처리할 주소 수

        // 배치 단위로 처리
        for (let batchStart = 0; batchStart < job.rows.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, job.rows.length);
          const batchRows = job.rows.slice(batchStart, batchEnd);

          // 배치 내 모든 주소를 병렬 처리
          const batchPromises = batchRows.map(async (row, batchIndex) => {
            const globalIndex = batchStart + batchIndex;
            const rowNumber = globalIndex + 2; // Excel row number (header 고려)
            const address = row[job.addressColumnIndex];

            // 주소 검증
            if (!address || typeof address !== 'string') {
              return {
                type: 'error',
                data: { row: rowNumber, error: '주소가 없습니다' }
              };
            }

            try {
              // 1) 상세 제거한 메인 주소로 직접 검색
              const { main } = splitAddressDetail(address);
              const results = await jusoSearch(main || address, 50);
              const common = results?.common;

              if (common?.errorCode === '0' && Array.isArray(results?.juso)) {
                // 2) 후보에서 입력과 엄격 일치 검증 통과하는 첫 건만 채택
                const cand = results.juso.find(it => verifyJusoCandidate(address, it));
                if (cand) {
                  const juso = cand;
                  return {
                    type: 'success',
                    data: {
                      row: rowNumber,
                      originalAddress: address,
                      postalCode: juso.zipNo || '',
                      fullAddress: juso.roadAddr || juso.jibunAddr || '',
                      sido: juso.siNm || '',
                      sigungu: juso.sggNm || ''
                    }
                  };
                } else {
                  return {
                    type: 'error',
                    data: { row: rowNumber, address, error: '우편번호를 찾을 수 없습니다' }
                  };
                }
              } else {
                return {
                  type: 'error',
                  data: { row: rowNumber, address, error: '우편번호를 찾을 수 없습니다' }
                };
              }
            } catch (apiError) {
              return {
                type: 'error',
                data: {
                  row: rowNumber,
                  address: address,
                  error: 'API 호출 실패: ' + apiError.message
                }
              };
            }
          });

          // 배치 내 모든 요청을 동시 실행
          const batchResults = await Promise.all(batchPromises);

          // 결과 분류 및 저장
          batchResults.forEach(result => {
            if (result.type === 'success') {
              job.results.push(result.data);
            } else {
              job.errors.push(result.data);
            }
          });

          // 진행률 업데이트
          job.processed = batchEnd;

          // 배치 간 짧은 대기 (Rate Limit 보호)
          if (batchEnd < job.rows.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
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

      const originalHeaders = Array.isArray(job.headers) ? job.headers : [];
      const rows = Array.isArray(job.rows) ? job.rows : [];
      const addressColumnIndex = job.addressColumnIndex || 0;

      // 시도/시군구 제외한 헤더 생성
      const newHeaders = originalHeaders.filter(h => {
        const lower = String(h).toLowerCase();
        return !lower.includes('시도') && !lower.includes('시/도') && !lower.includes('sido') &&
               !lower.includes('시군구') && !lower.includes('시/군/구') && !lower.includes('sigungu');
      });
      newHeaders.push('도로명주소', '상세주소', '우편번호');

      // 결과 데이터를 엑셀 형식으로 변환
      const resultData = [newHeaders];

      // 원본 데이터에 우편번호 정보 추가
      rows.forEach((row, index) => {
        const result = job.results?.find(r => r.row === index + 2);
        const originalRow = Array.isArray(row) ? [...row] : Object.values(row || {});

        // 원본 주소에서 상세주소 추출
        const originalAddress = originalRow[addressColumnIndex] || '';
        const { detail } = splitAddressDetail(originalAddress);

        // 시도/시군구를 제외한 원본 데이터 복사
        const newRow = [];
        originalHeaders.forEach((h, idx) => {
          const lower = String(h).toLowerCase();
          const isSidoOrSigungu = lower.includes('시도') || lower.includes('시/도') || lower.includes('sido') ||
                                  lower.includes('시군구') || lower.includes('시/군/구') || lower.includes('sigungu');
          if (!isSidoOrSigungu) {
            newRow.push(originalRow[idx] || '');
          }
        });

        // 새 컬럼 추가: 도로명주소, 상세주소, 우편번호
        newRow.push(result ? (result.fullAddress || '') : '');
        newRow.push(detail || '');
        newRow.push(result ? (result.postalCode || '') : '');

        resultData.push(newRow);
      });

      console.log('Result data rows:', resultData.length);

      // 워크북 생성
      const ws = XLSX.utils.aoa_to_sheet(resultData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');

      // 파일을 버퍼로 생성
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      console.log('Excel buffer size:', buffer.length);

      // 파일명에 처리 결과 통계 포함
      const successCount = job.results?.length || 0;
      const errorCount = job.errors?.length || 0;
      const timestamp = new Date().getTime();
      const filename = `postal_result_성공${successCount}_오류${errorCount}_${timestamp}.xlsx`;

      // 다운로드 응답
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
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

// Export as Vercel-compatible serverless handler; intercept health early
let serverlessHandler = null;
try {
  const serverless = require('serverless-http');
  serverlessHandler = serverless(app);
} catch (_) {
  serverlessHandler = (req, res) => app(req, res);
}

module.exports = (req, res) => {
  try {
    if (req.url && (req.url === '/api/health' || req.url.startsWith('/api/health?'))) {
      return rawHealth(res);
    }
    return serverlessHandler(req, res);
  } catch (e) {
    try {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Handler error', message: String(e && e.message || e) }));
    } catch (_) {}
  }
};
