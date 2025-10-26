const JusoPostalCodeService = require('../../../src/services/providers/jusoPostalCodeService');

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/config', () => ({
  jusoApiKey: 'test-api-key'
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const axios = require('axios');

describe('JusoPostalCodeService', () => {
  let service;

  beforeEach(() => {
    service = new JusoPostalCodeService();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with API key', () => {
      expect(service.apiKey).toBe('test-api-key');
      expect(service.baseUrl).toBe('https://business.juso.go.kr/addrlink/addrLinkApi.do');
    });
  });

  describe('_toResult', () => {
    test('should convert JUSO item to result format', () => {
      const item = {
        zipNo: '06236',
        roadAddr: '서울시 강남구 테헤란로 152',
        jibunAddr: '서울시 강남구 역삼동 123',
        siNm: '서울특별시',
        sggNm: '강남구'
      };

      const result = service._toResult(item);

      expect(result.postalCode).toBe('06236');
      expect(result.fullAddress).toBe('서울시 강남구 테헤란로 152');
      expect(result.sido).toBe('서울특별시');
      expect(result.sigungu).toBe('강남구');
    });

    test('should handle missing fields', () => {
      const item = {};
      const result = service._toResult(item);

      expect(result.postalCode).toBe('');
      expect(result.fullAddress).toBe('');
      expect(result.sido).toBe('');
      expect(result.sigungu).toBe('');
    });
  });

  describe('_extractBuildingNumbers', () => {
    test('should extract building main number', () => {
      const result = service._extractBuildingNumbers('서울시 강남구 테헤란로 152');
      expect(result.main).toBe('152');
      expect(result.sub).toBe('');
    });

    test('should extract building main and sub numbers', () => {
      const result = service._extractBuildingNumbers('서울시 강남구 테헤란로 152-10');
      expect(result.main).toBe('152');
      expect(result.sub).toBe('10');
    });

    test('should return empty for no numbers', () => {
      const result = service._extractBuildingNumbers('서울시 강남구');
      expect(result.main).toBe('');
      expect(result.sub).toBe('');
    });
  });

  describe('_extractRoadToken', () => {
    test('should extract road name with 로', () => {
      const result = service._extractRoadToken('서울시 강남구 테헤란로 152');
      expect(result).toBe('테헤란로');
    });

    test('should extract road name with 길', () => {
      const result = service._extractRoadToken('서울시 강남구 봉은사로2길 12');
      expect(result).toBe('봉은사로2길');
    });

    test('should return empty for no road', () => {
      const result = service._extractRoadToken('서울시 강남구');
      expect(result).toBe('');
    });

    test('should handle null or undefined', () => {
      expect(service._extractRoadToken(null)).toBe('');
      expect(service._extractRoadToken(undefined)).toBe('');
    });
  });

  describe('_norm', () => {
    test('should remove all whitespace', () => {
      expect(service._norm('서울 특별시 강남구')).toBe('서울특별시강남구');
    });

    test('should handle empty string', () => {
      expect(service._norm('')).toBe('');
    });

    test('should handle null or undefined', () => {
      expect(service._norm(null)).toBe('');
      expect(service._norm(undefined)).toBe('');
    });
  });

  describe('_regionMatches', () => {
    test('should match when all regions are same', () => {
      const item = {
        siNm: '서울특별시',
        sggNm: '강남구',
        emdNm: '역삼동'
      };
      const comp = {
        sido: '서울특별시',
        sigungu: '강남구',
        dong: '역삼동'
      };

      expect(service._regionMatches(item, comp)).toBe(true);
    });

    test('should not match when sido differs', () => {
      const item = {
        siNm: '서울특별시',
        sggNm: '강남구'
      };
      const comp = {
        sido: '부산광역시',
        sigungu: '강남구'
      };

      expect(service._regionMatches(item, comp)).toBe(false);
    });

    test('should match when optional fields are empty', () => {
      const item = {
        siNm: '서울특별시',
        sggNm: '강남구'
      };
      const comp = {
        sido: '서울특별시',
        sigungu: '',
        dong: ''
      };

      expect(service._regionMatches(item, comp)).toBe(true);
    });
  });

  describe('_roadMatches', () => {
    test('should match road name', () => {
      const item = {
        roadAddr: '서울시 강남구 테헤란로 152'
      };

      expect(service._roadMatches(item, '테헤란로')).toBe(true);
    });

    test('should not match different road', () => {
      const item = {
        roadAddr: '서울시 강남구 테헤란로 152'
      };

      expect(service._roadMatches(item, '봉은사로')).toBe(false);
    });
  });

  describe('_extractBuildingBase', () => {
    test('should extract building name before 아파트', () => {
      const result = service._extractBuildingBase('서울시 강남구 삼성 아파트');
      expect(result).toBe('삼성');
    });

    test('should extract building name before APT', () => {
      const result = service._extractBuildingBase('서울시 강남구 삼성 APT');
      expect(result).toBe('삼성');
    });

    test('should handle empty input', () => {
      expect(service._extractBuildingBase('')).toBe('');
      expect(service._extractBuildingBase(null)).toBe('');
    });
  });

  describe('_scoreItem', () => {
    test('should calculate score based on similarity', () => {
      const item = {
        roadAddr: '서울시 강남구 테헤란로 152',
        buldMnnm: '152',
        buldSlno: '0'
      };
      const nums = { main: '152', sub: '' };

      const score = service._scoreItem(item, '서울시 강남구 테헤란로 152', nums);
      expect(score).toBeGreaterThan(0);
    });

    test('should add bonus for matching building numbers', () => {
      const item = {
        roadAddr: '서울시 강남구 테헤란로 152',
        buldMnnm: '152',
        buldSlno: '0'
      };
      const nums = { main: '152', sub: '' };

      const score = service._scoreItem(item, '서울시 강남구 테헤란로 152', nums);
      expect(score).toBeGreaterThan(50); // Base similarity + building match bonus
    });
  });

  describe('getAutocomplete', () => {
    test('should return empty array for empty query', async () => {
      const result = await service.getAutocomplete('');
      expect(result).toEqual([]);
    });

    test('should return autocomplete suggestions', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            common: { totalCount: 2, errorCode: '0' },
            juso: [
              { roadAddr: '서울시 강남구 테헤란로 152', zipNo: '06236' },
              { roadAddr: '서울시 강남구 테헤란로 231', zipNo: '06142' }
            ]
          }
        }
      });

      const result = await service.getAutocomplete('테헤란로', 10);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('address');
      expect(result[0]).toHaveProperty('postalCode');
      expect(result[0]).toHaveProperty('category');
      expect(result[0].category).toBe('ROAD');
    });

    test('should limit results', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            common: { totalCount: 10, errorCode: '0' },
            juso: Array(10).fill(null).map((_, i) => ({
              roadAddr: `서울시 강남구 테헤란로 ${i + 1}`,
              zipNo: '06236'
            }))
          }
        }
      });

      const result = await service.getAutocomplete('테헤란로', 5);
      expect(result.length).toBe(5);
    });
  });

  describe('findByPostalCode', () => {
    test('should find addresses by postal code', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            common: { totalCount: 2, errorCode: '0' },
            juso: [
              { roadAddr: '서울시 강남구 테헤란로 152', zipNo: '06236', siNm: '서울특별시', sggNm: '강남구' },
              { roadAddr: '서울시 강남구 테헤란로 154', zipNo: '06236', siNm: '서울특별시', sggNm: '강남구' }
            ]
          }
        }
      });

      const result = await service.findByPostalCode('06236');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].postalCode).toBe('06236');
      expect(result[0]).toHaveProperty('address');
      expect(result[0]).toHaveProperty('sido');
      expect(result[0]).toHaveProperty('sigungu');
    });

    test('should filter by exact postal code match', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            common: { totalCount: 3, errorCode: '0' },
            juso: [
              { roadAddr: '서울시 강남구 테헤란로 152', zipNo: '06236', siNm: '서울특별시', sggNm: '강남구' },
              { roadAddr: '서울시 강남구 테헤란로 200', zipNo: '06237', siNm: '서울특별시', sggNm: '강남구' },
              { roadAddr: '서울시 강남구 테헤란로 154', zipNo: '06236', siNm: '서울특별시', sggNm: '강남구' }
            ]
          }
        }
      });

      const result = await service.findByPostalCode('06236');
      expect(result.length).toBe(2);
      expect(result.every(r => r.postalCode === '06236')).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    test('should get suggestions from first word', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            common: { totalCount: 5, errorCode: '0' },
            juso: Array(5).fill(null).map((_, i) => ({
              roadAddr: `서울시 강남구 테헤란로 ${i + 1}`,
              zipNo: '06236'
            }))
          }
        }
      });

      const result = await service.getSuggestions('서울시 강남구 테헤란로');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('should handle empty address', async () => {
      const result = await service.getSuggestions('');
      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when API key is missing', async () => {
      const serviceWithoutKey = new JusoPostalCodeService();
      serviceWithoutKey.apiKey = null;

      await expect(serviceWithoutKey.getAutocomplete('테스트'))
        .rejects
        .toThrow('Juso API key (JUSO_API_KEY) is not configured');
    });

    test('should throw error on API error response', async () => {
      axios.get.mockResolvedValue({
        data: {
          results: {
            errorCode: '100',
            errorMessage: 'Invalid API key'
          }
        }
      });

      await expect(service.getAutocomplete('테스트'))
        .rejects
        .toThrow('Juso API error 100');
    });

    test('should handle axios errors', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getAutocomplete('테스트'))
        .rejects
        .toThrow('Network error');
    });
  });
});
