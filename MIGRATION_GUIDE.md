# EDNC License Management System - Server Migration Guide

## Overview
This guide will help you migrate the EDNC License Management System from the current server to a new server PC with IP `192.168.10.37`.

## Prerequisites
- New server PC with IP: `192.168.10.37`
- Node.js and npm installed on the new server
- Git access to the repository
- Manual transfer of database and uploaded license files

## Migration Steps

### 1. Prepare the New Server

#### 1.1 Install Required Software
```bash
# Update system packages
sudo dnf update -y

# Install Node.js and npm
sudo dnf install -y nodejs npm

# Install Git (if not already installed)
sudo dnf install -y git

# Install PM2 globally
sudo npm install -g pm2
```

#### 1.2 Create Project Directory
```bash
# Create project directory
mkdir -p /home/csjo/a3_claude
cd /home/csjo/a3_claude

# Clone the repository
git clone https://github.com/ahe24/ednc_lms.git lms_ednc
cd lms_ednc
```

### 2. Update Configuration Files

#### 2.1 Update ecosystem.config.js
The current configuration needs to be updated for the new server IP. Update the following file:

**File: `ecosystem.config.js`**
```javascript
const path = require('path');

// 로그 디렉토리 설정 - 권한에 따라 동적으로 결정
const projectRoot = '/home/csjo/a3_claude/lms_ednc';
let logDir = '/var/log/license-system';

// /var/log 권한 체크
try {
  const fs = require('fs');
  fs.accessSync('/var/log', fs.constants.W_OK);
} catch (err) {
  logDir = path.join(projectRoot, 'logs');
}

module.exports = {
  apps: [
    {
      name: 'license-backend',
      cwd: `${projectRoot}/backend`,
      script: 'src/server.js',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.BACKEND_PORT || 3601,
        HOST: '0.0.0.0',
        DB_PATH: `${projectRoot}/backend/database/licenses.db`,
        UPLOAD_DIR: `${projectRoot}/backend/uploads`,
        JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-please-change-this',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '70998',
        TZ: 'Asia/Seoul',
        LANG: 'ko_KR.UTF-8',
        LC_TIME: 'ko_KR.UTF-8'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: `${logDir}/backend-error.log`,
      out_file: `${logDir}/backend-out.log`,
      log_file: `${logDir}/backend.log`,
      time: true
    },
    {
      name: 'license-frontend',
      cwd: `${projectRoot}/frontend`,
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.FRONTEND_PORT || 3600,
        HOST: '0.0.0.0',
        REACT_APP_API_BASE_URL: 'http://192.168.10.37:3601',
        REACT_APP_SERVER_IP: '192.168.10.37'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: `${logDir}/frontend-error.log`,
      out_file: `${logDir}/frontend-out.log`,
      log_file: `${logDir}/frontend.log`,
      time: true
    }
  ]
};
```

#### 2.2 Update Frontend Configuration
**File: `frontend/src/config/api.js`** (if it exists)
```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://192.168.10.37:3601';

export default API_BASE_URL;
```

### 3. Manual Database and File Transfer

#### 3.1 Transfer Database File
From the current server, copy the database file to the new server:
```bash
# On current server (source)
scp /home/csjo/a3_claude/lms_ednc/backend/database/licenses.db user@192.168.10.37:/home/csjo/a3_claude/lms_ednc/backend/database/

# Or use rsync for better transfer
rsync -avz /home/csjo/a3_claude/lms_ednc/backend/database/licenses.db user@192.168.10.37:/home/csjo/a3_claude/lms_ednc/backend/database/
```

#### 3.2 Transfer Uploaded License Files
```bash
# On current server (source)
rsync -avz /home/csjo/a3_claude/lms_ednc/backend/uploads/ user@192.168.10.37:/home/csjo/a3_claude/lms_ednc/backend/uploads/
```

### 4. Install Dependencies and Setup

#### 4.1 Install Backend Dependencies
```bash
cd /home/csjo/a3_claude/lms_ednc/backend
npm install
```

#### 4.2 Install Frontend Dependencies
```bash
cd /home/csjo/a3_claude/lms_ednc/frontend
npm install
```

