# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **EDNC License Management System (LMS)** - a Korean license management system designed to parse and manage Siemens Industry Software license files. The project is designed to run on Rocky Linux 9 with Korean locale support.

## Architecture

This is a full-stack web application with Korean localization:

- **Frontend**: React.js + TypeScript (Port: 3600) with Ant Design for Korean UI
- **Backend**: Node.js + Express.js (Port: 3601) 
- **Database**: SQLite3 (file-based)
- **Process Manager**: PM2
- **Timezone**: Asia/Seoul (Korean Standard Time)
- **Language**: Full Korean language support in UI and logs

## Key Features

- License file upload and automatic parsing of Siemens license files
- Dashboard with license status visualization 
- Expiration monitoring with Korean date formats
- Customer site-based license management
- Multi-client access support
- Single admin authentication system
- Automatic backup system with Korean logging

## Project Structure

Based on the design document, the expected structure should be:

```
/opt/license-management/
├── frontend/                # React application (port 3600)
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                 # Node.js API server (port 3601)
│   ├── src/
│   ├── uploads/            # License file storage
│   ├── database/           # SQLite DB file
│   └── package.json
├── ecosystem.config.js      # PM2 configuration
└── .env.global             # Global environment settings
```

Currently only contains design documentation in `docs/license_management_design.md`.

## Database Schema

The SQLite database includes these main tables:
- `sites` - Customer site information
- `licenses` - License file metadata 
- `license_features` - Individual license features with expiry dates
- `users` - Single admin user authentication

## Key Development Commands

Based on the design document, these commands should be available once implemented:

### Backend Development
```bash
cd backend
npm install
npm start              # Production server
npm run dev           # Development with nodemon
npm run init-db       # Initialize database
```

### Frontend Development  
```bash
cd frontend
npm install
npm start             # Development server
npm run build         # Production build
```

### Production Deployment
```bash
# Start system with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 monit             # Real-time monitoring
```

### System Management
```bash
# Check status
pm2 status
pm2 logs license-frontend
pm2 logs license-backend

# Backup system
./backup.sh           # Automated backup script
```

## Korean Localization

This system is specifically designed for Korean users:
- All UI elements use Korean language
- Date/time display follows Korean formats (YYYY년 MM월 DD일)
- System logs and messages in Korean
- Seoul timezone (Asia/Seoul) for all operations
- Uses moment.js with Korean locale settings

## License File Processing

The system parses Siemens license files with these patterns:
- Site info: `# [Site Name] Site # :[Site ID]=[Site Name]`
- Host ID extraction from `HOSTID=FLEXID=` entries
- Feature parsing from License Content sections
- Date format handling: both `dd-mmm-yyyy` and `dd mmm yyyy`

## Environment Configuration

The system uses a multi-level environment configuration:
- `.env.global` - Global settings (server IP, ports, timezone)
- `backend/.env` - Backend specific settings
- `frontend/.env` - Frontend specific settings (REACT_APP_ prefixed)

Key environment variables:
- `SERVER_IP` - Server IP for multi-client access
- `FRONTEND_PORT` - React app port (default: 3600)  
- `BACKEND_PORT` - API server port (default: 3601)
- `TZ=Asia/Seoul` - Korean timezone
- `LANG=ko_KR.UTF-8` - Korean locale

## Important Technical Notes

- Uses SQLite WAL mode for better concurrent access
- PM2 ecosystem for process management
- CORS configured for multi-client network access
- JWT-based authentication with single admin account
- File upload handling with Multer
- Korean text search support in database queries
- Automated backup system with 7-day rotation

## Development Priorities

1. License file parsing engine (handles Siemens .lic files)
2. Korean-localized React frontend with Ant Design
3. SQLite database operations with Korean timezone handling
4. File upload and processing pipeline
5. Dashboard with expiration monitoring
6. Multi-client network deployment configuration

## Security Considerations  

- File upload restrictions (.lic, .txt files only, 10MB max)
- JWT token authentication
- CORS configuration for internal networks
- SQLite database file permissions
- No sensitive data in environment files committed to git