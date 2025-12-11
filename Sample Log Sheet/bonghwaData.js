// 경북 북부권 행정구역 데이터 (봉화군, 영주시, 울진군)
const REGION_DATA = {
    // 봉화군
    bonghwa: {
        villages: {
            // 봉화읍 (10개 리)
            '삼계리': '봉화읍',
            '유곡리': '봉화읍',
            '거촌리': '봉화읍',
            '석평리': '봉화읍',
            '해저리': '봉화읍',
            '적덕리': '봉화읍',
            '화천리': '봉화읍',
            '도촌리': '봉화읍',
            '문단리': '봉화읍',
            '내성리': '봉화읍',

            // 물야면 (8개 리)
            '오록리': '물야면',
            '가평리': '물야면',
            '개단리': '물야면',
            '오전리': '물야면',
            '압동리': '물야면',
            '두문리': '물야면',
            '수식리': '물야면',
            '북지리': '물야면',

            // 봉성면 (7개 리)
            '봉성리': '봉성면',
            '외삼리': '봉성면',
            '창평리': '봉성면',
            '동양리': '봉성면',
            '금봉리': '봉성면',
            '우곡리': '봉성면',
            '봉양리': '봉성면',

            // 법전면 (7개 리)
            '법전리': '법전면',
            '풍정리': '법전면',
            '척곡리': '법전면',
            '소천리': '법전면',
            '눌산리': '법전면',
            '어지리': '법전면',
            '소지리': '법전면',

            // 춘양면 (9개 리)
            '의양리': '춘양면',
            '학산리': '춘양면',
            '서동리': '춘양면',
            '석현리': '춘양면',
            '애당리': '춘양면',
            '도심리': '춘양면',
            '서벽리': '춘양면',
            '우구치리': '춘양면',
            '소로리': '춘양면',

            // 소천면 (7개 리)
            '현동리': '소천면',
            '고선리': '소천면',
            '임기리': '소천면',
            '두음리': '소천면',
            '서천리': '소천면',
            '남회룡리': '소천면',
            '분천리': '소천면',

            // 재산면 (5개 리)
            '남면리': '재산면',
            '동면리': '재산면',
            '갈산리': '재산면',
            '상리': '재산면',

            // 명호면 (8개 리)
            '도천리': '명호면',
            '삼동리': '명호면',
            '양곡리': '명호면',
            '고감리': '명호면',
            '풍호리': '명호면',
            '고계리': '명호면',
            '북곡리': '명호면',
            '관창리': '명호면',

            // 상운면 (8개 리)
            '가곡리': '상운면',
            '운계리': '상운면',
            '문촌리': '상운면',
            '하눌리': '상운면',
            '토일리': '상운면',
            '구천리': '상운면',
            '설매리': '상운면',
            '신라리': '상운면',

            // 석포면 (3개 리)
            '석포리': '석포면',
            '대현리': '석포면',
            '승부리': '석포면'
        },
        duplicates: {
            '현동리': ['소천면', '재산면']
        }
    },

    // 영주시
    yeongju: {
        villages: {
            // 영주동 (법정동)
            '휴천동': '영주동',
            '상망동': '영주동',
            '하망동': '영주동',
            '영주동': '영주동',

            // 가흥동 (법정동)
            '가흥동': '가흥동',

            // 상당동 (법정동)
            '상당동': '상당동',

            // 조암동 (법정동)
            '조암동': '조암동',

            // 문수면 (12개 리)
            '승문리': '문수면',
            '무섬리': '문수면',
            '수도리': '문수면',
            '용혈리': '문수면',
            '원촌리': '문수면',
            '문수리': '문수면',
            '오점리': '문수면',
            '권촌리': '문수면',
            '관리': '문수면',
            '석교리': '문수면',
            '왕정리': '문수면',
            '조제리': '문수면',

            // 장수면 (11개 리)
            '금강리': '장수면',
            '노문리': '장수면',
            '대현리': '장수면',
            '두월리': '장수면',
            '백석리': '장수면',
            '삼가리': '장수면',
            '상송리': '장수면',
            '오산리': '장수면',
            '의곡리': '장수면',
            '파지리': '장수면',
            '화기리': '장수면',

            // 이산면 (9개 리)
            '광산리': '이산면',
            '내림리': '이산면',
            '두월리': '이산면',
            '마당리': '이산면',
            '무릉리': '이산면',
            '송현리': '이산면',
            '신안리': '이산면',
            '원리': '이산면',
            '평은리': '이산면',

            // 평은면 (11개 리)
            '금광리': '평은면',
            '금정리': '평은면',
            '노성리': '평은면',
            '문래리': '평은면',
            '반구리': '평은면',
            '소백리': '평은면',
            '용혈리': '평은면',
            '오현리': '평은면',
            '지동리': '평은면',
            '천본리': '평은면',
            '평은리': '평은면',

            // 풍기읍 (12개 리)
            '금계리': '풍기읍',
            '남원리': '풍기읍',
            '동부리': '풍기읍',
            '백석리': '풍기읍',
            '서부리': '풍기읍',
            '성내리': '풍기읍',
            '수철리': '풍기읍',
            '전구리': '풍기읍',
            '창락리': '풍기읍',
            '청구리': '풍기읍',
            '한음리': '풍기읍',
            '교리': '풍기읍',

            // 봉현면 (14개 리)
            '가곡리': '봉현면',
            '건지리': '봉현면',
            '계산리': '봉현면',
            '남대리': '봉현면',
            '두월리': '봉현면',
            '봉현리': '봉현면',
            '소촌리': '봉현면',
            '오대리': '봉현면',
            '오현리': '봉현면',
            '옹점리': '봉현면',
            '용산리': '봉현면',
            '우량리': '봉현면',
            '운곡리': '봉현면',
            '의동리': '봉현면',

            // 안정면 (14개 리)
            '노곡리': '안정면',
            '도계리': '안정면',
            '마산리': '안정면',
            '반송리': '안정면',
            '방호리': '안정면',
            '소산리': '안정면',
            '신암리': '안정면',
            '안정리': '안정면',
            '용산리': '안정면',
            '외곡리': '안정면',
            '인곡리': '안정면',
            '정현리': '안정면',
            '중곡리': '안정면',
            '태장리': '안정면',

            // 부석면 (15개 리)
            '남대리': '부석면',
            '법흥리': '부석면',
            '북지리': '부석면',
            '부석리': '부석면',
            '소천리': '부석면',
            '소현리': '부석면',
            '승부리': '부석면',
            '신라리': '부석면',
            '오전리': '부석면',
            '용암리': '부석면',
            '임곡리': '부석면',
            '임당리': '부석면',
            '입석리': '부석면',
            '천동리': '부석면',
            '토일리': '부석면',

            // 순흥면 (16개 리)
            '고저리': '순흥면',
            '나봉리': '순흥면',
            '단촌리': '순흥면',
            '대전리': '순흥면',
            '도촌리': '순흥면',
            '배점리': '순흥면',
            '백석리': '순흥면',
            '사미리': '순흥면',
            '선동리': '순흥면',
            '송현리': '순흥면',
            '수서리': '순흥면',
            '신사리': '순흥면',
            '어유리': '순흥면',
            '읍내리': '순흥면',
            '저동리': '순흥면',
            '태장리': '순흥면'
        },
        duplicates: {
            '용혈리': ['문수면', '평은면'],
            '두월리': ['장수면', '이산면', '봉현면'],
            '백석리': ['장수면', '풍기읍', '순흥면'],
            '용산리': ['봉현면', '안정면'],
            '남대리': ['봉현면', '부석면'],
            '태장리': ['안정면', '순흥면']
        }
    },

    // 울진군
    uljin: {
        villages: {
            // 울진읍 (20개 리)
            '고성리': '울진읍',
            '대흥리': '울진읍',
            '덕신리': '울진읍',
            '동해리': '울진읍',
            '망양리': '울진읍',
            '매화리': '울진읍',
            '봉산리': '울진읍',
            '삼산리': '울진읍',
            '성내리': '울진읍',
            '신림리': '울진읍',
            '연지리': '울진읍',
            '온양리': '울진읍',
            '읍남리': '울진읍',
            '읍내리': '울진읍',
            '정명리': '울진읍',
            '죽변리': '울진읍',
            '진복리': '울진읍',
            '척산리': '울진읍',
            '평전리': '울진읍',
            '호월리': '울진읍',

            // 죽변면 (8개 리)
            '관동리': '죽변면',
            '기성리': '죽변면',
            '봉평리': '죽변면',
            '사동리': '죽변면',
            '정명리': '죽변면',
            '죽변리': '죽변면',
            '지경리': '죽변면',
            '화성리': '죽변면',

            // 근남면 (7개 리)
            '구산리': '근남면',
            '노음리': '근남면',
            '산포리': '근남면',
            '수산리': '근남면',
            '월계리': '근남면',
            '진복리': '근남면',
            '행곡리': '근남면',

            // 기성면 (11개 리)
            '기성리': '기성면',
            '기산리': '기성면',
            '망양리': '기성면',
            '사동리': '기성면',
            '송천리': '기성면',
            '정명리': '기성면',
            '척산리': '기성면',
            '천곡리': '기성면',
            '평해리': '기성면',
            '후포리': '기성면',
            '황보리': '기성면',

            // 평해읍 (16개 리)
            '거일리': '평해읍',
            '고목리': '평해읍',
            '남송리': '평해읍',
            '눌곡리': '평해읍',
            '백암리': '평해읍',
            '봉산리': '평해읍',
            '삼달리': '평해읍',
            '삼척리': '평해읍',
            '오곡리': '평해읍',
            '용수리': '평해읍',
            '월송리': '평해읍',
            '직산리': '평해읍',
            '평해리': '평해읍',
            '학곡리': '평해읍',
            '화선리': '평해읍',
            '황보리': '평해읍',

            // 온정면 (8개 리)
            '광회리': '온정면',
            '백암리': '온정면',
            '선미리': '온정면',
            '소광리': '온정면',
            '소태리': '온정면',
            '온정리': '온정면',
            '외선미리': '온정면',
            '유곡리': '온정면',

            // 북면 (15개 리)
            '고목리': '북면',
            '두천리': '북면',
            '부구리': '북면',
            '부남리': '북면',
            '부림리': '북면',
            '상당리': '북면',
            '상천리': '북면',
            '소광리': '북면',
            '외선미리': '북면',
            '울진리': '북면',
            '주인리': '북면',
            '중산리': '북면',
            '천축리': '북면',
            '하당리': '북면',
            '현종리': '북면',

            // 서면 (10개 리)
            '광천리': '서면',
            '금평리': '서면',
            '백월리': '서면',
            '삼근리': '서면',
            '소광리': '서면',
            '오산리': '서면',
            '왕피리': '서면',
            '용산리': '서면',
            '유산리': '서면',
            '하원리': '서면',

            // 금강송면 (7개 리)
            '광회리': '금강송면',
            '삼근리': '금강송면',
            '소광리': '금강송면',
            '쌍전리': '금강송면',
            '왕피리': '금강송면',
            '하원리': '금강송면',
            '소태리': '금강송면'
        },
        duplicates: {
            '정명리': ['울진읍', '죽변면', '기성면'],
            '죽변리': ['울진읍', '죽변면'],
            '진복리': ['울진읍', '근남면'],
            '기성리': ['죽변면', '기성면'],
            '사동리': ['죽변면', '기성면'],
            '망양리': ['울진읍', '기성면'],
            '척산리': ['울진읍', '기성면'],
            '봉산리': ['울진읍', '평해읍'],
            '황보리': ['기성면', '평해읍'],
            '백암리': ['평해읍', '온정면'],
            '고목리': ['평해읍', '북면'],
            '소광리': ['온정면', '북면', '서면', '금강송면'],
            '외선미리': ['온정면', '북면'],
            '광회리': ['온정면', '금강송면'],
            '삼근리': ['서면', '금강송면'],
            '왕피리': ['서면', '금강송면'],
            '하원리': ['서면', '금강송면']
        }
    }
};

