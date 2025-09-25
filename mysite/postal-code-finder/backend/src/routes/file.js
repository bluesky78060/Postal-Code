const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fileController = require('../controllers/fileController');
const config = require('../config');
const { validateJobId, validateFileId, addRequestId } = require('../middleware/validation');

const router = express.Router();
router.use(addRequestId);

// 업로드 디렉토리 생성 및 보장
const uploadDir = path.join(__dirname, '../', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 안전한 파일명 생성 (TypeError 방지)
    const originalName = file.originalname || 'unknown.tmp';
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(originalName);
    cb(null, `${timestamp}-${randomString}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (config.upload.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      // MulterError를 발생시켜 전역 핸들러에서 처리하도록 함
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      err.message = `허용되지 않는 파일 형식입니다. 허용: ${config.upload.allowedExtensions.join(', ')}`;
      cb(err, false);
    }
  }
});

// 라우트 정의
router.post('/upload', upload.single('file'), fileController.uploadAndProcess);
router.get('/download/:fileId', validateFileId, fileController.downloadFile);
router.get('/status/:jobId', validateJobId, fileController.getProcessingStatus);
router.get('/label-data/:jobId', validateJobId, fileController.getLabelData);
router.get('/hwpx/:jobId', validateJobId, fileController.generateHwpx);
router.get('/list', fileController.getFileList);
router.delete('/:fileId', validateFileId, fileController.deleteFile);

module.exports = router;

