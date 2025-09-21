const XLSX = require('xlsx');

// Open API 결과 확인
const workbook = XLSX.readFile('result-open-api.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('🎉 Open API 결과:');
data.forEach((row, index) => {
  console.log(`행 ${index + 1}:`, row);
});