#### 4.3 Set Proper Permissions
```bash
cd /home/csjo/a3_claude/lms_ednc
chmod 755 backend/database
chmod 755 backend/uploads
mkdir -p logs
chmod 755 logs
```

### 5. Start the System

#### 5.1 Use the Start Script
```bash
cd /home/csjo/a3_claude/lms_ednc
chmod +x scripts/start-system.sh
./scripts/start-system.sh
```

#### 5.2 Or Start Manually with PM2
```bash
cd /home/csjo/a3_claude/lms_ednc
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Verify Installation

#### 6.1 Check Service Status
```bash
pm2 status
pm2 logs
```

#### 6.2 Test Access
- Frontend: http://192.168.10.37:3600
- Backend API: http://192.168.10.37:3601/api/health

#### 6.3 Verify Database
```bash
# Check if database file exists and has data
ls -la /home/csjo/a3_claude/lms_ednc/backend/database/
sqlite3 /home/csjo/a3_claude/lms_ednc/backend/database/licenses.db ".tables"
```

### 7. Firewall Configuration

#### 7.1 Open Required Ports
```bash
# Open frontend port
sudo firewall-cmd --permanent --add-port=3600/tcp

# Open backend port
sudo firewall-cmd --permanent --add-port=3601/tcp

# Reload firewall
sudo firewall-cmd --reload

# Verify ports are open
sudo firewall-cmd --list-ports
```

### 8. System Service Setup (Optional)

#### 8.1 Create Systemd Service
```bash
# Generate PM2 startup script
pm2 startup systemd

# Save current PM2 configuration
pm2 save
```

### 9. Post-Migration Checklist

- [ ] Database file transferred successfully
- [ ] Uploaded license files transferred
- [ ] Configuration files updated with new IP
- [ ] Dependencies installed
- [ ] Services started successfully
- [ ] Firewall ports opened
- [ ] Frontend accessible at http://192.168.10.37:3600
- [ ] Backend API accessible at http://192.168.10.37:3601
- [ ] Login functionality working
- [ ] License file upload/download working

### 10. Troubleshooting

#### 10.1 Common Issues

**Port Already in Use:**
```bash
# Check what's using the port
sudo netstat -tulpn | grep :3600
sudo netstat -tulpn | grep :3601

# Kill process if needed
sudo kill -9 <PID>
```

**Permission Issues:**
```bash
# Fix ownership
sudo chown -R $USER:$USER /home/csjo/a3_claude/lms_ednc

# Fix permissions
chmod -R 755 /home/csjo/a3_claude/lms_ednc
```

**Database Connection Issues:**
```bash
# Check database file permissions
ls -la /home/csjo/a3_claude/lms_ednc/backend/database/

# Test database connection
sqlite3 /home/csjo/a3_claude/lms_ednc/backend/database/licenses.db "SELECT COUNT(*) FROM licenses;"
```

#### 10.2 Log Analysis
```bash
# Check PM2 logs
pm2 logs license-frontend
pm2 logs license-backend

# Check system logs
sudo journalctl -u pm2-root -f
```

### 11. Backup Strategy

#### 11.1 Create Backup Script
Create a backup script for future migrations:

**File: `scripts/backup-system.sh`**
```bash
#!/bin/bash

BACKUP_DIR="/home/csjo/backups/license-system"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="license-system-backup-$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

# Create backup
tar -czf "$BACKUP_DIR/$BACKUP_NAME" \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=*.log \
  -C /home/csjo/a3_claude lms_ednc

echo "Backup created: $BACKUP_DIR/$BACKUP_NAME"
```

## Summary

The migration process involves:
1. **Source Control**: Clone from GitHub repository
2. **Configuration Update**: Update IP addresses in configuration files
3. **Manual Transfer**: Copy database and uploaded files
4. **Dependency Installation**: Install Node.js dependencies
5. **Service Startup**: Start services with PM2
6. **Verification**: Test all functionality

The system will be accessible at:
- **Frontend**: http://192.168.10.37:3600
- **Backend API**: http://192.168.10.37:3601

Login credentials remain the same:
- **Username**: admin
- **Password**: 70998 