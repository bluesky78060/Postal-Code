const express = require('express');
const axios = require('axios');
const addressController = require('../controllers/addressController');
const {
  validateAddressSearch,
  validateBatchAddressSearch,
  validatePostalCodeSearch,
  validateAutocomplete,
  addRequestId
} = require('../middleware/validation');

const router = express.Router();

// Request ID 추가
router.use(addRequestId);

// 단일 주소 검색
router.post('/search', validateAddressSearch, addressController.searchAddress);

// 잘못된 메서드에 대한 안내 (디버깅 편의)
// Juso 검색(서버 프록시) - GET /api/address/search?q=...
const SQL_WORDS = [
  'OR','SELECT','INSERT','DELETE','UPDATE','CREATE','DROP','EXEC','UNION','FETCH','DECLARE','TRUNCATE'
];
const BAD_CHARS = /[<>=%]/;
function sanitizeKeyword(q = '') {
  const s = String(q).trim();
  if (!s) return { ok: false, error: '검색어를 입력해 주세요.' };
  if (BAD_CHARS.test(s)) return { ok: false, error: '<, >, =, % 문자는 사용할 수 없습니다.' };
  for (const w of SQL_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, 'i');
    if (re.test(s)) return { ok: false, error: `"${w}" 같은 예약어는 사용할 수 없습니다.` };
  }
  return { ok: true, value: s };
}

router.get('/search', async (req, res, next) => {
  try {
    const { q, page = 1, size = 10, hstryYn = 'N', firstSort = 'road', addInfoYn = 'N' } = req.query;
    const chk = sanitizeKeyword(q);
    if (!chk.ok) return res.status(400).json({ error: chk.error });

    const JUSO_URL = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
    const confmKey = process.env.JUSO_API_KEY || process.env.JUSO_KEY;
    if (!confmKey) return res.status(500).json({ error: 'JUSO_API_KEY가 설정되지 않았습니다.' });

    const { data } = await axios.get(JUSO_URL, {
      params: {
        confmKey,
        currentPage: page,
        countPerPage: size,
        keyword: chk.value,
        resultType: 'json',
        hstryYn,
        firstSort,
        addInfoYn
      },
      timeout: 8000
    });

    const common = data?.results?.common;
    if (!common) return res.status(502).json({ error: 'Juso API 응답 형식 오류' });
    if (common.errorCode && common.errorCode !== '0') {
      return res.status(400).json({ errorCode: common.errorCode, errorMessage: common.errorMessage });
    }

    return res.json({
      success: true,
      data: {
        total: Number(common.totalCount || 0),
        page: Number(common.currentPage || page),
        size: Number(common.countPerPage || size),
        items: data?.results?.juso || []
      }
    });
  } catch (err) {
    next(err);
  }
});

// 주소 자동완성
router.get('/autocomplete', validateAutocomplete, addressController.autocomplete);

// 우편번호로 주소 검색
router.get('/postal/:postalCode', validatePostalCodeSearch, addressController.searchByPostalCode);

// 배치 주소 검색 (여러 주소 한번에)
router.post('/batch', validateBatchAddressSearch, addressController.batchSearch);

module.exports = router;
