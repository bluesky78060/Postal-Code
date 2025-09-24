# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development (in `backend/` directory)
```bash
npm install              # Install dependencies
npm run dev             # Start development server with nodemon (auto-reload)
npm start               # Start production server
npm test                # Run Jest tests (currently no tests configured)
npm run build-win       # Build Windows executable
npm run build-all       # Build executables for all platforms
```

### Vercel Deployment
```bash
npm install              # Install root dependencies for Vercel
vercel dev              # Local development with Vercel serverless functions
vercel                  # Deploy to production
```

### HWPX Label Testing
```bash
# After making changes to api/hwpx.js, test HWPX generation:
cd backend
node create-test-excel.js        # Generate test Excel files
node check-result.js             # Verify Excel processing results
```

### Environment Configuration
- **Local Development**: Server runs on port 3005 by default (configurable via `PORT` env var)
- **Required Variables**: `JUSO_API_KEY` (Korean postal service API key)
- **Backend Environment**: Copy `backend/.env` file and configure environment variables
- **Vercel Environment**: Set environment variables in Vercel dashboard

## Architecture Overview

This is a postal code lookup system that processes Excel files and provides real-time address search functionality for Korean addresses.

### Core Architecture: Dual Deployment Pattern
- **Local Development**: Traditional Node.js/Express server (`backend/src/app.js`)
- **Production Deployment**: Vercel serverless functions (`api/index.js`)
- **Frontend**: Static HTML/CSS/JS served from `public/` directory
- **External API**: JUSO (Korean postal service) API for address lookup

### Key Architectural Patterns

**1. Service Layer Architecture**
- `controllers/` handle HTTP requests/responses
- `services/` contain business logic (PostalCodeService, ExcelService)
- `utils/` contain shared utilities (addressParser, logger)
- Configuration centralized in `config/index.js`

**2. Serverless vs Traditional Processing**
- **Local Backend**: Uses job processing system with in-memory tracking and status polling
- **Vercel Serverless**: Immediate processing with direct Excel file download response
- **File Processing**: Excel files processed with smart column detection and duplicate removal
- **Content-Type Handling**: Frontend checks response headers to handle both JSON and Excel responses

**3. Excel Processing Intelligence**
- **Smart Column Detection**: Prevents duplicate columns (주소, 시도, 시군구, 우편번호, 도로명주소)
- **Automatic Deduplication**: Removes duplicate address rows using normalized comparison
- **Column Recognition**: Supports various address column headers in Korean and English
- **Robust Error Handling**: Graceful fallback when address resolution fails

**4. Middleware Stack**
- Request validation using express-validator
- CORS configuration for multiple origins
- Rate limiting, helmet security, compression
- Structured error handling with environment-aware responses

### Critical Implementation Details

**File Processing Flow**:
1. Multer handles file upload with validation (.xls/.xlsx, 10MB limit)
2. XLSX library parses Excel, finds address column automatically
3. Batch processes addresses with API rate limiting (50ms between requests) to prevent quota exhaustion
4. Generates new Excel file with postal codes added
5. Provides download link and cleanup after 24 hours

**HWPX Label Generation**:
- **Purpose**: Korean word processor format for printing 2x9 address labels
- **Template Location**: `docs/sample_hwpx/` contains HWPX format templates
- **Text Alignment**: Uses `lineseg` horzpos positioning for right-alignment (`horzpos="20000"`)
- **Structure**: ZIP file containing XML files (header.xml, section0.xml, content.hpf)
- **File Reference**: `api/hwpx.js:125-158` contains the main HWPX generation logic

**API Integration Strategy**:
- **Primary**: JUSO API (Korean postal service) for accurate address lookup
- **Rate Limiting**: Built-in delays (50ms between requests) to prevent quota exhaustion
- **Smart Parsing**: Uses addressParser utility for address normalization and component extraction
- **Error Handling**: Graceful degradation with detailed error messages for failed lookups

**Memory Management**:
- Jobs stored in Map with automatic cleanup
- Files automatically deleted after processing
- No persistent database - stateless design

## Environment Configuration

Required environment variables in `backend/.env`:
```bash
JUSO_API_KEY=your_juso_api_key_here
PORT=3005
FRONTEND_URL=http://localhost:3005
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

### HWPX Label Generation
- `POST /api/file/upload` with `label=true` - Generate HWPX label files for Korean word processors
- Format supports A4 2x9 label layout (100x30mm labels)
- Output includes address (left-aligned), name (right-aligned), postal code (right-aligned)

## Common Issues & Solutions

**Frontend JSON Parsing Errors**:
- **Issue**: "Unexpected token 'P', "PK..." is not valid JSON" on Vercel deployment
- **Cause**: Frontend trying to parse Excel file response as JSON
- **Solution**: Ensure both upload functions (`uploadFile` and `processLabelFile`) check content-type headers
- **Files to check**: `public/app.js` for proper content-type handling logic

**CORS Issues**:
- Frontend must match configured origins in CORS middleware
- Currently configured for localhost:3005 and 127.0.0.1:3005
- Update `config.frontendUrl` and CORS origins array if needed

**HWPX Alignment Issues**:
- **Issue**: Text not aligning properly in HWPX label output
- **Cause**: HWPX format requires specific `lineseg` positioning with `horzpos` attributes
- **Solution**: Modify `api/hwpx.js` cellXml function, adjust `horzpos` values for alignment
- **Current Implementation**: Uses `horzpos="20000"` for right alignment, `horzpos="0"` for left

**Duplicate Column Creation**:
- **Issue**: Excel output contains duplicate columns (주소, 시도, 시군구)
- **Cause**: Smart column detection not recognizing existing columns properly
- **Solution**: Check `hasFullAddress`, `hasSido`, `hasSigungu` logic in both `api/index.js` and backend processing
- **Key Logic**: Only add columns that don't already exist using case-insensitive pattern matching

**File Upload Validation**:
- Excel files must have recognizable address column headers
- Supported patterns: '주소', '주소지', 'address', 'addr', etc.
- Maximum 1000 rows, 10MB file size limit

## Development Notes

### File Structure Differences
- **Local Development**: Frontend files in `frontend/public/`, backend in `backend/src/`
- **Vercel Deployment**: Frontend files in `public/`, serverless function in `api/index.js`
- **Shared Logic**: Both use same JUSO API integration and Excel processing logic

### Frontend File Upload Handling
- **Two Upload Functions**: `uploadFile()` (main tab) and `processLabelFile()` (label tab)
- **Content-Type Checking**: Both must check response headers before parsing JSON or downloading files
- **Response Types**: JSON (with job tracking) or direct Excel file download depending on deployment

### Excel Processing Features
- **Smart Column Detection**: Automatically detects existing columns to prevent duplicates
- **Address Normalization**: Removes spaces and special characters for duplicate detection
- **Rate Limiting**: 50ms delay between API calls to prevent quota exhaustion
- **Error Recovery**: Continues processing even when individual addresses fail

### USB Distribution Package
- **Built with PKG**: Creates standalone executables without requiring Node.js installation
- **Target Platform**: Windows 10/11 64-bit primarily
- **Build Commands**: `npm run build-win` for Windows, `npm run build-all` for all platforms
- **Package Location**: Executables output to `../dist/` directory
- **Assets**: Includes frontend files from `../../frontend/public/` automatically

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
