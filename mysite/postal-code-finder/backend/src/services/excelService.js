class ExcelService {
  // 주소 컬럼 찾기
  findAddressColumn(headers) {
    const addressPatterns = [
      '주소', '주소지', '거주지', '소재지', '위치',
      'address', 'addr', 'location', 'place',
      'Address', 'ADDR', 'LOCATION', 'PLACE'
    ];

    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).trim();
      
      if (addressPatterns.some(pattern => 
        header.includes(pattern) || pattern.includes(header)
      )) {
        return i;
      }
    }

    return -1; // 주소 컬럼을 찾지 못함
  }

  // 우편번호 컬럼 찾기
  findPostalCodeColumn(headers) {
    const postalPatterns = [
      '우편번호', '우편', '우코드', 'postal', 'zip', 'postcode',
      'POSTAL', 'ZIP', 'POSTCODE', 'postal_code', 'zip_code'
    ];

    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).trim();
      
      if (postalPatterns.some(pattern => 
        header.includes(pattern) || pattern.includes(header)
      )) {
        return i;
      }
    }

    return -1;
  }

  // 엑셀 데이터 유효성 검사
  validateExcelData(data) {
    const errors = [];

    if (!data || data.length === 0) {
      errors.push('엑셀 파일이 비어있습니다.');
      return { isValid: false, errors };
    }

    if (data.length < 2) {
      errors.push('헤더 행을 제외한 데이터가 없습니다.');
      return { isValid: false, errors };
    }

    const headers = data[0];
    if (!headers || headers.length === 0) {
      errors.push('헤더 행이 없습니다.');
      return { isValid: false, errors };
    }

    // 주소 컬럼 확인
    const addressColumnIndex = this.findAddressColumn(headers);
    if (addressColumnIndex === -1) {
      errors.push('주소 컬럼을 찾을 수 없습니다. (주소, address 등의 컬럼명을 사용해주세요)');
      return { isValid: false, errors };
    }

    // 데이터 행 확인
    const dataRows = data.slice(1);
    const validRows = dataRows.filter(row => 
      row && row[addressColumnIndex] && 
      String(row[addressColumnIndex]).trim().length > 0
    );

    if (validRows.length === 0) {
      errors.push('유효한 주소 데이터가 없습니다.');
      return { isValid: false, errors };
    }

    if (validRows.length > 1000) {
      errors.push('한 번에 처리할 수 있는 최대 행 수(1000개)를 초과했습니다.');
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      addressColumnIndex,
      totalRows: dataRows.length,
      validRows: validRows.length,
      headers
    };
  }

  // 진행률 계산
  calculateProgress(processed, total) {
    if (total === 0) return 0;
    return Math.round((processed / total) * 100);
  }

  // 안전한 셀 값 추출
  getCellValue(cell) {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'object' && cell.v !== undefined) {
      return String(cell.v).trim();
    }
    return String(cell).trim();
  }

  // 중복 데이터 제거
  removeDuplicates(data) {
    if (!data || data.length < 2) return data;

    const headers = data[0];
    const dataRows = data.slice(1);
    const addressColumnIndex = this.findAddressColumn(headers);
    
    if (addressColumnIndex === -1) {
      return data; // 주소 컬럼이 없으면 원본 반환
    }

    const seenAddresses = new Set();
    const uniqueRows = [];
    let duplicateCount = 0;

    dataRows.forEach(row => {
      if (!row || !row[addressColumnIndex]) return;
      
      const address = String(row[addressColumnIndex]).trim().toLowerCase();
      
      if (address && !seenAddresses.has(address)) {
        seenAddresses.add(address);
        uniqueRows.push(row);
      } else if (address) {
        duplicateCount++;
      }
    });

    return {
      data: [headers, ...uniqueRows],
      duplicateCount,
      originalCount: dataRows.length,
      uniqueCount: uniqueRows.length
    };
  }

  // 결과 통계 생성
  generateStatistics(results, errors) {
    const total = results.length + errors.length;
    const successful = results.length;
    const failed = errors.length;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    return {
      total,
      successful,
      failed,
      successRate,
      errorTypes: this.categorizeErrors(errors)
    };
  }

  // 오류 분류
  categorizeErrors(errors) {
    const categories = {
      notFound: 0,      // 주소를 찾을 수 없음
      invalid: 0,       // 잘못된 주소 형식
      apiError: 0,      // API 오류
      other: 0          // 기타 오류
    };

    errors.forEach(error => {
      const message = error.error.toLowerCase();
      
      if (message.includes('찾을 수 없') || message.includes('not found')) {
        categories.notFound++;
      } else if (message.includes('유효하지 않') || message.includes('invalid')) {
        categories.invalid++;
      } else if (message.includes('api') || message.includes('호출')) {
        categories.apiError++;
      } else {
        categories.other++;
      }
    });

    return categories;
  }
}

module.exports = new ExcelService();