// 하위 호환성을 위한 BONGHWA_DATA 유지
const BONGHWA_DATA = {
    villages: REGION_DATA.bonghwa.villages,
    duplicates: REGION_DATA.bonghwa.duplicates,
    districts: {
        '봉화읍': ['삼계리', '유곡리', '거촌리', '석평리', '해저리', '적덕리', '화천리', '도촌리', '문단리', '내성리'],
        '물야면': ['오록리', '가평리', '개단리', '오전리', '압동리', '두문리', '수식리', '북지리'],
        '봉성면': ['봉성리', '외삼리', '창평리', '동양리', '금봉리', '우곡리', '봉양리'],
        '법전면': ['법전리', '풍정리', '척곡리', '소천리', '눌산리', '어지리', '소지리'],
        '춘양면': ['의양리', '학산리', '서동리', '석현리', '애당리', '도심리', '서벽리', '우구치리', '소로리'],
        '소천면': ['현동리', '고선리', '임기리', '두음리', '서천리', '남회룡리', '분천리'],
        '재산면': ['현동리', '남면리', '동면리', '갈산리', '상리'],
        '명호면': ['도천리', '삼동리', '양곡리', '고감리', '풍호리', '고계리', '북곡리', '관창리'],
        '상운면': ['가곡리', '운계리', '문촌리', '하눌리', '토일리', '구천리', '설매리', '신라리'],
        '석포면': ['석포리', '대현리', '승부리']
    }
};

