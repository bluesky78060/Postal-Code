class AddressParser {
  // 주소 정규화
  normalizeAddress(address) {
    if (!address || typeof address !== 'string') {
      return '';
    }

    let normalized = address.trim();

    // 불필요한 문자 제거
    normalized = normalized.replace(/[\(\)\[\]{}]/g, ''); // 괄호 제거
    normalized = normalized.replace(/\s+/g, ' '); // 연속 공백을 하나로
    normalized = normalized.replace(/[.,;:]/g, ' '); // 구두점을 공백으로

    // 아파트 동호수 정보 제거 (우편번호 검색에 방해되므로)
    // 패턴: 숫자동 숫자호, A동 숫자호, 숫자동, 숫자호 등
    normalized = normalized.replace(/\s*\d+동\s*\d+호/g, ''); // 108동 201호
    normalized = normalized.replace(/\s*[A-Z가-힣]+동\s*\d+호/g, ''); // 삼영A동 609호, 가동 607호
    normalized = normalized.replace(/\s*\d+호[\(\)]*[^가-힣]*$/g, ''); // 끝에 오는 호수
    normalized = normalized.replace(/\s*\d+동[\s]*$/g, ''); // 끝에 오는 동수
    normalized = normalized.replace(/\s*\d{3,4}호/g, ''); // 일반적인 호수 (804, 1301호 등)
    
    // 빌라, 아파트명 뒤의 상세정보 제거
    normalized = normalized.replace(/(빌라|아파트|APT)\s+[A-Z가-힣]*동?\s*\d*호?.*$/gi, '$1');

    // 주소 단위 정규화
    const replacements = [
      // 건물 번호 정규화 (띄어쓰기 보존)
      ['번지', '번'], ['-번', '번'], ['번호', '번'],
      // 기타 정규화
      ['아파트', 'APT'], ['타워', '타워']
    ];

    replacements.forEach(([from, to]) => {
      normalized = normalized.replace(new RegExp(from, 'g'), to);
    });

    // 여러 공백을 하나로 정리
    normalized = normalized.replace(/\s+/g, ' ');

    return normalized.trim();
  }

  // 주소 유효성 검사
  isValidAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const trimmed = address.trim();
    
    // 최소 길이 체크
    if (trimmed.length < 2) {
      return false;
    }

    // 숫자만 있는 경우 제외
    if (/^\d+$/.test(trimmed)) {
      return false;
    }

    // 의미있는 주소 구성요소가 있는지 체크
    const addressKeywords = [
      '시', '군', '구', '동', '읍', '면', '리', '로', '길', '가',
      '번', '호', '층', '아파트', 'APT', '빌딩', '타워'
    ];

    return addressKeywords.some(keyword => trimmed.includes(keyword));
  }

  // 주소 구성요소 분석
  parseAddressComponents(address) {
    const normalized = this.normalizeAddress(address);
    const parts = normalized.split(' ').filter(Boolean);

    const components = {
      sido: '',      // 시/도
      sigungu: '',   // 시/군/구
      dong: '',      // 동/읍/면
      road: '',      // 도로명
      building: '',  // 건물명/번지
      detail: ''     // 상세주소
    };

    // 시/도 찾기: 토큰 기준으로 첫 번째 시/도 접미사 포함 토큰
    const sidoSuffixes = ['특별시','광역시','특별자치시','도','특별자치도'];
    let sidoIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (sidoSuffixes.some(suf => parts[i].endsWith(suf))) {
        components.sido = parts[i];
        sidoIndex = i;
        break;
      }
    }

    // 시/군/구 찾기: 시/도 다음 토큰 중 첫 번째로 시/군/구로 끝나는 토큰
    for (let i = Math.max(0, sidoIndex + 1); i < parts.length; i++) {
      if (/(시|군|구)$/.test(parts[i])) {
        components.sigungu = parts[i];
        break;
      }
    }

    // 동/읍/면 찾기: 그 다음 토큰 중 동/읍/면으로 끝나는 토큰(숫자 붙은 경우 제외)
    for (let i = 0; i < parts.length; i++) {
      if (/(동|읍|면)$/.test(parts[i])) {
        components.dong = parts[i];
        break;
      }
    }

    // 도로명 찾기: 공백 없이 숫자가 이어지는 경우도 허용(예: 테헤란로123)
    const roadMatch = normalized.match(/([^\s]+(?:로|길))(?=\s|$|\d)/);
    if (roadMatch) components.road = roadMatch[0];

    return components;
  }

  // 주소 타입 판별 (지번 vs 도로명)
  getAddressType(address) {
    const normalized = this.normalizeAddress(address);
    
    // 도로명 주소 패턴
    if (/\d+로|\d+길/.test(normalized)) {
      return 'ROAD';
    }
    
    // 지번 주소 패턴
    if (/\d+번지|\d+번/.test(normalized) && !/(로|길)/.test(normalized)) {
      return 'JIBUN';
    }
    
    return 'UNKNOWN';
  }

  // 우편번호 유효성 검사
  isValidPostalCode(postalCode) {
    if (!postalCode) return false;
    
    const code = String(postalCode).trim();
    return /^\d{5}$/.test(code);
  }

  // 주소 유사도 계산 (간단한 방식)
  calculateSimilarity(address1, address2) {
    const norm1 = this.normalizeAddress(address1).toLowerCase();
    const norm2 = this.normalizeAddress(address2).toLowerCase();
    
    if (norm1 === norm2) return 1;
    
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    
    let commonWords = 0;
    const totalWords = Math.max(words1.length, words2.length);
    
    words1.forEach(word1 => {
      if (words2.some(word2 => word1.includes(word2) || word2.includes(word1))) {
        commonWords++;
      }
    });
    
    return commonWords / totalWords;
  }

  // 주소 제안 생성
  generateSuggestions(originalAddress, searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const suggestions = searchResults.map(result => ({
      address: result.address,
      similarity: this.calculateSimilarity(originalAddress, result.address),
      type: this.getAddressType(result.address)
    }));

    // 유사도순으로 정렬
    suggestions.sort((a, b) => b.similarity - a.similarity);
    
    return suggestions.slice(0, 5); // 상위 5개만 반환
  }

  splitAddressDetail(address) {
    if (!address || typeof address !== 'string') {
      return { main: '', detail: '' };
    }

    let main = String(address).trim();
    const detailParts = [];

    // 괄호 안의 정보는 상세로 이동
    main = main.replace(/\(([^)]+)\)/g, (_, inner) => {
      const clean = inner.trim();
      if (clean) detailParts.push(clean);
      return '';
    });

    // 쉼표 이후에 오는 동/호 정보는 상세로 이동
    const commaSegments = main.split(',').map(seg => seg.trim()).filter(Boolean);
    if (commaSegments.length > 1) {
      const last = commaSegments[commaSegments.length - 1];
      if (/\d/.test(last) && /(동|호|층)/.test(last)) {
        detailParts.push(last);
        commaSegments.pop();
        main = commaSegments.join(', ').trim();
      }
    }

    // 끝부분에 위치한 동/호/층 정보 추출
    const tokens = main.split(' ').filter(Boolean);
    const tailTokens = [];
    while (tokens.length) {
      const token = tokens[tokens.length - 1];
      if (/\d/.test(token) && /(동|호|층)$/i.test(token)) {
        tailTokens.unshift(token);
        tokens.pop();
        continue;
      }
      if (/^[A-Za-z가-힣]+동$/i.test(token) && tailTokens.length) {
        tailTokens.unshift(token);
        tokens.pop();
        continue;
      }
      break;
    }
    if (tailTokens.length) {
      detailParts.push(tailTokens.join(' ').trim());
      main = tokens.join(' ').trim();
    }

    // 하이픈 형태(예: 101-1203, B-1203, 101동-1203호 등) 상세 추출
    if (!detailParts.length) {
      const hyphenDetailRegex = /(?:\s|^)([A-Za-z가-힣]*\s*\d{1,4}\s*동\s*-?\s*\d{1,4}(?:\s*(?:호|층))?|[A-Za-z]?\d{1,3}-\d{1,4}(?:\s*(?:호|층))?)\s*$/;
      const m = main.match(hyphenDetailRegex);
      if (m && m[1]) {
        const seg = m[1].trim();
        // 과도한 분해 없이 원형 유지하여 상세주소에 수록
        detailParts.push(seg);
        main = main.slice(0, m.index).trim();
      }
    }

    main = main.replace(/\s{2,}/g, ' ').trim();
    const detail = detailParts.join(' ').replace(/\s{2,}/g, ' ').trim();
    return { main, detail };
  }
}

module.exports = new AddressParser();
