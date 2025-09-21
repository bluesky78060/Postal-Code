# Postal Code Finder System

A web application that automatically adds postal codes to Excel files by reading addresses.

## 🚀 Key Features

- **Single Address Search**: Real-time postal code search when entering addresses
- **Excel File Processing**: Automatically add postal codes to address columns after uploading Excel files
- **Real-time Progress**: Real-time monitoring of file processing progress
- **Address Autocomplete**: Address suggestions while typing
- **Batch Processing**: Process multiple addresses at once
- **Duplicate Removal**: Automatically remove duplicate address data
- **Label Printing**: A4 label printing (2 columns, 9 rows, 100x30mm labels)

## 📁 Project Structure

```
postal-code-finder/
├── backend/              # Node.js Backend
│   ├── src/
│   │   ├── controllers/  # API Controllers
│   │   ├── routes/       # Route Definitions
│   │   ├── services/     # Business Logic
│   │   ├── middleware/   # Middleware
│   │   ├── utils/        # Utility Functions
│   │   └── app.js        # Main App
│   ├── package.json
│   └── .env              # Environment Variables
├── frontend/             # Frontend Files
│   └── public/           # Static Files
└── USB-Release/          # USB Distribution Files
```

## 🛠️ Installation and Setup

### 1. Backend Setup

```bash
cd backend
npm install
```

### 2. Environment Variables

Open the `.env` file and configure your provider/keys (choose one or mix):

```bash
# Provider Selection: local | juso | kakao
POSTAL_PROVIDER=local

# For Local (Offline) Usage
LOCAL_DATA_PATH=backend/data/postcodes.csv

# For Juso (Korean Address Service)
JUSO_API_KEY=YOUR_JUSO_CONF_KEY

# For Kakao Service
KAKAO_API_KEY=YOUR_KAKAO_REST_API_KEY_HERE
```

### 3. Run Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server runs at `http://localhost:3001`.

## 🔑 API Key Setup

### Juso API (Recommended)
1. Visit [Juso Open API](https://www.juso.go.kr/openIndexPage.do)
2. Register and apply for Road Name Address API
3. Copy the issued authentication key to `JUSO_API_KEY` in `.env`

### Kakao API (Alternative)
1. Visit [Kakao Developers](https://developers.kakao.com)
2. Login with Kakao account
3. "My Applications" → "Add Application"
4. Enter app information and create
5. "App Settings" → "Platform" → "Register Web Platform"
6. Register domain (e.g., http://localhost:3001)
7. Copy REST API key from "App Settings" → "App Keys"
8. Enter key in `.env` file

## 📡 API Endpoints

### Address Search
- `POST /api/address/search` - Single address search
- `GET /api/address/autocomplete` - Address autocomplete
- `GET /api/address/postal/:postalCode` - Search address by postal code
- `POST /api/address/batch` - Batch address search

### File Processing
- `POST /api/file/upload` - Excel file upload
- `GET /api/file/status/:jobId` - Check processing status
- `GET /api/file/download/:fileId` - Download processed file
- `GET /api/file/list` - List files
- `DELETE /api/file/:fileId` - Delete file

### System
- `GET /api/health` - Server health check

## 🧩 Offline (Local) Postal Code Provider

- Default setting is `POSTAL_PROVIDER=local`. Works without external APIs.
- Data file path is specified by `LOCAL_DATA_PATH`, default is `backend/data/postcodes.csv`.
- CSV Schema:
  - `postalCode,sido,sigungu,roadName,buildingMain,buildingSub,legalDong,jibunMain,jibunSub,fullAddress`
- Sample data is included. For production use, download complete data from public sources (Korea Post/MOIS Road Name Address DB) and convert to the same schema.

Note: Current CSV parser uses simple splitting. If fields contain commas, TSV (tab-separated) format is recommended.

## 🌐 Juso (Road Name Address) Provider

- Site: https://www.juso.go.kr/openIndexPage.do
- Key Issuance: Apply for Road Name Address Open API and set the issued authentication key to `JUSO_API_KEY` in `.env`
- Usage: `POSTAL_PROVIDER=juso`
- Operation: Search by keyword (address) to return `zipNo` (postal code) and `roadAddr`, autocomplete and postal code reverse search are implemented based on keyword search results

## 📋 Usage

### 1. Single Address Search

```bash
curl -X POST http://localhost:3001/api/address/search \
  -H "Content-Type: application/json" \
  -d '{"address":"Seoul Gangnam-gu Teheran-ro 123"}'
```

### 2. Excel File Upload

```bash
curl -X POST http://localhost:3001/api/file/upload \
  -F "file=@your-file.xlsx"
```

### 3. Check Processing Status

```bash
curl http://localhost:3001/api/file/status/job_1234567890_abc
```

## 📝 Excel File Format

- **Supported Formats**: .xls, .xlsx
- **Maximum Size**: 10MB
- **Address Column Names**: 'address', 'addr', '주소', '주소지', etc.
- **Maximum Rows**: 1,000

### Example Excel Structure

| Name | Address | Phone |
|------|---------|-------|
| John Doe | Seoul Gangnam-gu Teheran-ro 123 | 010-1234-5678 |
| Jane Smith | Busan Haeundae-gu Centum-ro 456 | 010-9876-5432 |

After processing:

| Name | Address | Phone | Postal Code |
|------|---------|-------|-------------|
| John Doe | Seoul Gangnam-gu Teheran-ro 123 | 010-1234-5678 | 06159 |
| Jane Smith | Busan Haeundae-gu Centum-ro 456 | 010-9876-5432 | 48058 |

## 🏷️ Label Printing

- **A4 Paper**: 2 columns, 9 rows layout
- **Label Size**: 100mm × 30mm with no gaps
- **Format**: Right-aligned text in order: Address → Name → Postal Code
- **Honorific Options**: Add "님" or "귀하" suffix to names

## 💾 USB Distribution

For users without Node.js installation, a USB-distributable version is available:

### Building USB Version

```bash
# Run the build script
build-usb.bat
```

### Generated Files
```
USB-Release/
├── 우편번호찾기.exe     # Standalone executable
├── public/              # Web interface files
├── .env                 # Configuration file
├── 사용법.md           # User guide
└── data/               # Sample data (optional)
```

### Usage
1. Copy USB-Release folder to USB drive
2. Configure `JUSO_API_KEY` in `.env` file
3. Run `우편번호찾기.exe` or `USB-실행방법.bat`
4. Access `http://localhost:3005` in browser

## ⚠️ Precautions

- Never expose Juso API keys to clients
- Do not commit .env files to git
- Check API call limits (daily 300,000 calls)

## 🔧 Development

### Dependencies

- Node.js 16+
- npm 8+

### Key Libraries

- Express.js - Web framework
- Multer - File upload
- XLSX - Excel file processing
- Axios - HTTP client
- Helmet - Security
- Express Rate Limit - API limiting

## 📞 Contact

For development-related inquiries, please register an issue.