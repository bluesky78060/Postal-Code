const axios = require('axios');
const config = require('../../config');
const addressParser = require('../../utils/addressParser');
const logger = require('../../utils/logger');

// JUSO API 참고: https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do
// Endpoint: https://www.juso.go.kr/addrlink/addrLinkApi.do
// Params: confmKey, currentPage, countPerPage, keyword, resultType=json

class JusoPostalCodeService {
  constructor() {
    this.apiKey = config.jusoApiKey;
    // 서버사이드 권장 엔드포인트
    this.baseUrl = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
  }

  async _search(keyword, page = 1, size = 10) {
    if (!this.apiKey) {
      throw new Error('Juso API key (JUSO_API_KEY) is not configured');
    }
    const params = {
      confmKey: this.apiKey,
      currentPage: page,
      countPerPage: size,
      keyword,
      resultType: 'json',
      hstryYn: 'N',
      firstSort: 'road'
    };
    logger.info('Juso _search request', { keyword, page, size });
    const resp = await axios.get(this.baseUrl, { params, timeout: 7000 });
    const results = resp.data?.results;
    if (!results) return { total: 0, items: [] };
    if (results?.errorCode && results.errorCode !== '0') {
      const msg = results.errorMessage || 'Juso API error';
      logger.warn('Juso API error', { errorCode: results.errorCode, errorMessage: msg });
      throw new Error(`Juso API error ${results.errorCode}: ${msg}`);
    }
    const list = Array.isArray(results.juso) ? results.juso : [];
    const out = {
      total: Number(results.common?.totalCount || list.length || 0),
      items: list
    };
    logger.info('Juso _search result', { keyword, total: out.total });
    return out;
  }

  _toResult(item) {
    return {
      postalCode: item.zipNo || '',
      fullAddress: item.roadAddr || item.jibunAddr || '',
      sido: item.siNm || '',
      sigungu: item.sggNm || '',
      roadName: '',
      buildingNumber: '',
      coordinates: null
    };
  }

  _extractBuildingNumbers(address) {
    const norm = addressParser.normalizeAddress(address);
    const m = norm.match(/\s(\d+)(?:-(\d+))?(?=\s|$)/) || norm.match(/(\d+)(?:-(\d+))$/);
    return { main: m ? String(m[1]) : '', sub: m && m[2] ? String(m[2]) : '' };
  }

  _extractRoadToken(text) {
    if (!text) return '';
    const m = String(text).match(/([^\s]+(?:로|길|가))/);
    return m ? m[1] : '';
  }

  _norm(s) { return String(s || '').replace(/\s+/g, '').trim(); }

  _regionMatches(item, comp) {
    const si = this._norm(item.siNm);
    const sgg = this._norm(item.sggNm);
    const emd = this._norm(item.emdNm || item.emdNmNm || '');
    const inSi = this._norm(comp.sido);
    const inSgg = this._norm(comp.sigungu);
    const inEmd = this._norm(comp.dong);
    // 시/도와 시/군/구는 반드시 일치, 읍/면/동은 있으면 일치 요구
    if (inSi && si && si !== inSi) return false;
    if (inSgg && sgg && sgg !== inSgg) return false;
    if (inEmd && emd && emd !== inEmd) return false;
    return true;
  }

  _roadMatches(item, compRoad) {
    const itemRoad = this._extractRoadToken(item.roadAddr || item.jibunAddr || '');
    const inRoad = this._norm(compRoad);
    return inRoad && this._norm(itemRoad) === inRoad;
  }

  // 입력 주소에서 건물명 기반 키워드 추출 (예: "삼영a동" -> "삼영")
  _extractBuildingBase(address) {
    if (!address) return '';
    const text = String(address).trim();
    // 우선 괄호 내용 제거 후 토큰화
    const cleaned = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = cleaned.split(' ').filter(Boolean);
    // 아파트/빌라 명칭 포함 토큰 우선
    const aptIdx = tokens.findIndex(t => /(아파트|빌라|APT)/i.test(t));
    if (aptIdx > 0) {
      // 바로 앞 토큰이 단지명일 확률이 높음
      const base = tokens[aptIdx - 1].replace(/[A-Za-z]+$/g, '').replace(/동$/, '');
      if (base && base.length >= 2) return base;
    }
    // "OOO동" 꼴에서 문자+동 → 단지명
    for (const t of tokens) {
      if (/^[A-Za-z가-힣]+[A-Za-z]?동$/i.test(t)) {
        const base = t.replace(/[A-Za-z]+$/g, '').replace(/동$/i, '');
        if (base && base.length >= 2) return base;
      }
    }
    // 숫자/도로/행정구역 제거 후 남는 2글자 이상 토큰 중 하나 반환
    const exclude = /(시|군|구|동|읍|면|리|로|길|가|번|호)$/;
    const candidate = tokens.find(t => !/\d/.test(t) && !exclude.test(t) && t.length >= 2);
    return candidate || '';
  }

