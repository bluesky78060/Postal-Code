const errorHandler = require('../../src/middleware/errorHandler');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn()
}));

jest.mock('../../src/config', () => ({
  nodeEnv: 'test',
  upload: {
    maxFileSize: 10485760 // 10MB
  }
}));

const logger = require('../../src/utils/logger');
const config = require('../../src/config');

describe('ErrorHandler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('Error Logging', () => {
    test('should log error with request metadata', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('API Error', error, {
        method: 'GET',
        url: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      });
    });
  });

  describe('ValidationError handling', () => {
    test('should return 400 for ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = [{ field: 'address', message: '주소는 필수입니다' }];

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '입력 데이터가 유효하지 않습니다.',
          validationErrors: error.details
        })
      );
    });

    test('should include validation details in response', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = [
        { field: 'address', message: '주소는 필수입니다' },
        { field: 'postalCode', message: '우편번호는 5자리여야 합니다' }
      ];

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.validationErrors).toEqual(error.details);
    });
  });

  describe('UnauthorizedError handling', () => {
    test('should return 401 for UnauthorizedError', () => {
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '인증이 필요합니다.'
        })
      );
    });
  });

  describe('File system errors', () => {
    test('should return 404 for ENOENT error', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '파일을 찾을 수 없습니다.'
        })
      );
    });

    test('should return 403 for EACCES error', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '파일 접근 권한이 없습니다.'
        })
      );
    });
  });

  describe('File upload errors', () => {
    test('should return 413 for LIMIT_FILE_SIZE error', () => {
      const error = new Error('File too large');
      error.code = 'LIMIT_FILE_SIZE';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('파일 크기가 너무 큽니다')
        })
      );
    });

    test('should return 400 for LIMIT_UNEXPECTED_FILE error', () => {
      const error = new Error('Unexpected file');
      error.code = 'LIMIT_UNEXPECTED_FILE';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '허용되지 않는 파일 형식입니다.'
        })
      );
    });
  });

  describe('Generic error handling', () => {
    test('should return 500 for generic errors', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '서버 내부 오류가 발생했습니다.'
        })
      );
    });
  });

  describe('Response metadata', () => {
    test('should include timestamp in response', () => {
      const error = new Error('Test error');
      const beforeTime = new Date().toISOString();

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
    });

    test('should include requestId from headers', () => {
      const error = new Error('Test error');
      req.headers['x-request-id'] = 'test-request-123';

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.requestId).toBe('test-request-123');
    });

    test('should use "unknown" requestId if not provided', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.requestId).toBe('unknown');
    });
  });

  describe('Development mode', () => {
    beforeEach(() => {
      config.nodeEnv = 'development';
    });

    test('should include stack trace in development', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.stack).toBe(error.stack);
      expect(response.details).toBe(error.message);
    });
  });

  describe('Production mode', () => {
    beforeEach(() => {
      config.nodeEnv = 'production';
    });

    test('should not include stack trace in production', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.stack).toBeUndefined();
    });

    test('should sanitize 5xx error messages in production', () => {
      const error = new Error('Database connection failed');

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error).toBe('서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      expect(response.details).toBeUndefined();
      expect(response.stack).toBeUndefined();
    });

    test('should preserve 4xx error messages in production', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = [{ field: 'address', message: '주소는 필수입니다' }];

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error).toBe('입력 데이터가 유효하지 않습니다.');
      expect(response.validationErrors).toBeDefined();
    });
  });
});
