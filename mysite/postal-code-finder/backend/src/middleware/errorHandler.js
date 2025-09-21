const logger = require('../utils/logger');
const config = require('../config');

const errorHandler = (err, req, res, next) => {
  // 에러 로깅
  logger.error('API Error', err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 기본 에러 응답
  let status = 500;
  let message = '서버 내부 오류가 발생했습니다.';
  let details = null;

  // 특정 에러 타입 처리
  if (err.name === 'ValidationError') {
    status = 400;
    message = '입력 데이터가 유효하지 않습니다.';
    details = err.details || [];
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = '인증이 필요합니다.';
  } else if (err.code === 'ENOENT') {
    status = 404;
    message = '파일을 찾을 수 없습니다.';
  } else if (err.code === 'EACCES') {
    status = 403;
    message = '파일 접근 권한이 없습니다.';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = `파일 크기가 너무 큽니다. 최대 ${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB까지 업로드 가능합니다.`;
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    message = '허용되지 않는 파일 형식입니다.';
  }

  const response = {
    error: message,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  };

  // 개발 환경에서만 상세 정보 포함
  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
    response.details = err.message;
  }

  // 검증 오류 상세 정보 추가
  if (details) {
    response.validationErrors = details;
  }

  // 프로덕션 환경에서 민감한 정보 제거
  if (status >= 500 && config.nodeEnv === 'production') {
    response.error = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    delete response.details;
    delete response.stack;
  }

  res.status(status).json(response);
};

module.exports = errorHandler;