/**
 * 지역별 주소 파싱 (봉화군, 영주시, 울진군)
 * @param {string} input - 입력 문자열
 * @param {string} region - 'bonghwa', 'yeongju', 'uljin'
 * @returns {object|null}
 */
function parseRegionAddress(input, region = 'bonghwa') {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim();
    const match = trimmed.match(/^([가-힣]+[리동])\s*(\d+[\d\-]*)?$/);

    if (!match) return null;

    const villageName = match[1];
    const lotNumber = match[2] || '';

    const regionData = REGION_DATA[region];
    if (!regionData) return null;

    const district = regionData.villages[villageName];
    if (!district) return null;

    // 지역명 설정
    const regionNames = {
        'bonghwa': '봉화군',
        'yeongju': '영주시',
        'uljin': '울진군'
    };

    const baseAddress = `${regionNames[region]} ${district} ${villageName}`;
    const fullAddress = lotNumber ? `${baseAddress} ${lotNumber}` : baseAddress;

    return {
        fullAddress,
        village: villageName,
        district,
        lotNumber,
        region: regionNames[region],
        alternatives: regionData.duplicates[villageName] || null
    };
}

/**
 * 리 이름으로 전체 주소 생성 (봉화군 전용 - 하위 호환성)
 */
function parseBonghwaAddress(input) {
    return parseRegionAddress(input, 'bonghwa');
}

