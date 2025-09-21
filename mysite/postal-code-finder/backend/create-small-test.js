const XLSX = require('xlsx');

// 테스트용 엑셀 파일 생성 (우리가 추가한 주소들)
const data = [
  ['주소'],
  ['경상북도 봉화군 봉화읍 문단리 699-3'],
  ['경상북도 봉화군 봉화읍 문단리 748-1'],
  ['경상북도 봉화군 봉화읍 화천리 432'],
  ['경상북도 영주시 가흥동 1796'],
  ['서울특별시 강남구 테헤란로 123']
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

XLSX.writeFile(wb, 'small-test.xlsx');
console.log('small-test.xlsx 파일이 생성되었습니다.');