// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 설정 파일 가져오기 (Vercel 환경 고려)
let config;
try {
  config = require('../backend/src/config');
} catch (error) {
  console.error('Config loading error:', error);
  // Fallback config for Vercel
  config = {
    postal: { provider: 'juso' },
    jusoApiKey: process.env.JUSO_API_KEY,
    upload: { maxFileSize: 10 * 1024 * 1024 },
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
  };
}

// 라우트 가져오기 (오류 처리 추가)
let addressRoutes, fileRoutes, errorHandler;
try {
  addressRoutes = require('../backend/src/routes/address');
  fileRoutes = require('../backend/src/routes/file');
  errorHandler = require('../backend/src/middleware/errorHandler');
} catch (error) {
  console.error('Routes loading error:', error);
  // 기본 라우트 설정
  addressRoutes = (req, res) => res.status(500).json({ error: 'Address routes not loaded' });
  fileRoutes = (req, res) => res.status(500).json({ error: 'File routes not loaded' });
  errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
}

const app = express();

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    }
  }
}));
app.use(compression());

// CORS 설정
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// API 제한 설정
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p.startsWith('/file/status') || p.startsWith('/file/download') || p === '/health';
  }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 간단한 테스트 라우트
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      JUSO_API_KEY: process.env.JUSO_API_KEY ? 'Set' : 'Not set',
      POSTAL_PROVIDER: process.env.POSTAL_PROVIDER
    }
  });
});

// JUSO API 키 테스트
app.get('/api/test-juso', async (req, res) => {
  try {
    const axios = require('axios');
    
    const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
      params: {
        confmKey: process.env.JUSO_API_KEY,
        currentPage: 1,
        countPerPage: 1,
        keyword: '서울시 강남구',
        resultType: 'json'
      },
      timeout: 10000
    });

    res.json({
      message: 'JUSO API 테스트',
      apiKey: process.env.JUSO_API_KEY ? '설정됨' : '미설정',
      response: response.data
    });

  } catch (error) {
    res.status(500).json({
      message: 'JUSO API 테스트 실패',
      error: error.message,
      apiKey: process.env.JUSO_API_KEY ? '설정됨' : '미설정'
    });
  }
});

