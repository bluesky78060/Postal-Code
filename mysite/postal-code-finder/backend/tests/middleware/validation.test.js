// Mock express-validator
jest.mock('express-validator', () => ({
  body: jest.fn(() => ({
    notEmpty: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    isArray: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis()
  })),
  param: jest.fn(() => ({
    matches: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })),
  query: jest.fn(() => ({
    notEmpty: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis()
  })),
  validationResult: jest.fn()
}));

// Mock config
jest.mock('../../src/config', () => ({
  upload: {
    maxFileSize: 10485760, // 10MB
    allowedExtensions: ['.xls', '.xlsx']
  }
}));

const {
  validateAddressSearch,
  validateBatchAddressSearch,
  validatePostalCodeSearch,
  validateAutocomplete,
  validateJobId,
  validateFileId,
  validateFileUpload,
  addRequestId,
  handleValidationErrors
} = require('../../src/middleware/validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      file: null,
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('handleValidationErrors', () => {
    test('should call next if no validation errors', () => {
      // Mock validationResult to return no errors
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      handleValidationErrors(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should call next with ValidationError if errors exist', () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { path: 'address', msg: '주소는 필수입니다', value: undefined }
        ]
      });

      handleValidationErrors(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'address',
              message: '주소는 필수입니다'
            })
          ])
        })
      );
    });

    test('should format multiple validation errors', () => {
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { path: 'address', msg: '주소는 필수입니다', value: '' },
          { path: 'postalCode', msg: '우편번호 형식이 올바르지 않습니다', value: '123' }
        ]
      });

      handleValidationErrors(req, res, next);

      const error = next.mock.calls[0][0];
      expect(error.details).toHaveLength(2);
      expect(error.details[0].field).toBe('address');
      expect(error.details[1].field).toBe('postalCode');
    });
  });

  describe('validateFileUpload', () => {
    test('should return error if no file uploaded', () => {
      req.file = null;

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          message: '파일이 업로드되지 않았습니다'
        })
      );
    });

    test('should accept valid Excel file', () => {
      req.file = {
        originalname: 'test.xlsx',
        size: 1024 * 1024 // 1MB
      };

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should accept .xls file', () => {
      req.file = {
        originalname: 'test.xls',
        size: 1024 * 1024
      };

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should reject file with invalid extension', () => {
      req.file = {
        originalname: 'test.pdf',
        size: 1024 * 1024
      };

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          message: expect.stringContaining('허용되지 않는 파일 형식입니다')
        })
      );
    });

    test('should reject file exceeding size limit', () => {
      req.file = {
        originalname: 'test.xlsx',
        size: 20 * 1024 * 1024 // 20MB
      };

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          message: expect.stringContaining('파일 크기가 너무 큽니다')
        })
      );
    });

    test('should handle uppercase file extensions', () => {
      req.file = {
        originalname: 'TEST.XLSX',
        size: 1024 * 1024
      };

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should handle mixed case file extensions', () => {
      req.file = {
        originalname: 'test.XLSx',
        size: 1024 * 1024
      };

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('addRequestId', () => {
    test('should add request ID if not present', () => {
      addRequestId(req, res, next);

      expect(req.headers['x-request-id']).toBeDefined();
      expect(req.headers['x-request-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(next).toHaveBeenCalledWith();
    });

    test('should preserve existing request ID', () => {
      req.headers['x-request-id'] = 'existing-request-123';

      addRequestId(req, res, next);

      expect(req.headers['x-request-id']).toBe('existing-request-123');
      expect(next).toHaveBeenCalledWith();
    });

    test('should generate unique request IDs', () => {
      const req1 = { headers: {} };
      const req2 = { headers: {} };

      addRequestId(req1, res, next);
      addRequestId(req2, res, next);

      expect(req1.headers['x-request-id']).not.toBe(req2.headers['x-request-id']);
    });
  });

  describe('Validation rule arrays', () => {
    test('validateAddressSearch should be an array', () => {
      expect(Array.isArray(validateAddressSearch)).toBe(true);
      expect(validateAddressSearch.length).toBeGreaterThan(0);
    });

    test('validateBatchAddressSearch should be an array', () => {
      expect(Array.isArray(validateBatchAddressSearch)).toBe(true);
      expect(validateBatchAddressSearch.length).toBeGreaterThan(0);
    });

    test('validatePostalCodeSearch should be an array', () => {
      expect(Array.isArray(validatePostalCodeSearch)).toBe(true);
      expect(validatePostalCodeSearch.length).toBeGreaterThan(0);
    });

    test('validateAutocomplete should be an array', () => {
      expect(Array.isArray(validateAutocomplete)).toBe(true);
      expect(validateAutocomplete.length).toBeGreaterThan(0);
    });

    test('validateJobId should be an array', () => {
      expect(Array.isArray(validateJobId)).toBe(true);
      expect(validateJobId.length).toBeGreaterThan(0);
    });

    test('validateFileId should be an array', () => {
      expect(Array.isArray(validateFileId)).toBe(true);
      expect(validateFileId.length).toBeGreaterThan(0);
    });

    test('all validation arrays should end with handleValidationErrors', () => {
      expect(validateAddressSearch[validateAddressSearch.length - 1]).toBe(handleValidationErrors);
      expect(validateBatchAddressSearch[validateBatchAddressSearch.length - 1]).toBe(handleValidationErrors);
      expect(validatePostalCodeSearch[validatePostalCodeSearch.length - 1]).toBe(handleValidationErrors);
      expect(validateAutocomplete[validateAutocomplete.length - 1]).toBe(handleValidationErrors);
      expect(validateJobId[validateJobId.length - 1]).toBe(handleValidationErrors);
      expect(validateFileId[validateFileId.length - 1]).toBe(handleValidationErrors);
    });
  });
});