/**
 * 리 이름 자동완성 제안 목록 반환 (다중 지역 지원)
 * @param {string} input - 부분 입력 문자열
 * @param {string[]} regions - 검색할 지역 배열 (기본: ['bonghwa', 'yeongju', 'uljin'])
 * @returns {Array}
 */
function suggestRegionVillages(input, regions = ['bonghwa', 'yeongju', 'uljin']) {
    if (!input || typeof input !== 'string') return [];

    const trimmed = input.trim().toLowerCase();
    if (trimmed.length === 0) return [];

    const results = [];
    const villageInput = trimmed.replace(/\s*\d+[\d\-]*$/, '');

    const regionNames = {
        'bonghwa': '봉화군',
        'yeongju': '영주시',
        'uljin': '울진군'
    };

    regions.forEach(region => {
        const regionData = REGION_DATA[region];
        if (!regionData) return;

        for (const [village, district] of Object.entries(regionData.villages)) {
            if (village.includes(villageInput)) {
                results.push({
                    village,
                    district,
                    region: regionNames[region],
                    displayText: `${village} (${regionNames[region]} ${district})`
                });
            }
        }
    });

    // 가나다순 정렬
    results.sort((a, b) => {
        const regionCompare = a.region.localeCompare(b.region, 'ko');
        if (regionCompare !== 0) return regionCompare;
        return a.village.localeCompare(b.village, 'ko');
    });

    return results.slice(0, 20);
}

/**
 * 봉화군 리 이름 자동완성 (하위 호환성)
 */
function suggestBonghwaVillages(input) {
    return suggestRegionVillages(input, ['bonghwa']);
}

/**
 * 세 지역 간 중복되는 리 이름인지 확인
 * @param {string} villageName - 리 이름 (예: "유곡리")
 * @returns {Array|null} - 중복이면 [{region, district}, ...], 중복 아니면 null
 */
function checkCrossRegionDuplicate(villageName) {
    if (!villageName || typeof villageName !== 'string') return null;

    const locations = [];
    const regionNames = {
        'bonghwa': '봉화군',
        'yeongju': '영주시',
        'uljin': '울진군'
    };

    // 각 지역에서 해당 리 이름 찾기
    for (const [regionKey, regionData] of Object.entries(REGION_DATA)) {
        const district = regionData.villages[villageName];
        if (district) {
            locations.push({
                regionKey,
                region: regionNames[regionKey],
                district,
                fullAddress: `${regionNames[regionKey]} ${district} ${villageName}`
            });
        }
    }

    // 2개 이상의 지역에 존재하면 중복
    return locations.length > 1 ? locations : null;
}

/**
 * 필지 주소 파싱 (자동 지역 감지)
 * 중복이 있으면 null을 반환하고, checkCrossRegionDuplicate로 확인해야 함
 */
function parseParcelAddress(input) {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim();
    const match = trimmed.match(/^([가-힣]+[리동])\s*(\d+[\d\-]*)?$/);

    if (!match) return null;

    const villageName = match[1];
    const lotNumber = match[2] || '';

    // 중복 체크
    const duplicates = checkCrossRegionDuplicate(villageName);
    if (duplicates) {
        // 중복이면 사용자가 선택해야 함
        return {
            isDuplicate: true,
            villageName,
            lotNumber,
            locations: duplicates
        };
    }

    // 중복이 아니면 자동으로 지역 찾기
    for (const [regionKey, regionData] of Object.entries(REGION_DATA)) {
        const district = regionData.villages[villageName];
        if (district) {
            const regionNames = {
                'bonghwa': '봉화군',
                'yeongju': '영주시',
                'uljin': '울진군'
            };

            const baseAddress = `${regionNames[regionKey]} ${district} ${villageName}`;
            const fullAddress = lotNumber ? `${baseAddress} ${lotNumber}` : baseAddress;

            return {
                isDuplicate: false,
                fullAddress,
                village: villageName,
                district,
                lotNumber,
                region: regionNames[regionKey],
                regionKey,
                alternatives: regionData.duplicates[villageName] || null
            };
        }
    }

    return null;
}