// 실제 JUSO API 주소 검색
app.post('/api/address/search', async (req, res) => {
  const { address } = req.body;
  
  if (!address) {
    return res.status(400).json({ 
      success: false, 
      error: '주소를 입력해주세요.' 
    });
  }

  if (address.length < 2) {
    return res.status(400).json({ 
      success: false, 
      error: '주소는 2자 이상 입력해주세요.' 
    });
  }

  try {
    // 간단한 JUSO API 호출로 대체
    const axios = require('axios');
    
    const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
      params: {
        confmKey: process.env.JUSO_API_KEY,
        currentPage: 1,
        countPerPage: 1,
        keyword: address,
        resultType: 'json'
      },
      timeout: 10000
    });

    // 디버깅을 위한 로그
    console.log('JUSO API Full Response:', JSON.stringify(response.data, null, 2));
    
    const results = response.data?.results;
    
    if (!results) {
      throw new Error('JUSO API 응답이 없습니다');
    }
    
    // common 객체에서 errorCode 확인
    const common = results.common;
    if (!common) {
      throw new Error('JUSO API 응답 형식이 잘못되었습니다');
    }
    
    if (common.errorCode !== '0') {
      throw new Error(`JUSO API 오류 ${common.errorCode}: ${common.errorMessage || '알 수 없는 오류'}`);
    }

    const juso = results.juso?.[0];
    if (!juso) {
      return res.json({
        success: false,
        error: '해당 주소의 우편번호를 찾을 수 없습니다.'
      });
    }

    const result = {
      postalCode: juso.zipNo || '',
      fullAddress: juso.roadAddr || juso.jibunAddr || '',
      sido: juso.siNm || '',
      sigungu: juso.sggNm || ''
    };
    
    console.log('Parsed result:', result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Address search error:', error);
    res.status(500).json({
      success: false,
      error: '주소 검색 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 기존 라우트는 사용하지 않음 (위에서 직접 구현함)
// if (typeof addressRoutes === 'function' && addressRoutes.length < 3) {
//   app.use('/api/address', addressRoutes);
// } else {
//   console.log('Using fallback address routes');
// }

// 파일 업로드 라우트 직접 구현
const multer = require('multer');
const upload = multer({ 
  dest: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

app.post('/api/file/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    // 엑셀 파일 검증
    const allowedTypes = ['.xls', '.xlsx'];
    const fileExtension = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: '엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.'
      });
    }

    // 임시 작업 ID 생성
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 엑셀 파일 읽기 시도
    try {
      const XLSX = require('xlsx');
      const fs = require('fs');
      
      console.log('Reading Excel file:', req.file.path);
      
      // 파일 읽기
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일이 비어있습니다.'
        });
      }

      // 헤더 행과 데이터 분리
      const headers = jsonData[0] || [];
      const rows = jsonData.slice(1);

      // 주소 컬럼 찾기
      const addressColumnIndex = headers.findIndex(header => 
        typeof header === 'string' && 
        (header.includes('주소') || header.includes('address') || header.includes('addr'))
      );

      if (addressColumnIndex === -1) {
        return res.status(400).json({
          success: false,
          error: '주소 컬럼을 찾을 수 없습니다. 헤더에 "주소" 또는 "address"가 포함된 컬럼이 필요합니다.'
        });
      }

      // 처리할 데이터 개수 제한 (Vercel 함수 시간 제한 고려)
      const limitedRows = rows.slice(0, 200); // 50개에서 200개로 증가

      console.log(`Excel parsed: ${headers.length} columns, ${limitedRows.length} rows`);

      // 전역 저장소에 임시 저장 (실제 구현에서는 데이터베이스 사용 권장)
      global.excelJobs = global.excelJobs || {};
      global.excelJobs[jobId] = {
        headers,
        rows: limitedRows,
        addressColumnIndex,
        filename: req.file.originalname,
        status: 'uploaded',
        createdAt: new Date()
      };

      // 임시 파일 삭제
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        data: {
          jobId: jobId,
          filename: req.file.originalname,
          totalRows: limitedRows.length,
          headers: headers,
          addressColumn: headers[addressColumnIndex],
          message: `엑셀 파일이 성공적으로 업로드되었습니다. ${limitedRows.length}개 행을 처리합니다.`
        }
      });

    } catch (excelError) {
      console.error('Excel processing error:', excelError);
      
      // 임시 파일 삭제
      if (req.file.path && require('fs').existsSync(req.file.path)) {
        require('fs').unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        error: '엑셀 파일을 읽을 수 없습니다: ' + excelError.message
      });
    }

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: '파일 업로드 중 오류가 발생했습니다.'
    });
  }
});