  _scoreItem(item, input, nums) {
    const road = item.roadAddr || '';
    let score = 0;
    // 우편번호/주소 유사도 점수
    score += Math.round(addressParser.calculateSimilarity(input, road) * 100);
    // 건물번호 일치 가산점
    if (nums.main && String(item.buldMnnm) === nums.main) score += 50;
    if (nums.sub && String(item.buldSlno) === nums.sub) score += 20;
    // 정확 포함 가산점
    if (nums.main && road.includes(`${nums.main}-${nums.sub}`)) score += 30;
    if (nums.main && road.includes(` ${nums.main}`)) score += 15;
    return score;
  }

  async findPostalCode(address) {
    const keyword = addressParser.normalizeAddress(address);
    const comp = addressParser.parseAddressComponents(keyword);
    // 더 많은 후보를 받아 필터링
    const { items } = await this._search(keyword, 1, 50);
    if (items.length === 0) {
      // 1차 실패: 건물명 기반 지역 검색으로 폴백 시도
      const base = this._extractBuildingBase(keyword);
      const region = comp.sigungu || comp.sido || '';
      if (base && region) {
        const tryKeywords = [
          `${region} ${base} 아파트`,
          `${region} ${base}`
        ];
        for (const k of tryKeywords) {
          try {
            const f = await this._search(k, 1, 50);
            const list = (f.items || []).filter(it => this._regionMatches(it, comp) && (
              (it.bdNm && this._norm(it.bdNm).includes(this._norm(base))) ||
              this._norm(it.roadAddr || it.jibunAddr || '').includes(this._norm(base))
            ));
            if (list.length) {
              return this._toResult(list[0]);
            }
          } catch (_) { /* ignore and continue */ }
        }
      }
      return null;
    }
    const nums = this._extractBuildingNumbers(keyword);
    // 후보군 필터링: 지역 + 도로명 일치 → 도로명 일치 → 지역 일치 순
    const strict = items.filter(it => this._regionMatches(it, comp) && this._roadMatches(it, comp.road));
    const roadOnly = strict.length ? strict : items.filter(it => this._roadMatches(it, comp.road));
    const regionOnly = (strict.length || roadOnly.length) ? [] : items.filter(it => this._regionMatches(it, comp));

    const pool = roadOnly.length ? roadOnly : (regionOnly.length ? regionOnly : []);
    if (pool.length === 0) {
      // 2차 폴백: 지역+건물명 재검색
      const base = this._extractBuildingBase(keyword);
      const region = comp.sigungu || comp.sido || '';
      if (base && region) {
        const tryKeywords = [
          `${region} ${base} 아파트`,
          `${region} ${base}`
        ];
        for (const k of tryKeywords) {
          try {
            const f = await this._search(k, 1, 50);
            const list = (f.items || []).filter(it => this._regionMatches(it, comp) && (
              (it.bdNm && this._norm(it.bdNm).includes(this._norm(base))) ||
              this._norm(it.roadAddr || it.jibunAddr || '').includes(this._norm(base))
            ));
            if (list.length) {
              return this._toResult(list[0]);
            }
          } catch (_) { /* ignore and continue */ }
        }
      }
      logger.info('Juso candidate none after filters', { input: keyword });
      return null; // 후보 없으면 실패 처리
    }

    let best = null, bestScore = -1;
    for (const it of pool) {
      const s = this._scoreItem(it, keyword, nums);
      if (s > bestScore) { best = it; bestScore = s; }
      if (nums.main && String(it.buldMnnm) === nums.main && (!nums.sub || String(it.buldSlno) === nums.sub)) {
        best = it; break;
      }
    }
    logger.info('Juso candidate chosen', {
      input: keyword,
      main: nums.main,
      sub: nums.sub,
      chosen: best ? { roadAddr: best.roadAddr, zipNo: best.zipNo, buldMnnm: best.buldMnnm, buldSlno: best.buldSlno, siNm: best.siNm, sggNm: best.sggNm, emdNm: best.emdNm } : null
    });
    return this._toResult(best || items[0]);
  }

  async getAutocomplete(query, limit = 10) {
    const keyword = query.trim();
    if (!keyword) return [];
    const { items } = await this._search(keyword, 1, Math.min(limit, 50));
    return items.slice(0, limit).map(it => ({
      address: it.roadAddr || it.jibunAddr,
      postalCode: it.zipNo || '',
      category: 'ROAD'
    }));
  }

  async findByPostalCode(postalCode) {
    const { items } = await this._search(String(postalCode), 1, 50);
    return items.filter(it => it.zipNo === String(postalCode)).map(it => ({
      address: it.roadAddr || it.jibunAddr,
      postalCode: it.zipNo || '',
      sido: it.siNm || '',
      sigungu: it.sggNm || ''
    }));
  }

  async getSuggestions(address) {
    const firstWord = (address || '').split(/\s+/).find(w => w.length > 1) || address;
    return this.getAutocomplete(firstWord, 5);
  }
}

module.exports = JusoPostalCodeService;
