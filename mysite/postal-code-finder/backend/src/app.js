const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// 설정 파일 가져오기
const config = require('./config');

// 라우트 가져오기
const addressRoutes = require('./routes/address');
const fileRoutes = require('./routes/file');

// 미들웨어 가져오기
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = Number(config.port) || 3001;

// 보안 미들웨어 (개발 편의를 위한 CSP 완화: inline script/style 허용)
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

// CORS 설정 (동적 포트 허용)
app.use(cors({
  origin: (origin, callback) => {
    // localhost와 127.0.0.1의 모든 포트 허용
    const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    
    const allowed = [
      config.frontendUrl,
      'null' // 파일 스킴(file://)에서의 요청 허용
    ];
    
    if (!origin || allowed.includes(origin) || localhostRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// API 제한 설정 (상태/다운로드/헬스 체크는 제외)
const limiter = rateLimit({
  ...config.rateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p.startsWith('/file/status') || p.startsWith('/file/download') || p === '/health';
  }
});
app.use('/api/', limiter);

// 모든 요청 로깅 (디버깅용)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`🔍 ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });
  next();
});

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 라우트 설정
app.use('/api/address', addressRoutes);
app.use('/api/file', fileRoutes);

// 정적 파일 서빙
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '우편번호 자동 입력 API 서버',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      address: '/api/address',
      file: '/api/file'
    }
  });
});

const multer = require('multer');

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `파일 크기가 너무 큽니다. 최대 ${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB 입니다.` });
    }
    // 기타 멀터 에러 (잘못된 필드명, 파일 타입 등)
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

// 서버 시작 (HTTPS 지원) + 포트 점유 시 자동 증가
const { SSL_KEY_PATH, SSL_CERT_PATH } = process.env;

function startServer(port, attempts = 0) {
  port = Number(port);
  const useHttps = SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);
  const onListening = () => {
    const proto = useHttps ? 'https' : 'http';
    const lock = useHttps ? '🔒' : '🚀';
    console.log(`${lock} 서버가 포트 ${port}에서 실행 중입니다.`);
    console.log(`📍 API: ${proto}://localhost:${port}`);
  };
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attempts < 10) {
      const nextPort = port + 1;
      if (nextPort >= 65536) {
        throw new RangeError('No available port below 65536');
      }
      console.warn(`⚠️ 포트 ${port} 사용 중. 다음 포트 시도: ${nextPort}`);
      startServer(nextPort, attempts + 1);
    } else {
      throw err;
    }
  };

  if (useHttps) {
    const options = { key: fs.readFileSync(SSL_KEY_PATH), cert: fs.readFileSync(SSL_CERT_PATH) };
    const server = https.createServer(options, app);
    server.on('error', onError);
    server.listen(port, onListening);
  } else {
    const server = http.createServer(app);
    server.on('error', onError);
    server.listen(port, onListening);
  }
}

startServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
