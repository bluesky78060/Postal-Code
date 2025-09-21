const axios = require('axios');

class OpenPostalCodeService {
  constructor() {
    // 무료 우편번호 검색 API들
    this.apis = [
      {
        name: 'juso.go.kr',
        baseUrl: 'https://www.juso.go.kr/addrlink/addrLinkApi.do',
        needsKey: true
      },
      {
        name: 'dapi.kakao.com',
        baseUrl: 'https://dapi.kakao.com/v2/local/search/address.json',
        needsKey: true
      }
    ];
  }

  async findPostalCode(address) {
    console.log(`🔍 주소 검색 시작: "${address}"`);
    
    // 주소 정규화 (우체국 방식 참고)
    const normalizedAddress = this._normalizeAddress(address);
    console.log(`🔧 정규화된 주소: "${normalizedAddress}"`);
    
    // 주소 구성 요소 파싱
    const parsedAddress = this._parseAddress(normalizedAddress);
    console.log(`📝 파싱된 구성요소:`, parsedAddress);
    
    const mockData = this._getMockPostalData();
    
    // 부분 도로명 검색 감지 (예: "문단길 15", "테헤란로 123")
    const keywords = normalizedAddress.split(/\s+/).filter(word => word.length > 1);
    const isPartialRoadSearch = keywords.some(keyword => 
      /.*[로길]$/.test(keyword) || /^\d+(-\d+)?$/.test(keyword)
    ) && keywords.length <= 3;
    
    if (isPartialRoadSearch) {
      console.log(`🎯 부분 도로명 검색 모드: ${JSON.stringify(keywords)}`);
      const partialRoadMatch = this._findPartialRoadMatch(keywords, mockData);
      if (partialRoadMatch) {
        console.log(`✨ 부분 도로명 매치 발견: ${partialRoadMatch.postalCode} - ${partialRoadMatch.fullAddress}`);
        return this._formatResult(partialRoadMatch);
      }
    }
    
    // 1단계: 정확한 매치 (시도 + 시군구 + 읍면동/리)
    const exactMatch = this._findExactMatch(parsedAddress, mockData);
    if (exactMatch) {
      console.log(`✅ 정확한 매치 발견: ${exactMatch.postalCode} - ${exactMatch.fullAddress}`);
      return this._formatResult(exactMatch);
    }
    
    // 2단계: 부분 매치 (시도 + 시군구만)
    const partialMatch = this._findPartialMatch(parsedAddress, mockData);
    if (partialMatch) {
      console.log(`🟡 부분 매치 발견: ${partialMatch.postalCode} - ${partialMatch.fullAddress}`);
      return this._formatResult(partialMatch);
    }
    
    // 3단계: 유사 매치 (키워드 기반)
    const fuzzyMatch = this._findFuzzyMatch(normalizedAddress, mockData);
    if (fuzzyMatch) {
      console.log(`🔍 유사 매치 발견: ${fuzzyMatch.postalCode} - ${fuzzyMatch.fullAddress}`);
      return this._formatResult(fuzzyMatch);
    }

    console.log(`❌ 매치되는 주소를 찾을 수 없음: "${address}"`);
    return null;
  }

