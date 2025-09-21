const postalCodeService = require('../services/postalCodeService');
const addressParser = require('../utils/addressParser');

class AddressController {
  // 단일 주소 검색
  async searchAddress(req, res, next) {
    try {
      const { address } = req.body;
      
      // 주소 정규화
      const normalizedAddress = addressParser.normalizeAddress(address);
      
      // 우편번호 검색
      const result = await postalCodeService.findPostalCode(normalizedAddress);
      
      if (!result) {
        return res.status(404).json({
          error: '주소를 찾을 수 없습니다.',
          searchedAddress: normalizedAddress,
          suggestions: await postalCodeService.getSuggestions(normalizedAddress)
        });
      }
      
      res.json({
        success: true,
        data: {
          originalAddress: address,
          normalizedAddress: normalizedAddress,
          postalCode: result.postalCode,
          fullAddress: result.fullAddress,
          sido: result.sido,
          sigungu: result.sigungu,
          roadName: result.roadName,
          buildingNumber: result.buildingNumber
        }
      });
      
    } catch (error) {
      console.error('주소 검색 오류:', error);
      next(error);
    }
  }
  
  // 주소 자동완성
  async autocomplete(req, res, next) {
    try {
      const { q: query, limit = 10 } = req.query;
      
      const suggestions = await postalCodeService.getAutocomplete(query, parseInt(limit));
      
      res.json({
        success: true,
        data: {
          query,
          suggestions
        }
      });
      
    } catch (error) {
      console.error('자동완성 오류:', error);
      next(error);
    }
  }
  
  // 우편번호로 주소 검색
  async searchByPostalCode(req, res, next) {
    try {
      const { postalCode } = req.params;
      
      const results = await postalCodeService.findByPostalCode(postalCode);
      
      if (!results || results.length === 0) {
        return res.status(404).json({
          error: '해당 우편번호의 주소를 찾을 수 없습니다.',
          postalCode
        });
      }
      
      res.json({
        success: true,
        data: {
          postalCode,
          addresses: results
        }
      });
      
    } catch (error) {
      console.error('우편번호 검색 오류:', error);
      next(error);
    }
  }
  
  // 배치 주소 검색
  async batchSearch(req, res, next) {
    try {
      const { addresses } = req.body;
      
      const results = [];
      const errors = [];
      
      for (let i = 0; i < addresses.length; i++) {
        try {
          const address = addresses[i];
          const normalizedAddress = addressParser.normalizeAddress(address);
          const result = await postalCodeService.findPostalCode(normalizedAddress);
          
          if (result) {
            results.push({
              index: i,
              originalAddress: address,
              normalizedAddress: normalizedAddress,
              postalCode: result.postalCode,
              fullAddress: result.fullAddress,
              success: true
            });
          } else {
            errors.push({
              index: i,
              originalAddress: address,
              error: '주소를 찾을 수 없습니다.',
              suggestions: await postalCodeService.getSuggestions(normalizedAddress)
            });
          }
        } catch (error) {
          errors.push({
            index: i,
            originalAddress: addresses[i],
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        data: {
          total: addresses.length,
          successful: results.length,
          failed: errors.length,
          results,
          errors
        }
      });
      
    } catch (error) {
      console.error('배치 검색 오류:', error);
      next(error);
    }
  }
}

module.exports = new AddressController();