app.get('/api/file/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({
        success: false,
        error: '작업을 찾을 수 없습니다.'
      });
    }

    const job = global.excelJobs[jobId];
    
    if (job.status === 'uploaded') {
      // 주소 처리 시작
      job.status = 'processing';
      job.processed = 0;
      job.results = [];
      job.errors = [];

      // 백그라운드에서 주소 처리 (실제로는 동기 처리)
      try {
        for (let i = 0; i < job.rows.length; i++) {
          const row = job.rows[i];
          const address = row[job.addressColumnIndex];
          
          if (!address || typeof address !== 'string') {
            job.errors.push({ row: i + 2, error: '주소가 없습니다' });
            continue;
          }

          try {
            // JUSO API 호출
            const axios = require('axios');
            const response = await axios.get('https://business.juso.go.kr/addrlink/addrLinkApi.do', {
              params: {
                confmKey: process.env.JUSO_API_KEY,
                currentPage: 1,
                countPerPage: 1,
                keyword: address,
                resultType: 'json'
              },
              timeout: 5000
            });

            const results = response.data?.results;
            const common = results?.common;
            
            if (common?.errorCode === '0' && results.juso?.[0]) {
              const juso = results.juso[0];
              job.results.push({
                row: i + 2,
                originalAddress: address,
                postalCode: juso.zipNo || '',
                fullAddress: juso.roadAddr || juso.jibunAddr || '',
                sido: juso.siNm || '',
                sigungu: juso.sggNm || ''
              });
            } else {
              job.errors.push({ 
                row: i + 2, 
                address: address,
                error: '우편번호를 찾을 수 없습니다' 
              });
            }
          } catch (apiError) {
            job.errors.push({ 
              row: i + 2, 
              address: address,
              error: 'API 호출 실패: ' + apiError.message 
            });
          }

          job.processed = i + 1;
          
          // API 호출 제한을 위한 지연 (더 짧게)
          if (i < job.rows.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50)); // 100ms에서 50ms로 단축
          }
        }

        job.status = 'completed';
        job.progress = 100;
        
      } catch (processingError) {
        job.status = 'error';
        job.error = processingError.message;
      }
    }

    res.json({
      success: true,
      data: {
        status: job.status,
        progress: Math.round((job.processed / job.rows.length) * 100),
        processed: job.processed || 0,
        total: job.rows.length,
        errors: job.errors || [],
        results: job.results || [],
        message: job.status === 'completed' ? 
          `처리 완료: ${job.results?.length || 0}개 성공, ${job.errors?.length || 0}개 실패` :
          job.status === 'processing' ? '주소 검색 중...' : '대기 중'
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: '상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// 다운로드 기능
app.get('/api/file/download/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!global.excelJobs || !global.excelJobs[jobId]) {
      return res.status(404).json({
        success: false,
        error: '작업을 찾을 수 없습니다.'
      });
    }

    const job = global.excelJobs[jobId];
    
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: '작업이 완료되지 않았습니다.'
      });
    }

    try {
      // 엑셀 파일 생성
      const XLSX = require('xlsx');
      
      console.log('Generating Excel file for jobId:', jobId);
      console.log('Job data:', { 
        headersLength: job.headers?.length, 
        rowsLength: job.rows?.length, 
        resultsLength: job.results?.length 
      });
      
      // 안전한 헤더 처리
      const safeHeaders = Array.isArray(job.headers) ? job.headers : [];
      
      // 결과 데이터를 엑셀 형식으로 변환
      const resultData = [
        [...safeHeaders, '우편번호', '전체주소', '시도', '시군구'] // 헤더에 새 컬럼 추가
      ];

      // 원본 데이터에 우편번호 정보 추가
      if (Array.isArray(job.rows)) {
        job.rows.forEach((row, index) => {
          const result = job.results?.find(r => r.row === index + 2);
          const newRow = Array.isArray(row) ? [...row] : Object.values(row || {}); // 배열이 아닌 경우 대응
          
          // 헤더와 행의 길이 맞춤
          while (newRow.length < safeHeaders.length) {
            newRow.push('');
          }
          
          if (result) {
            newRow.push(result.postalCode || '', result.fullAddress || '', result.sido || '', result.sigungu || '');
          } else {
            newRow.push('', '', '', ''); // 실패한 경우 빈 값
          }
          
          resultData.push(newRow);
        });
      }

      console.log('Result data rows:', resultData.length);

      // 워크북 생성
      const ws = XLSX.utils.aoa_to_sheet(resultData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');

      // 파일을 버퍼로 생성
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      console.log('Excel buffer size:', buffer.length);

      // 다운로드 응답
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="postal_result_${new Date().getTime()}.xlsx"`);
      res.send(buffer);

    } catch (excelGenError) {
      console.error('Excel generation error:', excelGenError);
      return res.status(500).json({
        success: false,
        error: '엑셀 파일 생성 중 오류가 발생했습니다: ' + excelGenError.message
      });
    }

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: '다운로드 중 오류가 발생했습니다.'
    });
  }
});

// 기존 fileRoutes는 사용하지 않음
// if (typeof fileRoutes === 'function' && fileRoutes.length < 3) {
//   app.use('/api/file', fileRoutes);
// } else {
//   console.log('Using fallback file routes');
// }

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `파일 크기가 너무 큽니다. 최대 10MB 입니다.` });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
app.use(errorHandler);

// 404 핸들러
app.use('*', (req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

module.exports = app;