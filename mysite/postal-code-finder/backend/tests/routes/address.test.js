const express = require('express');
const request = require('supertest');

// Mock controllers before loading routes
jest.mock('../../src/controllers/addressController', () => ({
  searchAddress: jest.fn((req, res) => res.json({ success: true, data: {} })),
  autocomplete: jest.fn((req, res) => res.json({ success: true, data: [] })),
  searchByPostalCode: jest.fn((req, res) => res.json({ success: true, data: [] })),
  batchSearch: jest.fn((req, res) => res.json({ success: true, data: {} }))
}));

// Mock axios for GET /search route
jest.mock('axios');

// Mock config
jest.mock('../../src/config', () => ({
  upload: {
    maxFileSize: 10485760,
    allowedExtensions: ['.xls', '.xlsx']
  }
}));

const addressRoutes = require('../../src/routes/address');
const addressController = require('../../src/controllers/addressController');
const axios = require('axios');

describe('Address Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/address', addressRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/address/search', () => {
    test('should call addressController.searchAddress with valid data', async () => {
      const response = await request(app)
        .post('/api/address/search')
        .send({ address: '서울시 강남구 테헤란로 152' });

      expect(addressController.searchAddress).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/address/search', () => {
    test('should proxy search to Juso API', async () => {
      process.env.JUSO_API_KEY = 'test-key';

      axios.get.mockResolvedValue({
        data: {
          results: {
            common: {
              errorCode: '0',
              totalCount: '10',
              currentPage: '1',
              countPerPage: '10'
            },
            juso: [{ roadAddr: '서울시 강남구 테헤란로 152', zipNo: '06236' }]
          }
        }
      });

      const response = await request(app)
        .get('/api/address/search')
        .query({ q: '테헤란로' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
    });

    test('should reject empty query', async () => {
      const response = await request(app)
        .get('/api/address/search')
        .query({ q: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('검색어를 입력');
    });

    test('should reject SQL injection keywords', async () => {
      const response = await request(app)
        .get('/api/address/search')
        .query({ q: 'SELECT * FROM users' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('예약어');
    });

    test('should reject bad characters', async () => {
      const response = await request(app)
        .get('/api/address/search')
        .query({ q: '<script>alert(1)</script>' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('문자는 사용할 수 없습니다');
    });

    test('should return error if JUSO_API_KEY not set', async () => {
      delete process.env.JUSO_API_KEY;
      delete process.env.JUSO_KEY;

      const response = await request(app)
        .get('/api/address/search')
        .query({ q: '테헤란로' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('JUSO_API_KEY');
    });
  });

  describe('GET /api/address/autocomplete', () => {
    test('should call addressController.autocomplete with valid query', async () => {
      const response = await request(app)
        .get('/api/address/autocomplete')
        .query({ q: '서울' });

      expect(addressController.autocomplete).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    test('should accept optional limit parameter', async () => {
      const response = await request(app)
        .get('/api/address/autocomplete')
        .query({ q: '서울', limit: 5 });

      expect(addressController.autocomplete).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/address/postal/:postalCode', () => {
    test('should call addressController.searchByPostalCode with valid postal code', async () => {
      const response = await request(app)
        .get('/api/address/postal/06236');

      expect(addressController.searchByPostalCode).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/address/batch', () => {
    test('should call addressController.batchSearch with valid addresses', async () => {
      const response = await request(app)
        .post('/api/address/batch')
        .send({
          addresses: [
            '서울시 강남구 테헤란로 152',
            '부산시 해운대구 센텀로 78'
          ]
        });

      expect(addressController.batchSearch).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });
});
