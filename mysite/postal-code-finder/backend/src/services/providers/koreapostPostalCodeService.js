const axios = require('axios');

class KoreapostPostalCodeService {
  constructor() {
    // 한국 우체국 우편번호 검색 API
    this.baseUrl = 'https://biz.epost.go.kr/KpostPortal';
  }

  async findPostalCode(address) {
    try {
      // 한국 우체국 우편번호 API 호출
      const response = await axios.get(`${this.baseUrl}/api/search.jsp`, {
        params: {
          regkey: 'default',
          target: 'postcode',
          query: address,
          countPerPage: 10
        },
        timeout: 5000
      });

      const data = response.data;
      
      // XML 응답을 파싱 (간단한 텍스트 파싱)
      if (typeof data === 'string' && data.includes('<zipcode>')) {
        const zipcodeMatch = data.match(/<zipcode>(\d{5})<\/zipcode>/);
        const addressMatch = data.match(/<address>([^<]+)<\/address>/);
        
        if (zipcodeMatch && addressMatch) {
          return {
            postalCode: zipcodeMatch[1],
            fullAddress: addressMatch[1].trim(),
            sido: this._extractSido(addressMatch[1]),
            sigungu: this._extractSigungu(addressMatch[1]),
            roadName: '',
            buildingNumber: '',
            coordinates: null
          };
        }
      }

      return null;
    } catch (error) {
      console.warn('Korea Post API error:', error.message);
      return null;
    }
  }

  _extractSido(address) {
    const sidoPattern = /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)/;
    const match = address.match(sidoPattern);
    return match ? match[1] : '';
  }

  _extractSigungu(address) {
    // 시도 다음에 오는 시군구 추출
    const parts = address.split(' ');
    if (parts.length >= 2) {
      return parts[1];
    }
    return '';
  }

  async getAutocomplete(query, limit = 10) {
    try {
      const result = await this.findPostalCode(query);
      if (result) {
        return [{
          address: result.fullAddress,
          postalCode: result.postalCode,
          category: 'ADDRESS'
        }];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async findByPostalCode(postalCode) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/search.jsp`, {
        params: {
          regkey: 'default',
          target: 'address',
          query: postalCode,
          countPerPage: 10
        },
        timeout: 5000
      });

      const data = response.data;
      const results = [];

      if (typeof data === 'string') {
        // 여러 주소 결과 파싱
        const addressMatches = data.match(/<address>([^<]+)<\/address>/g);
        if (addressMatches) {
          addressMatches.forEach(match => {
            const address = match.replace(/<\/?address>/g, '').trim();
            results.push({
              address,
              postalCode,
              sido: this._extractSido(address),
              sigungu: this._extractSigungu(address)
            });
          });
        }
      }

      return results.slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  async getSuggestions(address) {
    const results = await this.getAutocomplete(address, 5);
    return results;
  }
}

module.exports = KoreapostPostalCodeService;