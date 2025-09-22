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

    const results = response.data?.results;
    
    // 디버깅을 위한 로그
    console.log('JUSO API Response:', JSON.stringify(response.data, null, 2));
    
    if (!results) {
      throw new Error('JUSO API 응답이 없습니다');
    }
    
    if (results.errorCode !== '0') {
      throw new Error(`JUSO API 오류 ${results.errorCode}: ${results.errorMessage || '알 수 없는 오류'}`);
    }

    const juso = results.juso?.[0];
    if (!juso) {
      throw new Error('검색 결과 없음');
    }

    const result = {
      postalCode: juso.zipNo || '',
      fullAddress: juso.roadAddr || juso.jibunAddr || '',
      sido: juso.siNm || '',
      sigungu: juso.sggNm || ''
    };
    
    if (!result) {
      return res.json({
        success: false,
        error: '해당 주소의 우편번호를 찾을 수 없습니다.'
      });
    }

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

// 라우트 설정 (오류 발생 시 위의 기본 핸들러 사용)
if (typeof addressRoutes === 'function' && addressRoutes.length < 3) {
  app.use('/api/address', addressRoutes);
} else {
  console.log('Using fallback address routes');
}

if (typeof fileRoutes === 'function' && fileRoutes.length < 3) {
  app.use('/api/file', fileRoutes);
} else {
  console.log('Using fallback file routes');
}

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const multer = require('multer');

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