  // 주소 정규화 (우체국 방식 참고)
  _normalizeAddress(address) {
    let normalized = address;
    
    // 1. 특수문자 제거 (괄호, 쉼표, 점 등)
    normalized = normalized.replace(/[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\#$%&\\\=\(\'\"]/gi, ' ');
    
    // 2. 번지 관련 패턴 정리
    normalized = normalized.replace(/(\d+)-(\d+)/g, '$1$2'); // 123-45 -> 12345
    normalized = normalized.replace(/(\d+)번지/g, '$1'); // 123번지 -> 123
    normalized = normalized.replace(/(\d+)번/g, '$1'); // 123번 -> 123
    
    // 3. 다중 공백을 단일 공백으로
    normalized = normalized.replace(/\s+/g, ' ');
    
    // 4. 앞뒤 공백 제거
    normalized = normalized.trim();
    
    // 5. 시/도 표준화
    normalized = normalized.replace(/서울시/g, '서울특별시');
    normalized = normalized.replace(/부산시/g, '부산광역시');
    normalized = normalized.replace(/대구시/g, '대구광역시');
    normalized = normalized.replace(/인천시/g, '인천광역시');
    normalized = normalized.replace(/광주시/g, '광주광역시');
    normalized = normalized.replace(/대전시/g, '대전광역시');
    normalized = normalized.replace(/울산시/g, '울산광역시');
    
    return normalized;
  }

  // 주소 구성 요소 파싱 (도로명주소 + 지번주소 지원)
  _parseAddress(address) {
    const parsed = {
      sido: '',
      sigungu: '',
      eubmyeondong: '',
      ri: '',
      roadName: '',
      buildingNumber: '',
      jibun: '',
      isJibunAddress: false,
      keywords: []
    };
    
    const tokens = address.split(/\s+/);
    
    // 시도 찾기
    const sidoPatterns = [
      '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', 
      '대전광역시', '울산광역시', '세종특별자치시', '제주특별자치도',
      '경기도', '강원특별자치도', '충청북도', '충청남도', '전라북도', 
      '전라남도', '경상북도', '경상남도'
    ];
    
    for (const token of tokens) {
      for (const sido of sidoPatterns) {
        if (token.includes(sido.substring(0, 2)) || token === sido) {
          parsed.sido = sido;
          break;
        }
      }
      if (parsed.sido) break;
    }
    
    // 시군구 찾기 (구, 시, 군으로 끝나는 것)
    for (const token of tokens) {
      if (/.*[구시군]$/.test(token) && token !== parsed.sido) {
        parsed.sigungu = token;
        break;
      }
    }
    
    // 읍면동리 찾기
    for (const token of tokens) {
      if (/.*[읍면동리가]$/.test(token) && token !== parsed.sido && token !== parsed.sigungu) {
        if (token.endsWith('읍') || token.endsWith('면')) {
          parsed.eubmyeondong = token;
        } else if (token.endsWith('동') || token.endsWith('가')) {
          parsed.eubmyeondong = token;
        } else if (token.endsWith('리')) {
          parsed.ri = token;
        }
        break;
      }
    }
    
    // 도로명 찾기 (로, 길로 끝나는 것)
    let hasRoadName = false;
    for (const token of tokens) {
      if (/.*[로길]$/.test(token)) {
        parsed.roadName = token;
        hasRoadName = true;
        break;
      }
    }
    
    // 지번 형태 찾기 (숫자-숫자 또는 숫자만)
    for (const token of tokens) {
      if (/^\d+(-\d+)?$/.test(token)) {
        if (hasRoadName) {
          parsed.buildingNumber = token;
        } else {
          parsed.jibun = token;
          parsed.isJibunAddress = true;
        }
        break;
      }
    }
    
    // 지번주소 여부 판단 (도로명이 없고 숫자가 있으면 지번주소로 간주)
    if (!hasRoadName && parsed.jibun) {
      parsed.isJibunAddress = true;
    }
    
    // 모든 토큰을 키워드로 저장
    parsed.keywords = tokens;
    
    return parsed;
  }

  // 부분 도로명 검색 전용 함수
  _findPartialRoadMatch(keywords, mockData) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const data of mockData) {
      let score = 0;
      let roadNameMatch = false;
      let buildingMatch = false;
      
      for (const keyword of keywords) {
        // 도로명 정확 매치 확인
        if (/.*[로길]$/.test(keyword) && data.roadName === keyword) {
          roadNameMatch = true;
          score += 10; // 도로명 정확 매치에 높은 점수
          console.log(`🎯 도로명 정확 매치: ${keyword} = ${data.roadName} (${data.fullAddress})`);
        }
        
        // 번지 정확 매치 확인
        if (/^\d+(-\d+)?$/.test(keyword) && 
            (data.buildingNumber === keyword || data.jibun === keyword)) {
          buildingMatch = true;
          score += 5; // 번지 정확 매치
          console.log(`🏠 번지 정확 매치: ${keyword} = ${data.buildingNumber || data.jibun} (${data.fullAddress})`);
        }
      }
      
      // 도로명과 번지 모두 매치되면 최우선
      if (roadNameMatch && buildingMatch) {
        score += 20; // 완전 매치 보너스
        console.log(`✨ 완전 매치! 최종 점수: ${score} (${data.fullAddress})`);
        return data; // 즉시 반환
      }
      
      // 최고 점수 업데이트
      if (score > bestScore) {
        bestScore = score;
        bestMatch = data;
      }
    }
    
    return bestMatch;
  }

