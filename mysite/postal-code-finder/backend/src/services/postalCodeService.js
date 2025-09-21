const config = require('../config');
const LocalPostalCodeService = require('./providers/localPostalCodeService');
const JusoPostalCodeService = require('./providers/jusoPostalCodeService');
const KoreapostPostalCodeService = require('./providers/koreapostPostalCodeService');
const VworldPostalCodeService = require('./providers/vworldPostalCodeService');
const OpenPostalCodeService = require('./providers/openPostalCodeService');

let serviceInstance = null;

const provider = config.postal.provider || 'local';

if (provider === 'local') {
  serviceInstance = new LocalPostalCodeService();
} else if (provider === 'koreapost') {
  serviceInstance = new KoreapostPostalCodeService();
} else if (provider === 'juso') {
  serviceInstance = new JusoPostalCodeService();
} else if (provider === 'vworld') {
  serviceInstance = new VworldPostalCodeService(config.vworldApiKey);
} else if (provider === 'open') {
  serviceInstance = new OpenPostalCodeService();
} else if (provider === 'kakao') {
  const axios = require('axios');
  class KakaoPostalCodeService {
    constructor() {
      this.kakaoApiKey = config.kakaoApiKey;
      this.baseUrl = 'https://dapi.kakao.com/v2/local';
    }
    async findPostalCode(address) {
      if (!this.kakaoApiKey) return null;
      try {
        const response = await axios.get(`${this.baseUrl}/search/address.json`, {
          headers: { 'Authorization': `KakaoAK ${this.kakaoApiKey}` },
          params: { query: address, size: 1 }
        });
        const doc = response.data.documents?.[0];
        if (!doc) return null;
        return {
          postalCode: doc.zone_no || '',
          fullAddress: doc.address_name || doc.road_address_name || '',
          sido: doc.region_1depth_name || '',
          sigungu: doc.region_2depth_name || '',
          roadName: doc.road_name || '',
          buildingNumber: doc.main_building_no || '',
          coordinates: { x: parseFloat(doc.x), y: parseFloat(doc.y) }
        };
      } catch (e) {
        return null;
      }
    }
    async getAutocomplete(query, limit = 10) {
      if (!this.kakaoApiKey) return [];
      try {
        const response = await axios.get(`${this.baseUrl}/search/address.json`, {
          headers: { 'Authorization': `KakaoAK ${this.kakaoApiKey}` },
          params: { query, size: limit }
        });
        const documents = response.data.documents || [];
        return documents.map(doc => ({
          address: doc.address_name || doc.road_address_name,
          postalCode: doc.zone_no || '',
          category: doc.address_type || 'REGION'
        }));
      } catch (e) {
        return [];
      }
    }
    async findByPostalCode(postalCode) {
      if (!this.kakaoApiKey) return [];
      try {
        const response = await axios.get(`${this.baseUrl}/search/address.json`, {
          headers: { 'Authorization': `KakaoAK ${this.kakaoApiKey}` },
          params: { query: postalCode, size: 10 }
        });
        const documents = response.data.documents || [];
        return documents
          .filter(doc => doc.zone_no === postalCode)
          .map(doc => ({
            address: doc.address_name || doc.road_address_name,
            postalCode: doc.zone_no,
            sido: doc.region_1depth_name,
            sigungu: doc.region_2depth_name
          }));
      } catch (e) {
        return [];
      }
    }
    async getSuggestions(address) {
      const words = (address || '').split(' ').filter(w => w.length > 1).slice(0, 3);
      const acc = [];
      for (const w of words) acc.push(...await this.getAutocomplete(w, 3));
      const unique = acc.filter((it, i, arr) => i === arr.findIndex(t => t.address === it.address));
      return unique.slice(0, 5);
    }
  }
  serviceInstance = new KakaoPostalCodeService();
}

module.exports = serviceInstance;
