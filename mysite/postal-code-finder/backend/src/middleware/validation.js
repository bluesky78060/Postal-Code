const { body, param, query, validationResult } = require('express-validator');
const config = require('../config');

// 유효성 검사 결과 처리 미들웨어
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.details = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    return next(error);
  }
  
  next();
};

// 주소 검색 유효성 검사
const validateAddressSearch = [
  body('address')
    .notEmpty()
    .withMessage('주소는 필수입니다')
    .isLength({ min: 2, max: 200 })
    .withMessage('주소는 2자 이상 200자 이하여야 합니다')
    .trim(),
  handleValidationErrors
];

// 배치 주소 검색 유효성 검사
const validateBatchAddressSearch = [
  body('addresses')
    .isArray({ min: 1, max: 100 })
    .withMessage('주소 배열은 1개 이상 100개 이하여야 합니다'),
  body('addresses.*')
    .notEmpty()
    .withMessage('각 주소는 비어있을 수 없습니다')
    .isLength({ min: 2, max: 200 })
    .withMessage('각 주소는 2자 이상 200자 이하여야 합니다')
    .trim(),
  handleValidationErrors
];

// 우편번호 검색 유효성 검사
const validatePostalCodeSearch = [
  param('postalCode')
    .matches(/^\d{5}$/)
    .withMessage('우편번호는 5자리 숫자여야 합니다'),
  handleValidationErrors
];

// 자동완성 쿼리 유효성 검사
const validateAutocomplete = [
  query('q')
    .notEmpty()
    .withMessage('검색어는 필수입니다')
    .isLength({ min: 1, max: 100 })
    .withMessage('검색어는 1자 이상 100자 이하여야 합니다')
    .trim(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('제한 개수는 1 이상 50 이하의 정수여야 합니다'),
  handleValidationErrors
];

// 작업 ID 유효성 검사
const validateJobId = [
  param('jobId')
    .matches(/^job_\d+_[a-z0-9]+$/)
    .withMessage('유효하지 않은 작업 ID입니다'),
  handleValidationErrors
];

// 파일 ID 유효성 검사  
const validateFileId = [
  param('fileId')
    .matches(/^job_\d+_[a-z0-9]+$/)
    .withMessage('유효하지 않은 파일 ID입니다'),
  handleValidationErrors
];

// 파일 업로드 유효성 검사 (multer 이후)
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    const error = new Error('파일이 업로드되지 않았습니다');
    error.name = 'ValidationError';
    return next(error);
  }

  // 파일 확장자 검사
  const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
  const allowedExtensions = config.upload.allowedExtensions.map(ext => ext.substring(1));
  
  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error(`허용되지 않는 파일 형식입니다. 허용 형식: ${config.upload.allowedExtensions.join(', ')}`);
    error.name = 'ValidationError';
    return next(error);
  }

  // 파일 크기 검사 (multer에서도 체크하지만 추가 검증)
  if (req.file.size > config.upload.maxFileSize) {
    const error = new Error(`파일 크기가 너무 큽니다. 최대 ${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB까지 업로드 가능합니다`);
    error.name = 'ValidationError';
    return next(error);
  }

  next();
};

// Request ID 추가 미들웨어
const addRequestId = (req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  next();
};

module.exports = {
  validateAddressSearch,
  validateBatchAddressSearch,
  validatePostalCodeSearch,
  validateAutocomplete,
  validateJobId,
  validateFileId,
  validateFileUpload,
  addRequestId,
  handleValidationErrors
};