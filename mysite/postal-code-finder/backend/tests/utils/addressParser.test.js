const addressParser = require('../../src/utils/addressParser');

describe('AddressParser', () => {
  describe('normalizeAddress', () => {
    test('should normalize basic address', () => {
      const address = '서울특별시  강남구   테헤란로  152';
      const result = addressParser.normalizeAddress(address);
      expect(result).toBe('서울특별시 강남구 테헤란로 152');
    });

    test('should remove parentheses', () => {
      const address = '서울시 강남구(역삼동) 테헤란로 152';
      const result = addressParser.normalizeAddress(address);
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });

    test('should remove dong-ho details', () => {
      const address = '서울시 강남구 테헤란로 152 108동 201호';
      const result = addressParser.normalizeAddress(address);
      expect(result).not.toContain('108동');
      expect(result).not.toContain('201호');
    });

    test('should handle null or empty input', () => {
      expect(addressParser.normalizeAddress(null)).toBe('');
      expect(addressParser.normalizeAddress('')).toBe('');
      expect(addressParser.normalizeAddress('   ')).toBe('');
    });

    test('should normalize apartment names', () => {
      const address = '서울시 강남구 대치동 아파트 A동 101호';
      const result = addressParser.normalizeAddress(address);
      expect(result).toBe('서울시 강남구 대치동 APT');
    });

    test('should handle complex address with multiple details', () => {
      const address = '경기도 성남시 분당구 판교역로 231 (삼평동) H스퀘어 108동 201호';
      const result = addressParser.normalizeAddress(address);
      expect(result).toContain('판교역로 231');
      expect(result).not.toContain('108동');
      expect(result).not.toContain('201호');
    });
  });

  describe('isValidAddress', () => {
    test('should validate correct addresses', () => {
      expect(addressParser.isValidAddress('서울시 강남구 테헤란로 152')).toBe(true);
      expect(addressParser.isValidAddress('부산시 해운대구 센텀로')).toBe(true);
      expect(addressParser.isValidAddress('대전시 서구 둔산동 123번지')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(addressParser.isValidAddress('')).toBe(false);
      expect(addressParser.isValidAddress(null)).toBe(false);
      expect(addressParser.isValidAddress('1')).toBe(false);
      expect(addressParser.isValidAddress('123')).toBe(false); // 숫자만
      expect(addressParser.isValidAddress('a')).toBe(false); // 너무 짧음
    });

    test('should validate addresses with keywords', () => {
      expect(addressParser.isValidAddress('테헤란로')).toBe(true); // '로' 포함
      expect(addressParser.isValidAddress('대치동')).toBe(true); // '동' 포함
      expect(addressParser.isValidAddress('abc def')).toBe(false); // 키워드 없음
    });
  });

  describe('parseAddressComponents', () => {
    test('should parse Seoul address correctly', () => {
      const address = '서울특별시 강남구 역삼동 테헤란로 152';
      const result = addressParser.parseAddressComponents(address);

      expect(result.sido).toBe('서울특별시');
      expect(result.sigungu).toBe('강남구');
      expect(result.dong).toBe('역삼동');
      expect(result.road).toBe('테헤란로');
    });

    test('should parse Gyeonggi address correctly', () => {
      const address = '경기도 성남시 분당구 판교역로 231';
      const result = addressParser.parseAddressComponents(address);

      expect(result.sido).toBe('경기도');
      expect(result.sigungu).toBe('성남시'); // 시가 먼저 매칭됨
      expect(result.road).toBe('판교역로');
    });

    test('should parse Busan address correctly', () => {
      const address = '부산광역시 해운대구 우동 센텀중앙로 78';
      const result = addressParser.parseAddressComponents(address);

      expect(result.sido).toBe('부산광역시');
      expect(result.sigungu).toBe('해운대구');
      expect(result.dong).toBe('우동');
    });

    test('should handle address without dong', () => {
      const address = '서울특별시 강남구 테헤란로 152';
      const result = addressParser.parseAddressComponents(address);

      expect(result.sido).toBe('서울특별시');
      expect(result.sigungu).toBe('강남구');
      expect(result.dong).toBe('');
    });
  });

  describe('getAddressType', () => {
    test('should identify road address', () => {
      expect(addressParser.getAddressType('부산시 해운대구 센텀1로 78')).toBe('ROAD');
      expect(addressParser.getAddressType('대전시 유성구 테크노9로 65')).toBe('ROAD');
      expect(addressParser.getAddressType('서울시 강남구 봉은사로2길 12')).toBe('ROAD');
    });

    test('should identify jibun address', () => {
      expect(addressParser.getAddressType('서울시 강남구 역삼동 123번지')).toBe('JIBUN');
      expect(addressParser.getAddressType('서울시 강남구 역삼동 123번')).toBe('JIBUN');
    });

    test('should return UNKNOWN for ambiguous addresses', () => {
      expect(addressParser.getAddressType('서울시 강남구 역삼동')).toBe('UNKNOWN');
      expect(addressParser.getAddressType('강남구')).toBe('UNKNOWN');
    });
  });

  describe('isValidPostalCode', () => {
    test('should validate correct postal codes', () => {
      expect(addressParser.isValidPostalCode('06236')).toBe(true);
      expect(addressParser.isValidPostalCode('12345')).toBe(true);
      expect(addressParser.isValidPostalCode(12345)).toBe(true); // 숫자 입력
    });

    test('should reject invalid postal codes', () => {
      expect(addressParser.isValidPostalCode('')).toBe(false);
      expect(addressParser.isValidPostalCode(null)).toBe(false);
      expect(addressParser.isValidPostalCode('1234')).toBe(false); // 4자리
      expect(addressParser.isValidPostalCode('123456')).toBe(false); // 6자리
      expect(addressParser.isValidPostalCode('abcde')).toBe(false); // 문자
      expect(addressParser.isValidPostalCode('12-345')).toBe(false); // 특수문자
    });
  });

  describe('calculateSimilarity', () => {
    test('should return 1 for identical addresses', () => {
      const address = '서울시 강남구 테헤란로 152';
      expect(addressParser.calculateSimilarity(address, address)).toBe(1);
    });

    test('should return high similarity for similar addresses', () => {
      const addr1 = '서울특별시 강남구 테헤란로 152';
      const addr2 = '서울시 강남구 테헤란로 152';
      const similarity = addressParser.calculateSimilarity(addr1, addr2);
      expect(similarity).toBeGreaterThan(0.7);
    });

    test('should return low similarity for different addresses', () => {
      const addr1 = '서울시 강남구 테헤란로 152';
      const addr2 = '부산시 해운대구 센텀로 78';
      const similarity = addressParser.calculateSimilarity(addr1, addr2);
      expect(similarity).toBeLessThan(0.3);
    });

    test('should handle case insensitivity', () => {
      const addr1 = '서울시 강남구 TEST로 123';
      const addr2 = '서울시 강남구 test로 123';
      const similarity = addressParser.calculateSimilarity(addr1, addr2);
      expect(similarity).toBe(1);
    });
  });

  describe('generateSuggestions', () => {
    test('should generate suggestions sorted by similarity', () => {
      const original = '서울시 강남구 테헤란로';
      const searchResults = [
        { address: '부산시 해운대구 센텀로 78' },
        { address: '서울시 강남구 테헤란로 152' },
        { address: '서울시 강남구 테헤란로 231' },
        { address: '대전시 유성구 엑스포로 1' }
      ];

      const suggestions = addressParser.generateSuggestions(original, searchResults);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);

      // 첫 번째가 가장 유사도가 높아야 함
      expect(suggestions[0].similarity).toBeGreaterThanOrEqual(suggestions[1].similarity);

      // 각 제안에 필요한 속성이 있어야 함
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('address');
        expect(suggestion).toHaveProperty('similarity');
        expect(suggestion).toHaveProperty('type');
      });
    });

    test('should return empty array for empty search results', () => {
      const suggestions = addressParser.generateSuggestions('서울시 강남구', []);
      expect(suggestions).toEqual([]);
    });

    test('should limit to 5 suggestions', () => {
      const original = '서울시 강남구';
      const searchResults = Array(10).fill(null).map((_, i) => ({
        address: `서울시 강남구 테헤란로 ${i + 1}`
      }));

      const suggestions = addressParser.generateSuggestions(original, searchResults);
      expect(suggestions.length).toBe(5);
    });
  });

  describe('splitAddressDetail', () => {
    test('should split address and detail correctly', () => {
      const address = '서울시 강남구 테헤란로 152 삼성타워 108동 201호';
      const result = addressParser.splitAddressDetail(address);

      expect(result.main).toContain('테헤란로 152');
      expect(result.detail).toContain('동');
      expect(result.detail).toContain('호');
    });

    test('should handle address with parentheses', () => {
      const address = '서울시 강남구 테헤란로 152 (108동 201호)';
      const result = addressParser.splitAddressDetail(address);

      expect(result.main).toContain('테헤란로 152');
      expect(result.detail).toContain('108동 201호');
    });

    test('should handle address with comma', () => {
      const address = '서울시 강남구 테헤란로 152, 108동 201호';
      const result = addressParser.splitAddressDetail(address);

      expect(result.main).toContain('테헤란로 152');
      expect(result.detail).toContain('108동 201호');
    });

    test('should handle address with hyphen format', () => {
      const address = '서울시 강남구 테헤란로 152 101-1203호';
      const result = addressParser.splitAddressDetail(address);

      expect(result.main).toContain('테헤란로 152');
      expect(result.detail).toContain('101-1203');
    });

    test('should handle null or empty input', () => {
      expect(addressParser.splitAddressDetail(null)).toEqual({ main: '', detail: '' });
      expect(addressParser.splitAddressDetail('')).toEqual({ main: '', detail: '' });
    });

    test('should keep building name in main address', () => {
      const address = '서울시 강남구 테헤란로 152 삼성타워';
      const result = addressParser.splitAddressDetail(address);

      expect(result.main).toContain('삼성타워');
      expect(result.detail).toBe('');
    });

    test('should not split non-unit tokens', () => {
      const address = '서울시 강남구 테헤란로 152 그랜드빌딩';
      const result = addressParser.splitAddressDetail(address);

      expect(result.main).toContain('그랜드빌딩');
      expect(result.detail).toBe('');
    });
  });
});
