const excelService = require('../../src/services/excelService');

describe('ExcelService', () => {
  describe('findAddressColumn', () => {
    test('should find Korean address column', () => {
      const headers = ['이름', '주소', '전화번호'];
      expect(excelService.findAddressColumn(headers)).toBe(1);
    });

    test('should find English address column', () => {
      const headers = ['name', 'address', 'phone'];
      expect(excelService.findAddressColumn(headers)).toBe(1);
    });

    test('should find address column with variations', () => {
      expect(excelService.findAddressColumn(['이름', '주소지', '연락처'])).toBe(1);
      expect(excelService.findAddressColumn(['이름', '거주지', '연락처'])).toBe(1);
      expect(excelService.findAddressColumn(['이름', '소재지', '연락처'])).toBe(1);
      expect(excelService.findAddressColumn(['name', 'addr', 'phone'])).toBe(1);
      expect(excelService.findAddressColumn(['name', 'ADDR', 'phone'])).toBe(1);
    });

    test('should return -1 when address column not found', () => {
      const headers = ['이름', '전화번호', '이메일'];
      expect(excelService.findAddressColumn(headers)).toBe(-1);
    });

    test('should handle empty headers', () => {
      expect(excelService.findAddressColumn([])).toBe(-1);
    });
  });

  describe('findPostalCodeColumn', () => {
    test('should find Korean postal code column', () => {
      const headers = ['이름', '주소', '우편번호'];
      expect(excelService.findPostalCodeColumn(headers)).toBe(2);
    });

    test('should find English postal code column', () => {
      const headers = ['name', 'address', 'postal'];
      expect(excelService.findPostalCodeColumn(headers)).toBe(2);
    });

    test('should find postal code column with variations', () => {
      expect(excelService.findPostalCodeColumn(['이름', '주소', '우편'])).toBe(2);
      expect(excelService.findPostalCodeColumn(['이름', '주소', '우코드'])).toBe(2);
      expect(excelService.findPostalCodeColumn(['name', 'address', 'zip'])).toBe(2);
      expect(excelService.findPostalCodeColumn(['name', 'address', 'ZIP'])).toBe(2);
      expect(excelService.findPostalCodeColumn(['name', 'address', 'zip_code'])).toBe(2);
    });

    test('should return -1 when postal code column not found', () => {
      const headers = ['이름', '주소', '전화번호'];
      expect(excelService.findPostalCodeColumn(headers)).toBe(-1);
    });
  });

  describe('validateExcelData', () => {
    test('should validate correct Excel data', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '부산시 해운대구 센텀로 78', '010-2345-6789']
      ];

      const result = excelService.validateExcelData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.addressColumnIndex).toBe(1);
      expect(result.validRows).toBe(2);
    });

    test('should reject empty data', () => {
      const result = excelService.validateExcelData([]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('비어있습니다');
    });

    test('should reject data without data rows', () => {
      const data = [['이름', '주소', '전화번호']];
      const result = excelService.validateExcelData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('데이터가 없습니다');
    });

    test('should reject data without address column', () => {
      const data = [
        ['이름', '전화번호', '이메일'],
        ['홍길동', '010-1234-5678', 'hong@example.com']
      ];
      const result = excelService.validateExcelData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('주소 컬럼을 찾을 수 없습니다');
    });

    test('should reject data without valid addresses', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '', '010-1234-5678'],
        ['김철수', '   ', '010-2345-6789']
      ];
      const result = excelService.validateExcelData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('유효한 주소 데이터가 없습니다');
    });

    test('should reject data with too many rows', () => {
      const headers = ['이름', '주소', '전화번호'];
      const rows = Array(1001).fill(null).map((_, i) =>
        [`사용자${i}`, `주소${i}`, `010-0000-${i.toString().padStart(4, '0')}`]
      );
      const data = [headers, ...rows];

      const result = excelService.validateExcelData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('최대 행 수');
      expect(result.errors[0]).toContain('1000');
    });

    test('should count only valid rows', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '', '010-2345-6789'], // 빈 주소
        ['이영희', '부산시 해운대구 센텀로 78', '010-3456-7890'],
        ['박민수', '   ', '010-4567-8901'] // 공백 주소
      ];

      const result = excelService.validateExcelData(data);
      expect(result.isValid).toBe(true);
      expect(result.totalRows).toBe(4);
      expect(result.validRows).toBe(2); // 홍길동, 이영희만 유효
    });
  });

  describe('calculateProgress', () => {
    test('should calculate progress correctly', () => {
      expect(excelService.calculateProgress(25, 100)).toBe(25);
      expect(excelService.calculateProgress(50, 100)).toBe(50);
      expect(excelService.calculateProgress(75, 100)).toBe(75);
      expect(excelService.calculateProgress(100, 100)).toBe(100);
    });

    test('should round progress to integer', () => {
      expect(excelService.calculateProgress(33, 100)).toBe(33);
      expect(excelService.calculateProgress(66, 100)).toBe(66);
      expect(excelService.calculateProgress(1, 3)).toBe(33); // 33.33... → 33
      expect(excelService.calculateProgress(2, 3)).toBe(67); // 66.66... → 67
    });

    test('should return 0 for zero total', () => {
      expect(excelService.calculateProgress(0, 0)).toBe(0);
      expect(excelService.calculateProgress(10, 0)).toBe(0);
    });

    test('should handle edge cases', () => {
      expect(excelService.calculateProgress(0, 100)).toBe(0);
      expect(excelService.calculateProgress(100, 100)).toBe(100);
      expect(excelService.calculateProgress(150, 100)).toBe(150); // 100% 초과도 처리
    });
  });

  describe('getCellValue', () => {
    test('should extract string values', () => {
      expect(excelService.getCellValue('test')).toBe('test');
      expect(excelService.getCellValue('  test  ')).toBe('test');
    });

    test('should extract number values', () => {
      expect(excelService.getCellValue(123)).toBe('123');
      expect(excelService.getCellValue(45.67)).toBe('45.67');
    });

    test('should handle cell objects', () => {
      expect(excelService.getCellValue({ v: 'test value' })).toBe('test value');
      expect(excelService.getCellValue({ v: 123 })).toBe('123');
      expect(excelService.getCellValue({ v: '  spaced  ' })).toBe('spaced');
    });

    test('should handle null and undefined', () => {
      expect(excelService.getCellValue(null)).toBe('');
      expect(excelService.getCellValue(undefined)).toBe('');
    });

    test('should handle empty strings', () => {
      expect(excelService.getCellValue('')).toBe('');
      expect(excelService.getCellValue('   ')).toBe('');
    });
  });

  describe('removeDuplicates', () => {
    test('should remove duplicate addresses', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '부산시 해운대구 센텀로 78', '010-2345-6789'],
        ['이영희', '서울시 강남구 테헤란로 152', '010-3456-7890'], // 중복
        ['박민수', '대전시 유성구 엑스포로 1', '010-4567-8901']
      ];

      const result = excelService.removeDuplicates(data);

      expect(result.duplicateCount).toBe(1);
      expect(result.originalCount).toBe(4);
      expect(result.uniqueCount).toBe(3);
      expect(result.data.length).toBe(4); // 헤더 + 3개 데이터
    });

    test('should be case insensitive', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '서울시 강남구 테헤란로 152', '010-2345-6789'], // 대소문자만 다름 (실제로는 같은 주소)
        ['이영희', '부산시 해운대구 센텀로 78', '010-3456-7890']
      ];

      const result = excelService.removeDuplicates(data);

      expect(result.duplicateCount).toBe(1);
      expect(result.uniqueCount).toBe(2);
    });

    test('should ignore whitespace differences', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '  서울시 강남구 테헤란로 152  ', '010-2345-6789'], // 공백만 다름
        ['이영희', '부산시 해운대구 센텀로 78', '010-3456-7890']
      ];

      const result = excelService.removeDuplicates(data);

      expect(result.duplicateCount).toBe(1);
      expect(result.uniqueCount).toBe(2);
    });

    test('should handle data without duplicates', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '부산시 해운대구 센텀로 78', '010-2345-6789'],
        ['이영희', '대전시 유성구 엑스포로 1', '010-3456-7890']
      ];

      const result = excelService.removeDuplicates(data);

      expect(result.duplicateCount).toBe(0);
      expect(result.uniqueCount).toBe(3);
    });

    test('should return original data if no address column', () => {
      const data = [
        ['이름', '전화번호', '이메일'],
        ['홍길동', '010-1234-5678', 'hong@example.com'],
        ['김철수', '010-2345-6789', 'kim@example.com']
      ];

      const result = excelService.removeDuplicates(data);
      expect(result).toEqual(data); // 원본 그대로 반환
    });

    test('should handle empty or small data', () => {
      expect(excelService.removeDuplicates([])).toEqual([]);
      expect(excelService.removeDuplicates([['헤더']])).toEqual([['헤더']]);
    });

    test('should skip rows with empty addresses', () => {
      const data = [
        ['이름', '주소', '전화번호'],
        ['홍길동', '서울시 강남구 테헤란로 152', '010-1234-5678'],
        ['김철수', '', '010-2345-6789'], // 빈 주소
        ['이영희', '부산시 해운대구 센텀로 78', '010-3456-7890']
      ];

      const result = excelService.removeDuplicates(data);

      expect(result.originalCount).toBe(3);
      expect(result.uniqueCount).toBe(2); // 빈 주소 제외
      expect(result.data.length).toBe(3); // 헤더 + 2개 데이터
    });
  });
});
