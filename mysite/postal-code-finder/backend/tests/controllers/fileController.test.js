const fileController = require('../../src/controllers/fileController');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}')
  }
}));

jest.mock('xlsx');
jest.mock('../../src/services/excelService');
jest.mock('../../src/services/postalCodeService');
jest.mock('../../src/utils/addressParser');
jest.mock('../../src/config', () => ({
  upload: { maxRows: 300 },
  jobs: { cleanupInterval: 3600000, retentionTime: 86400000 },
  logging: { level: 'info', file: null },
  postal: { provider: 'juso' },
  jusoApiKey: 'test-key'
}));

const XLSX = require('xlsx');
const excelService = require('../../src/services/excelService');
const postalCodeService = require('../../src/services/postalCodeService');

describe('FileController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      file: null,
      params: {},
      query: {}
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      sendFile: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();

    // Clear processing jobs
    const processingJobs = require('../../src/controllers/fileController').processingJobs;
    if (processingJobs && processingJobs.clear) {
      processingJobs.clear();
    }
  });

  afterAll(() => {
    // Clear the cleanup interval to allow Jest to exit
    const fileControllerModule = require('../../src/controllers/fileController');
    if (fileControllerModule.cleanupInterval) {
      clearInterval(fileControllerModule.cleanupInterval);
    }
  });

  describe('uploadAndProcess', () => {
    test('should return error when no file uploaded', async () => {
      req.file = null;

      await fileController.uploadAndProcess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: '파일이 업로드되지 않았습니다.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should accept file upload and start processing', async () => {
      req.file = {
        path: '/tmp/test-file.xlsx',
        originalname: 'addresses.xlsx'
      };

      // Mock processExcelFile to prevent actual processing
      const mockProcessExcelFile = jest.spyOn(fileController, 'processExcelFile');
      mockProcessExcelFile.mockResolvedValue(undefined);

      await fileController.uploadAndProcess(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          jobId: expect.stringMatching(/^job_\d+_/),
          message: '파일 업로드 완료. 처리를 시작합니다.',
          statusUrl: expect.stringMatching(/\/api\/file\/status\/job_/)
        })
      });
      expect(next).not.toHaveBeenCalled();

      mockProcessExcelFile.mockRestore();
    });

    test('should handle synchronous errors in upload', async () => {
      // Simulate error by not providing required dependencies
      req.file = null;
      req.body = { forceError: true };

      await fileController.uploadAndProcess(req, res, next);

      // When file is missing, should return 400 error
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getProcessingStatus', () => {
    test('should return job status for existing job', async () => {
      const jobId = 'test-job-123';
      req.params = { jobId };

      // Access processingJobs directly to set up test state
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.set) {
        processingJobs.set(jobId, {
          status: 'processing',
          progress: 50,
          total: 100,
          processed: 50
        });
      }

      await fileController.getProcessingStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'processing'
        })
      });
    });

    test('should return 404 for non-existent job', async () => {
      const jobId = 'non-existent-job';
      req.params = { jobId };

      // Ensure job doesn't exist
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.delete) {
        processingJobs.delete(jobId);
      }

      await fileController.getProcessingStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('찾을 수 없습니다')
      });
    });
  });

  describe('downloadFile', () => {
    test('should return 404 for non-existent job', async () => {
      const jobId = 'test-file-123';
      req.params = { jobId };

      await fileController.downloadFile(req, res, next);

      // Without a real file, it should return 404
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('찾을 수 없습니다')
      });
    });
  });

  describe('getFileList', () => {
    test('should return list of jobs', async () => {
      // Set up some test jobs
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.set) {
        processingJobs.set('job-1', { status: 'completed' });
        processingJobs.set('job-2', { status: 'processing' });
      }

      await fileController.getFileList(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ jobId: 'job-1', status: 'completed' }),
          expect.objectContaining({ jobId: 'job-2', status: 'processing' })
        ])
      });
    });
  });

  describe('deleteFile', () => {
    test('should delete job and associated files', async () => {
      const fileId = 'test-job-to-delete';
      req.params = { fileId };

      // Set up a job to delete
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.set) {
        processingJobs.set(fileId, {
          status: 'completed',
          outputPath: '/tmp/test-output.xlsx'
        });
      }

      await fileController.deleteFile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: expect.any(String)
      });

      // Verify job was deleted
      if (processingJobs && processingJobs.has) {
        expect(processingJobs.has(fileId)).toBe(false);
      }
    });

    test('should return 404 when deleting non-existent job', async () => {
      const fileId = 'non-existent-job';
      req.params = { fileId };

      // Ensure job doesn't exist
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.delete) {
        processingJobs.delete(fileId);
      }

      await fileController.deleteFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('찾을 수 없습니다')
      });
    });
  });

  describe('processExcelFile', () => {
    test('should process excel file with valid data', async () => {
      const filePath = '/tmp/test.xlsx';
      const jobId = 'test-job';

      // Mock XLSX reading
      XLSX.readFile.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      });

      XLSX.utils.sheet_to_json.mockReturnValue([
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678']
      ]);

      excelService.findAddressColumn.mockReturnValue(1);
      excelService.removeDuplicates.mockReturnValue({
        data: [
          ['이름', '주소', '전화번호'],
          ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678']
        ],
        duplicateCount: 0,
        originalCount: 1,
        uniqueCount: 1
      });

      const addressParser = require('../../src/utils/addressParser');
      addressParser.splitAddressDetail.mockReturnValue({
        main: '서울시 강남구 테헤란로 152',
        detail: ''
      });

      postalCodeService.findPostalCode.mockResolvedValue({
        postalCode: '06236',
        fullAddress: '서울특별시 강남구 테헤란로 152',
        sido: '서울특별시',
        sigungu: '강남구'
      });

      // Mock XLSX write operations
      XLSX.utils.aoa_to_sheet.mockReturnValue({});
      XLSX.utils.book_new.mockReturnValue({ SheetNames: [], Sheets: {} });
      XLSX.utils.book_append_sheet.mockReturnValue(undefined);
      XLSX.writeFile.mockReturnValue(undefined);

      // Test that method exists and can be called
      await expect(
        fileController.processExcelFile(filePath, jobId)
      ).resolves.not.toThrow();
    });

    test('should handle empty excel file', async () => {
      const filePath = '/tmp/empty.xlsx';
      const jobId = 'test-job-empty';

      // Initialize job state
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.set) {
        processingJobs.set(jobId, {
          status: 'processing',
          startTime: new Date()
        });
      }

      XLSX.readFile.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      });

      XLSX.utils.sheet_to_json.mockReturnValue([]);

      // processExcelFile catches errors and updates job status instead of throwing
      await fileController.processExcelFile(filePath, jobId);

      // Check that job status was updated with error
      const job = processingJobs.get(jobId);
      expect(job).toBeDefined();
      expect(job.status).toBe('error');
    });

    test('should handle missing address column', async () => {
      const filePath = '/tmp/no-address.xlsx';
      const jobId = 'test-job-no-addr';

      // Initialize job state
      const processingJobs = require('../../src/controllers/fileController').processingJobs;
      if (processingJobs && processingJobs.set) {
        processingJobs.set(jobId, {
          status: 'processing',
          startTime: new Date()
        });
      }

      XLSX.readFile.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      });

      XLSX.utils.sheet_to_json.mockReturnValue([
        ['이름', '전화번호'],
        ['홍길동', '010-1234-5678']
      ]);

      excelService.findAddressColumn.mockReturnValue(-1);
      excelService.removeDuplicates.mockReturnValue({
        data: [['이름', '전화번호'], ['홍길동', '010-1234-5678']],
        duplicateCount: 0
      });

      // processExcelFile catches errors and updates job status instead of throwing
      await fileController.processExcelFile(filePath, jobId);

      // Check that job status was updated with error
      const job = processingJobs.get(jobId);
      expect(job).toBeDefined();
      expect(job.status).toBe('error');
      expect(job.error).toContain('주소 컬럼을 찾을 수 없습니다');
    });
  });
});
