# Postal Code Finder System

A web application that automatically adds postal codes to Excel files by reading addresses.

## 🚀 Key Features

- **Single Address Search**: Real-time postal code search when entering addresses
- **Excel File Processing**: Automatically add postal codes to address columns after uploading Excel files
- **Duplicate Data Removal**: Automatically remove duplicate address data when uploading Excel files
- **Label Printing**: A4 paper label printing in 2 columns, 9 rows layout (100x30mm, no gaps)
- **Real-time Progress**: Real-time monitoring of file processing progress
- **Address Autocomplete**: Address suggestions while typing
- **Batch Processing**: Process multiple addresses at once

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
│   └── public/           # Static Files (HTML, CSS, JS)
├── USB-Release/          # USB Distribution Files
├── build-usb.bat         # USB Build Script
├── start-windows.bat     # Windows Startup Script
└── USB-실행방법.bat     # USB Execution Guide
```

## 🛠️ Installation and Setup

### 1. Backend Setup

```bash
cd backend
npm install
```

### 2. Environment Variables

Create a `.env` file and configure as follows:

```bash
# Juso (Korean Road Name Address) API Key (Recommended)
JUSO_API_KEY=YOUR_JUSO_CONF_KEY

# Server Port Configuration
PORT=3005

# Frontend URL
FRONTEND_URL=http://localhost:3005
```

### 3. Run Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server runs at `http://localhost:3005`.

## 🔑 Juso API Key Setup

1. Visit [Address Information Portal](https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do)
2. Register or login
3. Click "Apply for Road Name Address API"
4. Fill out and submit the application form
5. Check the issued authentication key after approval
6. Enter the key in `JUSO_API_KEY` in the `.env` file

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

## 📋 Usage

### 1. Single Address Search

```bash
curl -X POST http://localhost:3005/api/address/search \
  -H "Content-Type: application/json" \
  -d '{"address":"Seoul Gangnam-gu Teheran-ro 123"}'
```

### 2. Excel File Upload

```bash
curl -X POST http://localhost:3005/api/file/upload \
  -F "file=@your-file.xlsx"
```

### 3. Check Processing Status

```bash
curl http://localhost:3005/api/file/status/job_1234567890_abc
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

## 🏷️ Label Printing Feature

- **A4 Paper**: 2 columns, 9 rows label layout
- **Label Size**: 100mm × 30mm (no gaps between labels)
- **Output Format**: Right-aligned text in order: Address → Name → Postal Code
- **Honorific Options**: Add "님" or "귀하" suffix to names
- **Print Optimization**: Accurate label positioning using browser print function

## 💾 USB Distribution Feature

Provides standalone executable files that can be used without Node.js installation:

### USB Build Method
```bash
# Run on Windows
build-usb.bat
```

### Generated Files
```
USB-Release/
├── 우편번호찾기.exe     # Standalone executable
├── public/              # Web interface files
├── .env                 # Environment configuration file
├── 사용법.md           # User guide
└── data/               # Sample data (optional)
```

### USB Usage
1. Copy USB-Release folder to USB drive
2. Configure `JUSO_API_KEY` in `.env` file
3. Run `우편번호찾기.exe` or `USB-실행방법.bat`
4. Access `http://localhost:3005` in browser

## ⚠️ Precautions

- Never expose Juso API keys to clients
- Do not commit .env files to git
- Check API call limits
- Windows Firewall may require execution permission
- Some antivirus programs may flag the executable as false positive

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
- PKG - Standalone executable generation
- Node-cron - Scheduling
- Compression - Response compression

### System Requirements

- **Development Environment**: Node.js 16+, npm 8+
- **USB Distribution**: Windows 10/11 (64-bit), minimum 2GB RAM, 100MB free space

## 📞 Contact

For development-related inquiries, please register a GitHub issue.