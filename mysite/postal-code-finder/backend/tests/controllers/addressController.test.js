const addressController = require('../../src/controllers/addressController');

// Mock dependencies
jest.mock('../../src/services/postalCodeService');
jest.mock('../../src/utils/addressParser');

const postalCodeService = require('../../src/services/postalCodeService');
const addressParser = require('../../src/utils/addressParser');

describe('AddressController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('searchAddress', () => {
    test('should return postal code for valid address', async () => {
      req.body = { address: '서울시 강남구 테헤란로 152' };

      addressParser.normalizeAddress.mockReturnValue('서울시 강남구 테헤란로 152');
      postalCodeService.findPostalCode.mockResolvedValue({
        postalCode: '06236',
        fullAddress: '서울특별시 강남구 테헤란로 152',
        sido: '서울특별시',
        sigungu: '강남구',
        roadName: '테헤란로',
        buildingNumber: '152'
      });

      await addressController.searchAddress(req, res, next);

      expect(addressParser.normalizeAddress).toHaveBeenCalledWith('서울시 강남구 테헤란로 152');
      expect(postalCodeService.findPostalCode).toHaveBeenCalledWith('서울시 강남구 테헤란로 152');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          originalAddress: '서울시 강남구 테헤란로 152',
          normalizedAddress: '서울시 강남구 테헤란로 152',
          postalCode: '06236',
          fullAddress: '서울특별시 강남구 테헤란로 152'
        })
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 404 with suggestions for address not found', async () => {
      req.body = { address: '잘못된 주소' };

      addressParser.normalizeAddress.mockReturnValue('잘못된 주소');
      postalCodeService.findPostalCode.mockResolvedValue(null);
      postalCodeService.getSuggestions.mockResolvedValue([
        { address: '제안 주소 1', postalCode: '12345' },
        { address: '제안 주소 2', postalCode: '67890' }
      ]);

      await addressController.searchAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: '주소를 찾을 수 없습니다.',
        searchedAddress: '잘못된 주소',
        suggestions: expect.arrayContaining([
          expect.objectContaining({ address: '제안 주소 1' })
        ])
      });
    });

    test('should handle errors and call next', async () => {
      req.body = { address: '테스트 주소' };

      const error = new Error('Database error');
      addressParser.normalizeAddress.mockReturnValue('테스트 주소');
      postalCodeService.findPostalCode.mockRejectedValue(error);

      await addressController.searchAddress(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('autocomplete', () => {
    test('should return autocomplete suggestions', async () => {
      req.query = { q: '서울', limit: '5' };

      postalCodeService.getAutocomplete.mockResolvedValue([
        { address: '서울시 강남구', postalCode: '06236' },
        { address: '서울시 서초구', postalCode: '06500' }
      ]);

      await addressController.autocomplete(req, res, next);

      expect(postalCodeService.getAutocomplete).toHaveBeenCalledWith('서울', 5);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          query: '서울',
          suggestions: expect.arrayContaining([
            expect.objectContaining({ address: '서울시 강남구' })
          ])
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should use default limit if not provided', async () => {
      req.query = { q: '서울' };

      postalCodeService.getAutocomplete.mockResolvedValue([]);

      await addressController.autocomplete(req, res, next);

      expect(postalCodeService.getAutocomplete).toHaveBeenCalledWith('서울', 10);
    });

    test('should handle autocomplete errors', async () => {
      req.query = { q: '서울' };

      const error = new Error('Service error');
      postalCodeService.getAutocomplete.mockRejectedValue(error);

      await addressController.autocomplete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('searchByPostalCode', () => {
    test('should return addresses for valid postal code', async () => {
      req.params = { postalCode: '06236' };

      postalCodeService.findByPostalCode.mockResolvedValue([
        { address: '서울시 강남구 테헤란로 152', postalCode: '06236' },
        { address: '서울시 강남구 테헤란로 154', postalCode: '06236' }
      ]);

      await addressController.searchByPostalCode(req, res, next);

      expect(postalCodeService.findByPostalCode).toHaveBeenCalledWith('06236');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          postalCode: '06236',
          addresses: expect.arrayContaining([
            expect.objectContaining({ postalCode: '06236' })
          ])
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 404 for postal code not found', async () => {
      req.params = { postalCode: '99999' };

      postalCodeService.findByPostalCode.mockResolvedValue([]);

      await addressController.searchByPostalCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: '해당 우편번호의 주소를 찾을 수 없습니다.',
        postalCode: '99999'
      });
    });

    test('should return 404 for null result', async () => {
      req.params = { postalCode: '00000' };

      postalCodeService.findByPostalCode.mockResolvedValue(null);

      await addressController.searchByPostalCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should handle search by postal code errors', async () => {
      req.params = { postalCode: '06236' };

      const error = new Error('Service error');
      postalCodeService.findByPostalCode.mockRejectedValue(error);

      await addressController.searchByPostalCode(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('batchSearch', () => {
    test('should process multiple addresses successfully', async () => {
      req.body = {
        addresses: [
          '서울시 강남구 테헤란로 152',
          '부산시 해운대구 센텀로 78'
        ]
      };

      addressParser.normalizeAddress
        .mockReturnValueOnce('서울시 강남구 테헤란로 152')
        .mockReturnValueOnce('부산시 해운대구 센텀로 78');

      postalCodeService.findPostalCode
        .mockResolvedValueOnce({
          postalCode: '06236',
          fullAddress: '서울특별시 강남구 테헤란로 152'
        })
        .mockResolvedValueOnce({
          postalCode: '48058',
          fullAddress: '부산광역시 해운대구 센텀로 78'
        });

      await addressController.batchSearch(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 2,
          successful: 2,
          failed: 0,
          results: expect.arrayContaining([
            expect.objectContaining({
              index: 0,
              postalCode: '06236',
              success: true
            }),
            expect.objectContaining({
              index: 1,
              postalCode: '48058',
              success: true
            })
          ]),
          errors: []
        }
      });
    });

    test('should handle mix of successful and failed addresses', async () => {
      req.body = {
        addresses: [
          '서울시 강남구 테헤란로 152',
          '잘못된 주소',
          '부산시 해운대구 센텀로 78'
        ]
      };

      addressParser.normalizeAddress
        .mockReturnValueOnce('서울시 강남구 테헤란로 152')
        .mockReturnValueOnce('잘못된 주소')
        .mockReturnValueOnce('부산시 해운대구 센텀로 78');

      postalCodeService.findPostalCode
        .mockResolvedValueOnce({
          postalCode: '06236',
          fullAddress: '서울특별시 강남구 테헤란로 152'
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          postalCode: '48058',
          fullAddress: '부산광역시 해운대구 센텀로 78'
        });

      postalCodeService.getSuggestions.mockResolvedValue([]);

      await addressController.batchSearch(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          total: 3,
          successful: 2,
          failed: 1
        })
      });
    });

    test('should handle service errors in batch processing', async () => {
      req.body = {
        addresses: [
          '서울시 강남구 테헤란로 152',
          '에러를 발생시킬 주소'
        ]
      };

      addressParser.normalizeAddress
        .mockReturnValueOnce('서울시 강남구 테헤란로 152')
        .mockReturnValueOnce('에러를 발생시킬 주소');

      postalCodeService.findPostalCode
        .mockResolvedValueOnce({
          postalCode: '06236',
          fullAddress: '서울특별시 강남구 테헤란로 152'
        })
        .mockRejectedValueOnce(new Error('Service error'));

      await addressController.batchSearch(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          total: 2,
          successful: 1,
          failed: 1,
          errors: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              error: 'Service error'
            })
          ])
        })
      });
    });

    test('should handle controller-level errors', async () => {
      req.body = { addresses: null }; // Will cause error when trying to iterate

      await addressController.batchSearch(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
