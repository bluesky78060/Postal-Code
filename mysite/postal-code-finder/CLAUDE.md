# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (in `backend/` directory)
```bash
npm install              # Install dependencies
npm run dev             # Start development server with nodemon (auto-reload)
npm start               # Start production server
npm test                # Run Jest tests (currently no tests configured)
```

### Server Configuration
- **Development**: Server runs on port 3001 by default (configurable via `PORT` env var)
- **Production**: Use `PORT=3001 npm start` to specify port
- **Environment**: Copy `.env` file and configure `KAKAO_API_KEY`

## Architecture Overview

This is a postal code lookup system that processes Excel files and provides real-time address search functionality for Korean addresses.

### Core Architecture
- **Backend**: Node.js/Express API server with file upload processing
- **Frontend**: Static HTML/CSS/JS served by Express (in `frontend/public/`)
- **External API**: Kakao Maps API for address lookup (with Mock fallback system)

### Key Architectural Patterns

**1. Service Layer Architecture**
- `controllers/` handle HTTP requests/responses
- `services/` contain business logic (PostalCodeService, ExcelService)
- `utils/` contain shared utilities (addressParser, logger)
- Configuration centralized in `config/index.js`

**2. Job Processing System**
- In-memory job tracking with automatic cleanup (24-hour retention)
- Asynchronous Excel file processing with real-time progress updates
- Background cleanup scheduler runs hourly

**3. Mock Data Fallback**
- When Kakao API fails (common issue: service disabled), automatically falls back to Mock data
- Mock data includes realistic postal codes for Seoul, Busan, Daegu
- Ensures functionality works even without valid API key

**4. Middleware Stack**
- Request validation using express-validator
- CORS configuration for multiple origins
- Rate limiting, helmet security, compression
- Structured error handling with environment-aware responses

### Critical Implementation Details

**File Processing Flow**:
1. Multer handles file upload with validation (.xls/.xlsx, 10MB limit)
2. XLSX library parses Excel, finds address column automatically
3. Batch processes addresses with API rate limiting (10 requests/second for Kakao)
4. Generates new Excel file with postal codes added
5. Provides download link and cleanup after 24 hours

**API Integration Strategy**:
- Primary: Kakao Maps API for real address lookup
- Fallback: Mock data system when API unavailable
- Rate limiting to prevent API quota exhaustion
- Graceful error handling with user-friendly messages

**Memory Management**:
- Jobs stored in Map with automatic cleanup
- Files automatically deleted after processing
- No persistent database - stateless design

## Environment Configuration

Required environment variables in `backend/.env`:
```bash
KAKAO_API_KEY=your_kakao_rest_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3001
```

Optional configuration:
```bash
NODE_ENV=development
MAX_FILE_SIZE=10485760
RATE_LIMIT_MAX=100
JOB_CLEANUP_INTERVAL=3600000
JOB_RETENTION_TIME=86400000
```

## API Endpoints

### Address Search
- `POST /api/address/search` - Single address lookup
- `GET /api/address/autocomplete?q=query` - Address suggestions  
- `POST /api/address/batch` - Multiple address lookup
- `GET /api/address/postal/:postalCode` - Reverse postal code lookup

### File Processing
- `POST /api/file/upload` - Excel file upload (multipart/form-data)
- `GET /api/file/status/:jobId` - Check processing status
- `GET /api/file/download/:fileId` - Download processed file
- `GET /api/file/list` - List all jobs
- `DELETE /api/file/:fileId` - Delete job and file

## Common Issues & Solutions

**Kakao API Service Disabled Error**:
- System automatically falls back to Mock data
- Check console logs for "⚠️ Kakao API 서비스 비활성화 - Mock 데이터로 대체"
- Mock system provides realistic test data for development

**CORS Issues**:
- Frontend must match configured origins in CORS middleware
- Currently configured for localhost:3001 and 127.0.0.1:3001
- Update `config.frontendUrl` and CORS origins array if needed

**File Upload Validation**:
- Excel files must have recognizable address column headers
- Supported patterns: '주소', '주소지', 'address', 'addr', etc.
- Maximum 1000 rows, 10MB file size limit

## Development Notes

- Server serves static files from `frontend/public/` at root path
- All API routes prefixed with `/api/`
- Structured logging with request IDs for debugging
- Input validation on all endpoints with detailed error responses
- Job cleanup runs automatically - no manual intervention needed
