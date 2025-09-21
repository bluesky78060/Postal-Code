const XLSX = require('xlsx');

// 테스트용 엑셀 파일 생성
const data = [
  ['주소'],
  ['서울특별시 강남구 테헤란로 123'],
  ['부산광역시 해운대구 센텀로 456'],
  ['대구광역시 중구 중앙대로 789']
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

XLSX.writeFile(wb, 'test.xlsx');
console.log('test.xlsx 파일이 생성되었습니다.');