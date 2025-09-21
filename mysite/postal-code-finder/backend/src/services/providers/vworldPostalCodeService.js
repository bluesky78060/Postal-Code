const axios = require('axios');

class VworldPostalCodeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.vworld.kr/req';
  }

  async findPostalCode(address) {
    if (!this.apiKey) {
      console.warn('Vworld API key not provided');
      return null;
    }

    try {
      // Vworld 주소 검색 API
      const response = await axios.get(`${this.baseUrl}/address`, {
        params: {
          service: 'address',
          request: 'getAddress',
          version: '2.0',
          crs: 'epsg:4326',
          address: address,
          format: 'json',
          type: 'road',
          zipcode: 'true',
          simple: 'false',
          key: this.apiKey
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (data.response?.status === 'OK' && data.response.result?.point) {
        const result = data.response.result.point;
        const addressInfo = result.parcel || result.road || {};
        
        return {
          postalCode: addressInfo.zipcode || '',
          fullAddress: addressInfo.parcel || addressInfo.road || address,
          sido: addressInfo.sido || '',
          sigungu: addressInfo.sigungu || '',
          roadName: addressInfo.road || '',
          buildingNumber: addressInfo.bldnm || '',
          coordinates: {
            x: parseFloat(result.x),
            y: parseFloat(result.y)
          }
        };
      }

      return null;
    } catch (error) {
      console.warn('Vworld API error:', error.message);
      return null;
    }
  }

  async getAutocomplete(query, limit = 10) {
    if (!this.apiKey) return [];

    try {
      const response = await axios.get(`${this.baseUrl}/address`, {
        params: {
          service: 'address',
          request: 'getAddress',
          version: '2.0',
          crs: 'epsg:4326',
          address: query,
          format: 'json',
          type: 'road',
          zipcode: 'true',
          simple: 'true',
          key: this.apiKey,
          count: limit
        },
        timeout: 10000
      });

      const data = response.data;
      const results = [];

      if (data.response?.status === 'OK' && data.response.result?.point) {
        const points = Array.isArray(data.response.result.point) 
          ? data.response.result.point 
          : [data.response.result.point];

        points.forEach(point => {
          const addressInfo = point.parcel || point.road || {};
          if (addressInfo.parcel || addressInfo.road) {
            results.push({
              address: addressInfo.parcel || addressInfo.road,
              postalCode: addressInfo.zipcode || '',
              category: 'ROAD'
            });
          }
        });
      }

      return results.slice(0, limit);
    } catch (error) {
      console.warn('Vworld autocomplete error:', error.message);
      return [];
    }
  }

  async findByPostalCode(postalCode) {
    if (!this.apiKey) return [];

    try {
      const response = await axios.get(`${this.baseUrl}/address`, {
        params: {
          service: 'address',
          request: 'getAddress',
          version: '2.0',
          crs: 'epsg:4326',
          address: postalCode,
          format: 'json',
          type: 'parcel',
          zipcode: 'true',
          simple: 'false',
          key: this.apiKey,
          count: 10
        },
        timeout: 10000
      });

      const data = response.data;
      const results = [];

      if (data.response?.status === 'OK' && data.response.result?.point) {
        const points = Array.isArray(data.response.result.point) 
          ? data.response.result.point 
          : [data.response.result.point];

        points.forEach(point => {
          const addressInfo = point.parcel || point.road || {};
          if ((addressInfo.zipcode || '').includes(postalCode)) {
            results.push({
              address: addressInfo.parcel || addressInfo.road || '',
              postalCode: addressInfo.zipcode || '',
              sido: addressInfo.sido || '',
              sigungu: addressInfo.sigungu || ''
            });
          }
        });
      }

      return results.slice(0, 10);
    } catch (error) {
      console.warn('Vworld postal code search error:', error.message);
      return [];
    }
  }

  async getSuggestions(address) {
    const results = await this.getAutocomplete(address, 5);
    return results;
  }
}

module.exports = VworldPostalCodeService;