  // 정확한 매치 찾기 (도로명주소 + 지번주소)
  _findExactMatch(parsedAddress, mockData) {
    for (const data of mockData) {
      let score = 0;
      
      // 시도 매치 (필수)
      if (parsedAddress.sido && data.sido === parsedAddress.sido) score += 3;
      else if (parsedAddress.sido && data.sido.includes(parsedAddress.sido.substring(0, 2))) score += 2;
      else continue; // 시도가 매치되지 않으면 제외
      
      // 시군구 매치 (필수)
      if (parsedAddress.sigungu && data.sigungu === parsedAddress.sigungu) score += 3;
      else if (parsedAddress.sigungu && data.sigungu.includes(parsedAddress.sigungu.substring(0, 2))) score += 2;
      else continue; // 시군구가 매치되지 않으면 제외
      
      // 읍면동 매치
      if (parsedAddress.eubmyeondong && data.eubmyeondong === parsedAddress.eubmyeondong) score += 2;
      
      // 리 매치
      if (parsedAddress.ri && data.ri === parsedAddress.ri) score += 2;
      
      // 지번주소 vs 도로명주소 구분하여 매치
      if (parsedAddress.isJibunAddress) {
        // 지번주소 매치
        if (parsedAddress.jibun && data.jibun && data.jibun.includes(parsedAddress.jibun)) score += 3;
      } else {
        // 도로명주소 매치
        if (parsedAddress.roadName && data.roadName === parsedAddress.roadName) score += 2;
        if (parsedAddress.buildingNumber && data.buildingNumber && data.buildingNumber.includes(parsedAddress.buildingNumber)) score += 1;
      }
      
      // 정확한 매치로 간주하는 최소 점수 (시도 + 시군구 + 읍면동/리 또는 지번/도로명)
      if (score >= 7) {
        return data;
      }
    }
    
    return null;
  }

  // 부분 매치 찾기
  _findPartialMatch(parsedAddress, mockData) {
    for (const data of mockData) {
      let score = 0;
      
      // 시도 매치 (필수)
      if (parsedAddress.sido && data.sido.includes(parsedAddress.sido.substring(0, 2))) score += 2;
      else continue;
      
      // 시군구 매치 (필수)
      if (parsedAddress.sigungu && data.sigungu.includes(parsedAddress.sigungu.substring(0, 2))) score += 2;
      else continue;
      
      // 부분 매치로 간주하는 최소 점수 (시도 + 시군구)
      if (score >= 4) {
        return data;
      }
    }
    
    return null;
  }

