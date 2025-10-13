const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');
const excelService = require('../services/excelService');
const postalCodeService = require('../services/postalCodeService');
const addressParser = require('../utils/addressParser');
const config = require('../config');

// 진행 중인 작업 저장소 (실제 서비스에서는 Redis 등 사용)
const processingJobs = new Map();
const JOB_SNAPSHOT_DIR = process.env.JOB_CACHE_DIR || path.join('/tmp', 'postal-code-jobs');

async function ensureJobSnapshotDir() {
  try {
    await fs.mkdir(JOB_SNAPSHOT_DIR, { recursive: true });
  } catch (_) {}
}
ensureJobSnapshotDir();

async function persistJobSnapshot(jobId, job) {
  try {
    await ensureJobSnapshotDir();
    const file = path.join(JOB_SNAPSHOT_DIR, `${jobId}.json`);
    await fs.writeFile(file, JSON.stringify(job), 'utf8');
  } catch (err) {
    console.warn('Failed to persist job snapshot', jobId, err?.message || err);
  }
}

async function loadJobSnapshot(jobId) {
  try {
    const file = path.join(JOB_SNAPSHOT_DIR, `${jobId}.json`);
    const content = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(content);
    processingJobs.set(jobId, parsed);
    return parsed;
  } catch (_) {
    return null;
  }
}

async function removeJobSnapshot(jobId) {
  try {
    const file = path.join(JOB_SNAPSHOT_DIR, `${jobId}.json`);
    await fs.unlink(file);
  } catch (_) {}
}

const STEP_TEMPLATE = [
  { key: 'upload', label: '파일 업로드', status: 'done' },
  { key: 'dedupe', label: '중복 제거', status: 'pending' },
  { key: 'lookup', label: '우편번호 조회', status: 'pending' },
  { key: 'export', label: '엑셀 생성', status: 'pending' }
];

const cloneSteps = () => STEP_TEMPLATE.map(step => ({ ...step }));

const updateJob = (jobId, updater) => {
  const prev = processingJobs.get(jobId) || {};
  const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
  processingJobs.set(jobId, next);
  persistJobSnapshot(jobId, next);
  return next;
};

const setStepStatus = (jobId, key, status) => {
  updateJob(jobId, (prev) => {
    const steps = (prev.steps || cloneSteps()).map(step => (
      step.key === key ? { ...step, status } : step
    ));
    return { ...prev, steps };
  });
};

// 작업 정리를 위한 설정 (환경설정 사용)
const JOB_CLEANUP_INTERVAL = Number(config?.jobs?.cleanupInterval) || 60 * 60 * 1000;
const JOB_RETENTION_TIME = Number(config?.jobs?.retentionTime) || 24 * 60 * 60 * 1000;

// 주기적으로 완료된 작업 정리
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of processingJobs.entries()) {
    if (job.status === 'completed' || job.status === 'error') {
      const timeSinceEnd = now - (job.endTime ? new Date(job.endTime).getTime() : now);
      if (timeSinceEnd > JOB_RETENTION_TIME) {
        // 파일도 함께 삭제
        if (job.outputPath) {
          require('fs').promises.unlink(job.outputPath).catch(console.warn);
        }
        processingJobs.delete(jobId);
        removeJobSnapshot(jobId);
        console.log(`Cleaned up old job: ${jobId}`);
      }
    }
  }
}, JOB_CLEANUP_INTERVAL);

