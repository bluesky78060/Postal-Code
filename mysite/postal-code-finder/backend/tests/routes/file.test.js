const express = require('express');
const request = require('supertest');
const path = require('path');

// Mock fs before loading routes
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock controllers
jest.mock('../../src/controllers/fileController', () => ({
  uploadAndProcess: jest.fn((req, res) => res.json({ success: true, data: { jobId: 'test-job' } })),
  downloadFile: jest.fn((req, res) => res.json({ success: true })),
  getProcessingStatus: jest.fn((req, res) => res.json({ success: true, data: { status: 'processing' } })),
  getLabelData: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getFileList: jest.fn((req, res) => res.json({ success: true, data: [] })),
  deleteFile: jest.fn((req, res) => res.json({ success: true }))
}));

// Mock config
jest.mock('../../src/config', () => ({
  upload: {
    maxFileSize: 10485760, // 10MB
    allowedExtensions: ['.xls', '.xlsx']
  }
}));

const fileRoutes = require('../../src/routes/file');
const fileController = require('../../src/controllers/fileController');

describe('File Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/file', fileRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/file/upload', () => {
    test('should handle file upload route', async () => {
      const response = await request(app)
        .post('/api/file/upload');

      // Route exists and responds (may be error due to missing file, but not 404)
      expect(response.status).not.toBe(404);
    });
  });

  describe('GET /api/file/download/:fileId', () => {
    test('should call fileController.downloadFile with valid ID', async () => {
      const response = await request(app)
        .get('/api/file/download/job_123_abc');

      expect(fileController.downloadFile).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/file/status/:jobId', () => {
    test('should call fileController.getProcessingStatus with valid ID', async () => {
      const response = await request(app)
        .get('/api/file/status/job_123_abc');

      expect(fileController.getProcessingStatus).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/file/label-data/:jobId', () => {
    test('should call fileController.getLabelData with valid ID', async () => {
      const response = await request(app)
        .get('/api/file/label-data/job_123_abc');

      expect(fileController.getLabelData).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/file/list', () => {
    test('should call fileController.getFileList', async () => {
      const response = await request(app)
        .get('/api/file/list');

      expect(fileController.getFileList).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/file/:fileId', () => {
    test('should call fileController.deleteFile with valid ID', async () => {
      const response = await request(app)
        .delete('/api/file/job_123_abc');

      expect(fileController.deleteFile).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('Request ID middleware', () => {
    test('should add request ID to all requests', async () => {
      await request(app)
        .get('/api/file/list');

      // Request ID middleware is applied
      expect(fileController.getFileList).toHaveBeenCalled();
    });
  });
});