  // 유사 매치 찾기 (키워드 기반 - 도로명주소 + 지번주소 + 부분 도로명 검색)
  _findFuzzyMatch(normalizedAddress, mockData) {
    const keywords = normalizedAddress.split(/\s+/).filter(word => word.length > 1);
    let bestMatch = null;
    let bestScore = 0;
    
    // 도로명만 입력된 경우 감지 (예: "문단길 15")
    const isPartialRoadSearch = keywords.some(keyword => 
      /.*[로길]$/.test(keyword) || /^\d+(-\d+)?$/.test(keyword)
    ) && keywords.length <= 3;
    
    console.log(`🔍 부분 도로명 검색 감지: ${isPartialRoadSearch}, 키워드: ${JSON.stringify(keywords)}`);
    
    for (const data of mockData) {
      let score = 0;
      
      // 부분 도로명 검색인 경우 도로명과 번지만 정확히 매치
      if (isPartialRoadSearch) {
        let roadNameMatch = false;
        let buildingMatch = false;
        
        for (const keyword of keywords) {
          // 도로명 정확 매치
          if (/.*[로길]$/.test(keyword) && data.roadName === keyword) {
            roadNameMatch = true;
            score += 5; // 도로명 정확 매치 높은 점수
            console.log(`🎯 도로명 매치: ${keyword} = ${data.roadName}, 현재 점수: ${score}, 주소: ${data.fullAddress}`);
          }
          // 번지 정확 매치
          if (/^\d+(-\d+)?$/.test(keyword) && 
              (data.buildingNumber === keyword || data.jibun === keyword)) {
            buildingMatch = true;
            score += 3; // 번지 정확 매치
            console.log(`🏠 번지 매치: ${keyword} = ${data.buildingNumber || data.jibun}, 현재 점수: ${score}, 주소: ${data.fullAddress}`);
          }
        }
        
        // 도로명과 번지가 모두 매치되면 최우선 후보
        if (roadNameMatch && buildingMatch) {
          score += 10;
          console.log(`✨ 완전 매치! 최종 점수: ${score}, 주소: ${data.fullAddress}`);
        }
      } else {
        // 기존 키워드 기반 검색 - 더 정확한 매칭
        const roadNameText = `${data.sido} ${data.sigungu} ${data.eubmyeondong || ''} ${data.ri || ''} ${data.roadName} ${data.fullAddress}`.toLowerCase();
        const jibunText = `${data.sido} ${data.sigungu} ${data.eubmyeondong || ''} ${data.ri || ''} ${data.jibun || ''} ${data.jibunAddress || ''}`.toLowerCase();
        
        let roadScore = 0;
        let jibunScore = 0;
        
        for (const keyword of keywords) {
          // 도로명 정확 매치에 더 높은 점수
          if (data.roadName === keyword) {
            roadScore += 3;
          } else if (roadNameText.includes(keyword.toLowerCase())) {
            roadScore += 1;
          }
          
          // 번지 정확 매치에 더 높은 점수
          if (data.buildingNumber === keyword || data.jibun === keyword) {
            roadScore += 3;
          } else if (jibunText.includes(keyword.toLowerCase())) {
            jibunScore += 1;
          }
        }
        
        score = Math.max(roadScore, jibunScore);
        
        // 키워드의 50% 이상 매치 필요
        const matchRatio = score / keywords.length;
        if (matchRatio < 0.5) {
          continue;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = data;
      }
    }
    
    return bestMatch;
  }

  // 결과 포맷팅
  _formatResult(data) {
    return {
      postalCode: data.postalCode,
      fullAddress: data.fullAddress,
      sido: data.sido,
      sigungu: data.sigungu,
      roadName: data.roadName || '',
      buildingNumber: data.buildingNumber || '',
      coordinates: null
    };
  }

  _getMockPostalData() {
    return [
      // 서울특별시 - 구/동 세분화 (도로명주소 + 지번주소)
      { postalCode: '06159', sido: '서울특별시', sigungu: '강남구', eubmyeondong: '역삼동', ri: '', roadName: '테헤란로', buildingNumber: '123', jibun: '123-45', fullAddress: '서울특별시 강남구 역삼동 테헤란로 123', jibunAddress: '서울특별시 강남구 역삼동 123-45' },
      { postalCode: '06292', sido: '서울특별시', sigungu: '강남구', eubmyeondong: '삼성동', ri: '', roadName: '강남대로', buildingNumber: '456', jibun: '159-1', fullAddress: '서울특별시 강남구 삼성동 강남대로 456', jibunAddress: '서울특별시 강남구 삼성동 159-1' },
      { postalCode: '06293', sido: '서울특별시', sigungu: '강남구', eubmyeondong: '청담동', ri: '', roadName: '압구정로', buildingNumber: '100', jibun: '46-10', fullAddress: '서울특별시 강남구 청담동 압구정로 100', jibunAddress: '서울특별시 강남구 청담동 46-10' },
      { postalCode: '03141', sido: '서울특별시', sigungu: '종로구', eubmyeondong: '종로1가', ri: '', roadName: '종로', buildingNumber: '1', jibun: '1', fullAddress: '서울특별시 종로구 종로1가 종로 1', jibunAddress: '서울특별시 종로구 종로1가 1' },
      { postalCode: '03142', sido: '서울특별시', sigungu: '종로구', eubmyeondong: '종로2가', ri: '', roadName: '종로', buildingNumber: '50', jibun: '50-1', fullAddress: '서울특별시 종로구 종로2가 종로 50', jibunAddress: '서울특별시 종로구 종로2가 50-1' },
      { postalCode: '04524', sido: '서울특별시', sigungu: '중구', eubmyeondong: '명동1가', ri: '', roadName: '명동길', buildingNumber: '123', jibun: '26-5', fullAddress: '서울특별시 중구 명동1가 명동길 123', jibunAddress: '서울특별시 중구 명동1가 26-5' },
      { postalCode: '04525', sido: '서울특별시', sigungu: '중구', eubmyeondong: '명동2가', ri: '', roadName: '명동길', buildingNumber: '200', jibun: '31-1', fullAddress: '서울특별시 중구 명동2가 명동길 200', jibunAddress: '서울특별시 중구 명동2가 31-1' },
      { postalCode: '07774', sido: '서울특별시', sigungu: '강서구', eubmyeondong: '화곡동', ri: '', roadName: '공항대로', buildingNumber: '600', jibun: '1130', fullAddress: '서울특별시 강서구 화곡동 공항대로 600', jibunAddress: '서울특별시 강서구 화곡동 1130' },
      { postalCode: '07775', sido: '서울특별시', sigungu: '강서구', eubmyeondong: '염창동', ri: '', roadName: '염창로', buildingNumber: '300', jibun: '272-1', fullAddress: '서울특별시 강서구 염창동 염창로 300', jibunAddress: '서울특별시 강서구 염창동 272-1' },
      
      // 부산광역시 - 구/동 세분화
      { postalCode: '48058', sido: '부산광역시', sigungu: '해운대구', eubmyeondong: '우동', ri: '', roadName: '센텀로', buildingNumber: '456', fullAddress: '부산광역시 해운대구 우동 센텀로 456' },
      { postalCode: '48095', sido: '부산광역시', sigungu: '해운대구', eubmyeondong: '해운대동', ri: '', roadName: '해운대해변로', buildingNumber: '264', fullAddress: '부산광역시 해운대구 해운대동 해운대해변로 264' },
      { postalCode: '49241', sido: '부산광역시', sigungu: '서구', eubmyeondong: '동대신동', ri: '', roadName: '구덕로', buildingNumber: '225', fullAddress: '부산광역시 서구 동대신동 구덕로 225' },
      { postalCode: '49242', sido: '부산광역시', sigungu: '서구', eubmyeondong: '서대신동', ri: '', roadName: '서대신로', buildingNumber: '100', fullAddress: '부산광역시 서구 서대신동 서대신로 100' },
      
      // 대구광역시 - 구/동 세분화
      { postalCode: '41940', sido: '대구광역시', sigungu: '중구', eubmyeondong: '동인동', ri: '', roadName: '중앙대로', buildingNumber: '789', fullAddress: '대구광역시 중구 동인동 중앙대로 789' },
      { postalCode: '42601', sido: '대구광역시', sigungu: '달서구', eubmyeondong: '성서동', ri: '', roadName: '성서공단로', buildingNumber: '11', fullAddress: '대구광역시 달서구 성서동 성서공단로 11' },
      { postalCode: '42602', sido: '대구광역시', sigungu: '달서구', eubmyeondong: '이곡동', ri: '', roadName: '이곡대로', buildingNumber: '50', fullAddress: '대구광역시 달서구 이곡동 이곡대로 50' },
      
      // 인천광역시 - 구/동 세분화
      { postalCode: '22382', sido: '인천광역시', sigungu: '중구', eubmyeondong: '운서동', ri: '', roadName: '공항로', buildingNumber: '272', fullAddress: '인천광역시 중구 운서동 공항로 272' },
      { postalCode: '21999', sido: '인천광역시', sigungu: '연수구', eubmyeondong: '송도동', ri: '', roadName: '송도과학로', buildingNumber: '123', fullAddress: '인천광역시 연수구 송도동 송도과학로 123' },
      { postalCode: '22000', sido: '인천광역시', sigungu: '연수구', eubmyeondong: '연수동', ri: '', roadName: '연수로', buildingNumber: '200', fullAddress: '인천광역시 연수구 연수동 연수로 200' },
      
      // 경상북도 - 군/읍/면/리 세분화 (도로명주소 + 지번주소)
      { postalCode: '36209', sido: '경상북도', sigungu: '봉화군', eubmyeondong: '봉화읍', ri: '문단리', roadName: '문단길', buildingNumber: '15', jibun: '699-3', fullAddress: '경상북도 봉화군 봉화읍 문단리 문단길 15', jibunAddress: '경상북도 봉화군 봉화읍 문단리 699-3' },
      { postalCode: '36209', sido: '경상북도', sigungu: '봉화군', eubmyeondong: '봉화읍', ri: '문단리', roadName: '문단길', buildingNumber: '25', jibun: '748-1', fullAddress: '경상북도 봉화군 봉화읍 문단리 문단길 25', jibunAddress: '경상북도 봉화군 봉화읍 문단리 748-1' },
      { postalCode: '36209', sido: '경상북도', sigungu: '봉화군', eubmyeondong: '봉화읍', ri: '문단리', roadName: '문단길', buildingNumber: '30', jibun: '700-3', fullAddress: '경상북도 봉화군 봉화읍 문단리 문단길 30', jibunAddress: '경상북도 봉화군 봉화읍 문단리 700-3' },
      { postalCode: '36226', sido: '경상북도', sigungu: '봉화군', eubmyeondong: '봉화읍', ri: '화천리', roadName: '화천로', buildingNumber: '432', jibun: '432', fullAddress: '경상북도 봉화군 봉화읍 화천리 432', jibunAddress: '경상북도 봉화군 봉화읍 화천리 432' },
      { postalCode: '36227', sido: '경상북도', sigungu: '봉화군', eubmyeondong: '물야면', ri: '가평리', roadName: '가평로', buildingNumber: '100', jibun: '100', fullAddress: '경상북도 봉화군 물야면 가평리 100', jibunAddress: '경상북도 봉화군 물야면 가평리 100' },
      { postalCode: '36228', sido: '경상북도', sigungu: '봉화군', eubmyeondong: '춘양면', ri: '의양리', roadName: '의양로', buildingNumber: '200', jibun: '200', fullAddress: '경상북도 봉화군 춘양면 의양리 200', jibunAddress: '경상북도 봉화군 춘양면 의양리 200' },
      
      // 영주시 데이터 확장
      { postalCode: '36313', sido: '경상북도', sigungu: '영주시', eubmyeondong: '가흥동', ri: '', roadName: '가흥로', buildingNumber: '1796', jibun: '1796', fullAddress: '경상북도 영주시 가흥동 1796', jibunAddress: '경상북도 영주시 가흥동 1796' },
      { postalCode: '36320', sido: '경상북도', sigungu: '영주시', eubmyeondong: '하망동', ri: '', roadName: '하망로', buildingNumber: '366-1', jibun: '366-1', fullAddress: '경상북도 영주시 하망동 366-1', jibunAddress: '경상북도 영주시 하망동 366-1' },
      { postalCode: '36321', sido: '경상북도', sigungu: '영주시', eubmyeondong: '풍기읍', ri: '서부리', roadName: '풍기로', buildingNumber: '100', jibun: '100', fullAddress: '경상북도 영주시 풍기읍 서부리 100', jibunAddress: '경상북도 영주시 풍기읍 서부리 100' },
      { postalCode: '36322', sido: '경상북도', sigungu: '영주시', eubmyeondong: '안정면', ri: '신전리', roadName: '안정로', buildingNumber: '288', jibun: '288', fullAddress: '경상북도 영주시 안정면 신전리 288', jibunAddress: '경상북도 영주시 안정면 신전리 288' },
      { postalCode: '36350', sido: '경상북도', sigungu: '영주시', eubmyeondong: '영주동', ri: '', roadName: '중앙로', buildingNumber: '1235', jibun: '1235', fullAddress: '경상북도 영주시 영주동 1235', jibunAddress: '경상북도 영주시 영주동 1235' },
      
      // 경주시 데이터 추가
      { postalCode: '38120', sido: '경상북도', sigungu: '경주시', eubmyeondong: '안강읍', ri: '양월리', roadName: '양월로', buildingNumber: '1201-11', jibun: '1201-11', fullAddress: '경상북도 경주시 안강읍 양월리 1201-11', jibunAddress: '경상북도 경주시 안강읍 양월리 1201-11' },
      { postalCode: '38100', sido: '경상북도', sigungu: '경주시', eubmyeondong: '황남동', ri: '', roadName: '첨성로', buildingNumber: '169', jibun: '31', fullAddress: '경상북도 경주시 황남동 첨성로 169', jibunAddress: '경상북도 경주시 황남동 31' },
      { postalCode: '38101', sido: '경상북도', sigungu: '경주시', eubmyeondong: '노동동', ri: '', roadName: '알천북로', buildingNumber: '1', jibun: '839-1', fullAddress: '경상북도 경주시 노동동 알천북로 1', jibunAddress: '경상북도 경주시 노동동 839-1' },
      { postalCode: '38102', sido: '경상북도', sigungu: '경주시', eubmyeondong: '성동동', ri: '', roadName: '동천로', buildingNumber: '100', jibun: '573-3', fullAddress: '경상북도 경주시 성동동 동천로 100', jibunAddress: '경상북도 경주시 성동동 573-3' },
      
      // 안동시 데이터 추가
      { postalCode: '36650', sido: '경상북도', sigungu: '안동시', eubmyeondong: '정상동', ri: '', roadName: '정상길', buildingNumber: '691', jibun: '691', fullAddress: '경상북도 안동시 정상동 691', jibunAddress: '경상북도 안동시 정상동 691' },
      { postalCode: '36644', sido: '경상북도', sigungu: '안동시', eubmyeondong: '명륜동', ri: '', roadName: '경동로', buildingNumber: '100', jibun: '169-1', fullAddress: '경상북도 안동시 명륜동 100', jibunAddress: '경상북도 안동시 명륜동 169-1' },
      { postalCode: '36645', sido: '경상북도', sigungu: '안동시', eubmyeondong: '운흥동', ri: '', roadName: '운흥길', buildingNumber: '200', jibun: '200', fullAddress: '경상북도 안동시 운흥동 200', jibunAddress: '경상북도 안동시 운흥동 200' },
      { postalCode: '36646', sido: '경상북도', sigungu: '안동시', eubmyeondong: '서부동', ri: '', roadName: '서부로', buildingNumber: '300', jibun: '300-5', fullAddress: '경상북도 안동시 서부동 300', jibunAddress: '경상북도 안동시 서부동 300-5' },
      
      // 경기도 - 시/구/동 세분화
      { postalCode: '13494', sido: '경기도', sigungu: '성남시', eubmyeondong: '분당구', ri: '정자동', roadName: '판교역로', buildingNumber: '123', fullAddress: '경기도 성남시 분당구 정자동 판교역로 123' },
      { postalCode: '13495', sido: '경기도', sigungu: '성남시', eubmyeondong: '분당구', ri: '서현동', roadName: '서현로', buildingNumber: '200', fullAddress: '경기도 성남시 분당구 서현동 서현로 200' },
      { postalCode: '16677', sido: '경기도', sigungu: '수원시', eubmyeondong: '영통구', ri: '광교동', roadName: '광교로', buildingNumber: '456', fullAddress: '경기도 수원시 영통구 광교동 광교로 456' },
      { postalCode: '16678', sido: '경기도', sigungu: '수원시', eubmyeondong: '팔달구', ri: '행궁동', roadName: '행궁로', buildingNumber: '100', fullAddress: '경기도 수원시 팔달구 행궁동 행궁로 100' },
      { postalCode: '10326', sido: '경기도', sigungu: '고양시', eubmyeondong: '일산동구', ri: '백석동', roadName: '중앙로', buildingNumber: '789', fullAddress: '경기도 고양시 일산동구 백석동 중앙로 789' },
      { postalCode: '10327', sido: '경기도', sigungu: '고양시', eubmyeondong: '일산서구', ri: '주엽동', roadName: '주엽로', buildingNumber: '300', fullAddress: '경기도 고양시 일산서구 주엽동 주엽로 300' },
      
      // 강원특별자치도 - 시/군/읍/면/리 세분화
      { postalCode: '24341', sido: '강원특별자치도', sigungu: '춘천시', eubmyeondong: '온의동', ri: '', roadName: '중앙로', buildingNumber: '100', fullAddress: '강원특별자치도 춘천시 온의동 중앙로 100' },
      { postalCode: '25440', sido: '강원특별자치도', sigungu: '강릉시', eubmyeondong: '교동', ri: '', roadName: '경강로', buildingNumber: '200', fullAddress: '강원특별자치도 강릉시 교동 경강로 200' },
      { postalCode: '26461', sido: '강원특별자치도', sigungu: '원주시', eubmyeondong: '중앙동', ri: '', roadName: '원일로', buildingNumber: '300', fullAddress: '강원특별자치도 원주시 중앙동 원일로 300' },
      { postalCode: '25903', sido: '강원특별자치도', sigungu: '정선군', eubmyeondong: '고한읍', ri: '고한리', roadName: '고한로', buildingNumber: '155', fullAddress: '강원특별자치도 정선군 고한읍 고한리 155' },
      { postalCode: '25904', sido: '강원특별자치도', sigungu: '정선군', eubmyeondong: '남면', ri: '무릉리', roadName: '무릉로', buildingNumber: '100', fullAddress: '강원특별자치도 정선군 남면 무릉리 100' },
      
      // 전라남도 - 시/군/읍/면/리 세분화
      { postalCode: '58738', sido: '전라남도', sigungu: '목포시', eubmyeondong: '용당동', ri: '', roadName: '용당로', buildingNumber: '100', fullAddress: '전라남도 목포시 용당동 용당로 100' },
      { postalCode: '59757', sido: '전라남도', sigungu: '여수시', eubmyeondong: '중앙동', ri: '', roadName: '중앙로', buildingNumber: '200', fullAddress: '전라남도 여수시 중앙동 중앙로 200' },
      { postalCode: '57997', sido: '전라남도', sigungu: '순천시', eubmyeondong: '조례동', ri: '', roadName: '순천로', buildingNumber: '300', fullAddress: '전라남도 순천시 조례동 순천로 300' },
      { postalCode: '58463', sido: '전라남도', sigungu: '해남군', eubmyeondong: '해남읍', ri: '읍내리', roadName: '해남로', buildingNumber: '100', fullAddress: '전라남도 해남군 해남읍 읍내리 100' },
      { postalCode: '58464', sido: '전라남도', sigungu: '해남군', eubmyeondong: '송지면', ri: '송지리', roadName: '송지로', buildingNumber: '200', fullAddress: '전라남도 해남군 송지면 송지리 200' },
      
      // 제주특별자치도 - 시/읍/면/동/리 세분화
      { postalCode: '63241', sido: '제주특별자치도', sigungu: '제주시', eubmyeondong: '일도1동', ri: '', roadName: '중앙로', buildingNumber: '100', fullAddress: '제주특별자치도 제주시 일도1동 중앙로 100' },
      { postalCode: '63242', sido: '제주특별자치도', sigungu: '제주시', eubmyeondong: '일도2동', ri: '', roadName: '일주로', buildingNumber: '200', fullAddress: '제주특별자치도 제주시 일도2동 일주로 200' },
      { postalCode: '63535', sido: '제주특별자치도', sigungu: '제주시', eubmyeondong: '애월읍', ri: '고성리', roadName: '애월로', buildingNumber: '300', fullAddress: '제주특별자치도 제주시 애월읍 고성리 300' },
      { postalCode: '63536', sido: '제주특별자치도', sigungu: '제주시', eubmyeondong: '한림읍', ri: '한림리', roadName: '한림로', buildingNumber: '400', fullAddress: '제주특별자치도 제주시 한림읍 한림리 400' },
      { postalCode: '63591', sido: '제주특별자치도', sigungu: '서귀포시', eubmyeondong: '대정읍', ri: '하모리', roadName: '대정로', buildingNumber: '100', fullAddress: '제주특별자치도 서귀포시 대정읍 하모리 100' },
      { postalCode: '63592', sido: '제주특별자치도', sigungu: '서귀포시', eubmyeondong: '남원읍', ri: '남원리', roadName: '남원로', buildingNumber: '200', fullAddress: '제주특별자치도 서귀포시 남원읍 남원리 200' },
      
      // 기존 데이터들...
      { postalCode: '61947', sido: '광주광역시', sigungu: '서구', eubmyeondong: '상무동', ri: '', roadName: '상무대로', buildingNumber: '312', fullAddress: '광주광역시 서구 상무동 상무대로 312' },
      { postalCode: '34051', sido: '대전광역시', sigungu: '유성구', eubmyeondong: '궁동', ri: '', roadName: '대학로', buildingNumber: '291', fullAddress: '대전광역시 유성구 궁동 대학로 291' },
      { postalCode: '44919', sido: '울산광역시', sigungu: '울주군', eubmyeondong: '온양읍', ri: '회야리', roadName: '회야강변길', buildingNumber: '123', fullAddress: '울산광역시 울주군 온양읍 회야리 회야강변길 123' }
    ];
  }

  async getAutocomplete(query, limit = 10) {
    const mockData = this._getMockPostalData();
    const results = [];
    
    for (const data of mockData) {
      if (data.fullAddress.includes(query) || data.sido.includes(query) || data.sigungu.includes(query)) {
        results.push({
          address: data.fullAddress,
          postalCode: data.postalCode,
          category: 'ADDRESS'
        });
        
        if (results.length >= limit) break;
      }
    }
    
    return results;
  }

  async findByPostalCode(postalCode) {
    const mockData = this._getMockPostalData();
    const results = [];
    
    for (const data of mockData) {
      if (data.postalCode === postalCode) {
        results.push({
          address: data.fullAddress,
          postalCode: data.postalCode,
          sido: data.sido,
          sigungu: data.sigungu
        });
      }
    }
    
    return results;
  }

  async getSuggestions(address) {
    const results = await this.getAutocomplete(address, 5);
    return results;
  }
}

module.exports = OpenPostalCodeService;