class FileController {
  // 엑셀 파일 업로드 및 처리
  uploadAndProcess = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: '파일이 업로드되지 않았습니다.'
        });
      }
      
      const filePath = req.file.path;
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // 작업 상태 초기화
      updateJob(jobId, {
        status: 'processing',
        progress: 0,
        total: 0,
        processed: 0,
        errors: [],
        startTime: new Date(),
        originalFilename: req.file.originalname,
        steps: cloneSteps(),
        truncatedCount: 0,
        maxRows: Number(config?.upload?.maxRows) || 300
      });
      
      // 비동기로 파일 처리 시작
      this.processExcelFile(filePath, jobId).catch(error => {
        console.error('파일 처리 오류:', error);
        setStepStatus(jobId, 'dedupe', 'error');
        setStepStatus(jobId, 'lookup', 'error');
        setStepStatus(jobId, 'export', 'error');
        updateJob(jobId, {
          status: 'error',
          error: String(error?.message || error),
          endTime: new Date()
        });
      });
      
      res.json({
        success: true,
        data: {
          jobId,
          message: '파일 업로드 완료. 처리를 시작합니다.',
          statusUrl: `/api/file/status/${jobId}`
        }
      });
      
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      next(error);
    }
  }
  
  // 엑셀 파일 처리 (비동기)
  processExcelFile = async (filePath, jobId) => {
    try {
      let job = processingJobs.get(jobId);
      if (!job) {
        job = await loadJobSnapshot(jobId);
      }
      
      // 엑셀 파일 읽기
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length === 0) {
        throw new Error('엑셀 파일이 비어있습니다.');
      }
      
      // 중복 데이터 제거
      setStepStatus(jobId, 'dedupe', 'in-progress');
      const deduplicateResult = excelService.removeDuplicates(data);
      const processedData = data; // 원본 그대로 사용하여 중복 행도 유지
      setStepStatus(jobId, 'dedupe', 'done');
      
      // 헤더 찾기
      const headers = processedData[0];
      const addressColumnIndex = excelService.findAddressColumn(headers);
      
      if (addressColumnIndex === -1) {
        throw new Error('주소 컬럼을 찾을 수 없습니다. (주소, 주소지, address 등의 컬럼명을 사용해주세요)');
      }
      
      const allRows = processedData.slice(1).filter(row => row[addressColumnIndex]); // 빈 주소 행 제외
      let rows = allRows;
      const maxRows = Number(config?.upload?.maxRows) || 300;
      let truncatedCount = 0;
      if (rows.length > maxRows) {
        truncatedCount = rows.length - maxRows;
        rows = rows.slice(0, maxRows);
      }
      const total = rows.length;
      
      // 중복 제거 정보 로그
      if (deduplicateResult.duplicateCount > 0) {
        console.log(`중복 제거 완료: ${deduplicateResult.duplicateCount}개 중복 행 제거 (${deduplicateResult.originalCount} → ${deduplicateResult.uniqueCount})`);
      }
      
      const normalizeHeader = (header) => String(header || '').toLowerCase().replace(/[\s_\/]/g, '');
      const shouldRemoveHeader = (header) => {
        const norm = normalizeHeader(header);
        if (!norm) return false;
        const removalPatterns = [
          '시도', '시군구', '시도명', '시군구명', '광역시', '특별시', '특별자치시', '특별자치도',
          'sido', 'sigungu', 'metropolitan', 'province', '행정구역', '행정동'
        ];
        return removalPatterns.some(pattern => norm.includes(pattern));
      };
      const detailKeywords = ['상세주소', '상세', '세부주소', '동호', '동호수', '호수', '호실', '아파트상세'];
      const detailColumnIndex = headers.findIndex(header => {
        const norm = normalizeHeader(header);
        return detailKeywords.some(key => norm === key || norm.includes(key));
      });

      // 동/호 개별 컬럼 식별 (상세주소가 없는 경우 보조로 사용)
      const dongKeywords = ['동', 'dong'];
      const hoKeywords = ['호', '호수', 'hosu', 'unit', 'room'];
      const findIndexByKeywords = (keys) => headers.findIndex(header => {
        const norm = normalizeHeader(header);
        return keys.some(k => norm === k || norm.endsWith(k));
      });
      const dongColumnIndex = findIndexByKeywords(dongKeywords);
      const hoColumnIndex = findIndexByKeywords(hoKeywords);

      // 최종 헤더 재구성: 관리 컬럼과 중복 필드 제거 후 [베이스..., (도로명주소), 상세주소, 우편번호]
      const isRoadHeader = (header) => {
        const n = normalizeHeader(header);
        return n.includes('도로명주소') || n.includes('road') || n.includes('fulladdress') || n.includes('전체주소');
      };
      const isDetailHeader = (header) => {
        const n = normalizeHeader(header);
        return n.includes('상세주소') || n.includes('세부주소') || n.includes('동호') || n.includes('호수') || n.includes('호실');
      };
      const isPostalHeader = (header) => {
        const n = normalizeHeader(header);
        return n.includes('우편번호') || n.includes('postal') || n.includes('zip');
      };
      const baseHeaders = headers.filter(h => !shouldRemoveHeader(h) && !isRoadHeader(h) && !isDetailHeader(h) && !isPostalHeader(h));
      const headersOut = [...baseHeaders];
      if (config?.output?.includeRoadAddress) headersOut.push('도로명주소');
      headersOut.push('상세주소');
      headersOut.push('우편번호');

      updateJob(jobId, {
        total,
        truncatedCount,
        addressColumnIndex,
        headers: headersOut,
        totalOriginal: allRows.length
      });
      
      const results = [];
      const errors = [];
      
      // 각 행 처리
      setStepStatus(jobId, 'lookup', 'in-progress');
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const address = row[addressColumnIndex];
        
        if (!address || typeof address !== 'string') {
          errors.push({
            row: i + 2, // 엑셀 행 번호 (헤더 + 1)
            address: address || '',
            error: '유효하지 않은 주소입니다.'
          });
          continue;
        }
        
        const { main: splitMainAddress, detail: splitDetail } = addressParser.splitAddressDetail(address);
        const mainAddress = splitMainAddress || (row[addressColumnIndex] ?? '');
        const derivedDetail = splitDetail;
        // 주소 컬럼은 메인 주소만 사용 (상세는 별도 컬럼)
        const enrichedAddress = mainAddress;

        // 베이스 데이터: 기존 컬럼 값 복사 (주소 컬럼은 enrichedAddress 사용)
        const baseRow = baseHeaders.map(h => {
          const idx = headers.indexOf(h);
          if (idx === addressColumnIndex) return enrichedAddress || (row[idx] ?? '');
          return idx >= 0 ? (row[idx] ?? '') : '';
        });
        try {
          const normalizedAddress = addressParser.normalizeAddress(address);
          const result = await postalCodeService.findPostalCode(normalizedAddress);
          
          if (result) {
            // 상세주소 계산: 기존 상세 > 파생 상세 > 동/호 조합
            let detailOut = '';
            if (detailColumnIndex !== -1) {
              const existing = row[detailColumnIndex];
              const sanitized = addressParser.splitAddressDetail(String(existing || '')).detail;
              detailOut = (sanitized && String(sanitized).trim()) ? String(sanitized).trim() : '';
            }
            if (!detailOut) detailOut = derivedDetail || '';
            if (!detailOut) {
              const parts = [];
              const dv = (typeof dongColumnIndex === 'number' && dongColumnIndex >= 0) ? (row[dongColumnIndex] ?? '') : '';
              const hv = (typeof hoColumnIndex === 'number' && hoColumnIndex >= 0) ? (row[hoColumnIndex] ?? '') : '';
              if (dv && String(dv).trim()) parts.push(`${String(dv).trim()}동`);
              if (hv && String(hv).trim()) parts.push(`${String(hv).trim()}호`);
              if (parts.length) detailOut = parts.join(' ');
            }

            const extras = [];
            if (config?.output?.includeRoadAddress) extras.push(result.fullAddress || '');
            extras.push(detailOut || '');
            extras.push(result.postalCode || '');
            results.push([...baseRow, ...extras]);
          } else {
            const extras = [];
            if (config?.output?.includeRoadAddress) extras.push('');
            extras.push('');
            extras.push('');
            results.push([...baseRow, ...extras]); // 빈 값 삽입
            errors.push({
              row: i + 2,
              address: address,
              error: '우편번호를 찾을 수 없습니다.'
            });
          }
        } catch (error) {
          const extras = [];
          if (config?.output?.includeRoadAddress) extras.push('');
          extras.push('');
          extras.push('');
          results.push([...baseRow, ...extras]); // 오류 시 빈 값
          errors.push({
            row: i + 2,
            address: address,
            error: error.message
          });
        }
        
        // 진행 상황 업데이트
        const processed = i + 1;
        updateJob(jobId, (prev2) => ({
          ...prev2,
          progress: Math.round((processed / total) * 100),
          processed
        }));
        
        // API 호출 제한 방지를 위한 대기 (Kakao API는 초당 10회 제한)
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (i > 0 && i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // 새 엑셀 파일 생성
      setStepStatus(jobId, 'lookup', 'done');
      setStepStatus(jobId, 'export', 'in-progress');
      const newWorkbook = XLSX.utils.book_new();
      const newWorksheet = XLSX.utils.aoa_to_sheet([
        processingJobs.get(jobId).headers,
        ...results
      ]);
      
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Sheet1');
      
      // 파일 저장
      const outputFilename = `processed_${Date.now()}_${path.basename(filePath)}`;
      const outputPath = path.join(path.dirname(filePath), outputFilename);
      XLSX.writeFile(newWorkbook, outputPath);
      
      // 작업 완료
      const finalJobState = processingJobs.get(jobId) || {};
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        processed: total,
        outputPath,
        outputFilename,
        errors,
        duplicateInfo: deduplicateResult.duplicateCount > 0 ? {
          originalCount: deduplicateResult.originalCount,
          uniqueCount: deduplicateResult.uniqueCount,
          duplicateCount: deduplicateResult.duplicateCount
        } : null,
        endTime: new Date()
      });
      setStepStatus(jobId, 'export', 'done');
      
      // 원본 파일 삭제
      await fs.unlink(filePath);
      
    } catch (error) {
      console.error('파일 처리 중 오류 발생:', error);
      setStepStatus(jobId, 'dedupe', 'error');
      setStepStatus(jobId, 'lookup', 'error');
      setStepStatus(jobId, 'export', 'error');
      updateJob(jobId, {
        status: 'error',
        error: String(error?.message || error),
        endTime: new Date()
      });
      
      // 오류 시 원본 파일 삭제
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('원본 파일 삭제 오류:', unlinkError);
      }
    }
  }
  
  // 처리 상태 확인
  getProcessingStatus = async (req, res, next) => {
    try {
      const { jobId } = req.params;
      
      const job = processingJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({
          error: '작업을 찾을 수 없습니다.'
        });
      }
      
      const response = {
        jobId,
        status: job.status,
        progress: job.progress,
        processed: job.processed,
        total: job.total,
        startTime: job.startTime,
        truncatedCount: job.truncatedCount || 0,
        maxRows: job.maxRows || (Number(config?.upload?.maxRows) || 300),
        totalOriginal: job.totalOriginal || job.total || 0,
        steps: job.steps || cloneSteps()
      };

      if (job.status === 'processing' && job.startTime && job.processed && job.total) {
        const start = new Date(job.startTime).getTime();
        const elapsed = Date.now() - start;
        if (elapsed > 0 && job.processed > 0 && job.total > job.processed) {
          const ratePerItem = elapsed / job.processed;
          const remaining = Math.max(job.total - job.processed, 0) * ratePerItem;
          if (Number.isFinite(remaining) && remaining >= 0) {
            response.estimatedRemainingMs = Math.round(remaining);
          }
        }
      } else if (job.status === 'completed') {
        response.estimatedRemainingMs = 0;
      }
      
      if (job.status === 'completed') {
        response.downloadUrl = `/api/file/download/${jobId}`;
        response.endTime = job.endTime;
        response.errors = job.errors;
        if (job.duplicateInfo) {
          response.duplicateInfo = job.duplicateInfo;
        }
      }
      
      if (job.status === 'error') {
        response.error = job.error;
        response.endTime = job.endTime;
      }
      
      res.json({
        success: true,
        data: response
      });
      
    } catch (error) {
      console.error('상태 확인 오류:', error);
      next(error);
    }
  }
  
  // 처리된 파일 다운로드
  downloadFile = async (req, res, next) => {
    try {
      const { fileId } = req.params;
      
      const job = processingJobs.get(fileId);
      if (!job) {
        await loadJobSnapshot(fileId);
      }
      const refreshedJob = processingJobs.get(fileId);
      
      if (!refreshedJob || refreshedJob.status !== 'completed') {
        return res.status(404).json({
          error: '다운로드할 파일을 찾을 수 없습니다.'
        });
      }
      
      const filePath = refreshedJob.outputPath;
      
      // 파일 존재 확인
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({
          error: '파일이 삭제되었거나 찾을 수 없습니다.'
        });
      }
      
      res.download(filePath, refreshedJob.outputFilename, (error) => {
        if (error) {
          console.error('파일 다운로드 오류:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: '파일 다운로드 중 오류가 발생했습니다.'
            });
          }
        }
      });
      
    } catch (error) {
      console.error('다운로드 오류:', error);
      next(error);
    }
  }

  // 파일 목록 조회
  getFileList = async (req, res, next) => {
    try {
      const jobs = Array.from(processingJobs.entries()).map(([jobId, job]) => ({
        jobId,
        originalFilename: job.originalFilename,
        status: job.status,
        progress: job.progress,
        startTime: job.startTime,
        endTime: job.endTime,
        total: job.total,
        processed: job.processed
      }));

      res.json({
        success: true,
        data: jobs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      });

    } catch (error) {
      console.error('파일 목록 조회 오류:', error);
      next(error);
    }
  }

  // 파일 삭제
  deleteFile = async (req, res, next) => {
    try {
      const { fileId } = req.params;
      
      const job = processingJobs.get(fileId);
      
      if (!job) {
        return res.status(404).json({
          error: '파일을 찾을 수 없습니다.'
        });
      }

      // 파일 삭제
      if (job.outputPath) {
        try {
          await fs.unlink(job.outputPath);
        } catch (error) {
          console.warn('파일 삭제 실패:', error.message);
        }
      }

      // 메모리에서 작업 정보 삭제
      processingJobs.delete(fileId);
      await removeJobSnapshot(fileId);

      res.json({
        success: true,
        message: '파일이 삭제되었습니다.'
      });

    } catch (error) {
      console.error('파일 삭제 오류:', error);
      next(error);
    }
  }

  // 라벨 데이터를 JSON으로 반환
  getLabelData = async (req, res, next) => {
    try {
      const { jobId } = req.params;
      
      const job = processingJobs.get(jobId);
      
      if (!job || job.status !== 'completed') {
        return res.status(404).json({
          error: '완료된 작업을 찾을 수 없습니다.'
        });
      }

      if (!job.outputPath) {
        return res.status(404).json({
          error: '처리된 파일이 없습니다.'
        });
      }

      try {
        // 엑셀 파일 읽기
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(job.outputPath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length === 0) {
          return res.status(400).json({
            error: '엑셀 파일이 비어있습니다.'
          });
        }

        // 헤더와 데이터 분리
        const headers = data[0];
        const rows = data.slice(1);

        // JSON 형태로 변환
        const jsonData = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        }).filter(row => {
          // 빈 행 제거
          return Object.values(row).some(value => value && String(value).trim());
        });

        res.json({
          success: true,
          data: {
            headers,
            rows: jsonData,
            total: jsonData.length
          }
        });

      } catch (error) {
        console.error('엑셀 파일 읽기 오류:', error);
        res.status(500).json({
          error: '파일 처리 중 오류가 발생했습니다.'
        });
      }

    } catch (error) {
      console.error('라벨 데이터 조회 오류:', error);
      next(error);
    }
  }
}

module.exports = new FileController();
