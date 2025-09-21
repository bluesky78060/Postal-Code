require('dotenv').config();
const path = require('path');

const config = {
  // 서버 설정
  port: process.env.PORT || 3001,
  
  // 환경 설정
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS 설정
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // 우편번호 제공자 설정
  postal: {
    provider: (process.env.POSTAL_PROVIDER || 'local').toLowerCase(), // local | kakao | koreapost | vworld | open
    localDataPath: process.env.LOCAL_DATA_PATH || path.join(__dirname, '../../data/postcodes.csv')
  },

  // API 키
  kakaoApiKey: process.env.KAKAO_API_KEY,
  jusoApiKey: process.env.JUSO_API_KEY,
  vworldApiKey: process.env.VWORLD_API_KEY,
  
  // Rate Limiting 설정
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15분
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.'
    }
  },
  
  // 파일 업로드 설정
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.xls', '.xlsx'],
    maxRows: parseInt(process.env.MAX_ROWS) || 1000
  },
  
  // 출력/변환 옵션
  output: {
    includeRoadAddress: (process.env.INCLUDE_ROAD_ADDRESS || 'true').toLowerCase() !== 'false' // 기본 on
  },
  
  // 작업 관리 설정
  jobs: {
    cleanupInterval: parseInt(process.env.JOB_CLEANUP_INTERVAL) || 60 * 60 * 1000, // 1시간
    retentionTime: parseInt(process.env.JOB_RETENTION_TIME) || 24 * 60 * 60 * 1000, // 24시간
  },
  
  // API 호출 제한 설정
  api: {
    kakaoRateLimit: {
      requestsPerSecond: parseInt(process.env.KAKAO_REQUESTS_PER_SECOND) || 10,
      burstDelay: parseInt(process.env.KAKAO_BURST_DELAY) || 100
    }
  },
  
  // 로깅 설정
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || null
  }
};

// 필수 환경 변수 검증 (선택한 provider에 따라)
const provider = (process.env.POSTAL_PROVIDER || 'local').toLowerCase();
if (provider === 'kakao' && !process.env.KAKAO_API_KEY) {
  console.warn('⚠️  Missing KAKAO_API_KEY for Kakao provider. Check your .env');
}
if (provider === 'juso' && !process.env.JUSO_API_KEY) {
  console.warn('⚠️  Missing JUSO_API_KEY for Juso provider. Check your .env');
}

module.exports = config;
