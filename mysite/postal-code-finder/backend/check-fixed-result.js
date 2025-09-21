const XLSX = require('xlsx');

// 수정된 처리 결과 확인
const workbook = XLSX.readFile('result-fixed.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('✅ 수정된 결과:');
data.forEach((row, index) => {
  console.log(`행 ${index + 1}:`, row);
});