const config = require('../config');

class Logger {
  constructor() {
    this.level = config.logging.level;
    this.logFile = config.logging.file;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | Meta: ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // 콘솔 출력
    console.log(formattedMessage);
    
    // 파일 출력 (향후 구현)
    if (this.logFile) {
      // TODO: 파일 로깅 구현
    }
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? { 
      ...meta, 
      error: error.message, 
      stack: error.stack 
    } : meta;
    this.log('error', message, errorMeta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    if (this.level === 'debug') {
      this.log('debug', message, meta);
    }
  }

  // API 요청 로깅
  logRequest(req, res, responseTime) {
    this.info('API Request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    });
  }

  // 파일 처리 로깅
  logFileProcessing(jobId, filename, status, details = {}) {
    this.info('File Processing', {
      jobId,
      filename,
      status,
      ...details
    });
  }
}

module.exports = new Logger();