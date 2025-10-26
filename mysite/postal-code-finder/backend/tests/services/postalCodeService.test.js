const postalCodeService = require('../../src/services/postalCodeService');

describe('PostalCodeService', () => {
  describe('Service Instance', () => {
    test('should export a service instance', () => {
      expect(postalCodeService).toBeDefined();
      expect(postalCodeService).not.toBeNull();
    });

    test('should have findPostalCode method', () => {
      expect(typeof postalCodeService.findPostalCode).toBe('function');
    });

    test('should have getAutocomplete method', () => {
      expect(typeof postalCodeService.getAutocomplete).toBe('function');
    });

    test('should have findByPostalCode method', () => {
      expect(typeof postalCodeService.findByPostalCode).toBe('function');
    });
  });

  describe('findPostalCode', () => {
    test('should return null for invalid address', async () => {
      const result = await postalCodeService.findPostalCode('');
      expect(result).toBeNull();
    });

    test('should handle null or undefined address', async () => {
      const resultNull = await postalCodeService.findPostalCode(null);
      const resultUndefined = await postalCodeService.findPostalCode(undefined);

      expect(resultNull).toBeNull();
      expect(resultUndefined).toBeNull();
    });
  });

  describe('getAutocomplete', () => {
    test('should return empty array for empty query', async () => {
      const result = await postalCodeService.getAutocomplete('');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('should accept limit parameter', async () => {
      const result = await postalCodeService.getAutocomplete('서울', 5);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findByPostalCode', () => {
    test('should return empty array for invalid postal code', async () => {
      const result = await postalCodeService.findByPostalCode('');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('should return empty array for null postal code', async () => {
      const result = await postalCodeService.findByPostalCode(null);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return array for valid postal code format', async () => {
      const result = await postalCodeService.findByPostalCode('06236');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    test('should return empty array for empty address', async () => {
      const result = await postalCodeService.getSuggestions('');
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return array for valid address', async () => {
      const result = await postalCodeService.getSuggestions('서울시');
      expect(Array.isArray(result)).toBe(true);
    });

    test('should limit results to maximum 5', async () => {
      const result = await postalCodeService.getSuggestions('서울시 강남구');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
