const XLSX = require('xlsx');

// 처리된 파일 확인
const workbook = XLSX.readFile('processed_result.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('처리된 결과:');
data.forEach((row, index) => {
  console.log(`행 ${index + 1}:`, row);
});