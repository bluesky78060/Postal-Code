// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 설정 파일 가져오기
const config = require('../backend/src/config');

// 라우트 가져오기
const addressRoutes = require('../backend/src/routes/address');
const fileRoutes = require('../backend/src/routes/file');

// 미들웨어 가져오기
const errorHandler = require('../backend/src/middleware/errorHandler');

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

// 라우트 설정
app.use('/api/address', addressRoutes);
app.use('/api/file', fileRoutes);

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