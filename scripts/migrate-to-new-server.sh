#!/bin/bash

# EDNC License Management System - Migration Script
# This script helps migrate the system to a new server

set -e

# Configuration
NEW_SERVER_IP="192.168.10.37"
PROJECT_ROOT="/home/csjo/a3_claude/lms_ednc"

echo "🚀 EDNC License Management System Migration Script"
echo "📅 Migration started: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')"
echo "🎯 Target Server IP: $NEW_SERVER_IP"
echo ""

# Check if we're in the project directory
if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: $PROJECT_ROOT"
    exit 1
fi

echo "✅ Project directory confirmed"

# Backup current configuration
echo "📦 Creating backup of current configuration..."
cp ecosystem.config.js ecosystem.config.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created"

# Update ecosystem.config.js
echo "🔧 Updating ecosystem.config.js for new server IP..."
sed -i "s/192.168.10.105/$NEW_SERVER_IP/g" ecosystem.config.js
echo "✅ ecosystem.config.js updated"

# Update frontend configuration if it exists
if [ -f "frontend/src/config/api.js" ]; then
    echo "🔧 Updating frontend API configuration..."
    sed -i "s/192.168.10.105/$NEW_SERVER_IP/g" frontend/src/config/api.js
    echo "✅ Frontend API configuration updated"
fi

# Check for other configuration files that might need updating
echo "🔍 Checking for other configuration files..."
find . -name "*.js" -o -name "*.json" -o -name "*.env*" | xargs grep -l "192.168.10.105" 2>/dev/null || echo "   No other files found with old IP"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/database
mkdir -p backend/uploads
mkdir -p logs
chmod 755 backend/database backend/uploads logs
echo "✅ Directories created and permissions set"

# Check if database file exists
if [ -f "backend/database/licenses.db" ]; then
    echo "✅ Database file found"
    DB_SIZE=$(du -h backend/database/licenses.db | cut -f1)
    echo "   Database size: $DB_SIZE"
else
    echo "⚠️  Database file not found at backend/database/licenses.db"
    echo "   You will need to transfer it manually"
fi

# Check if uploads directory has files
if [ -d "backend/uploads" ] && [ "$(ls -A backend/uploads 2>/dev/null)" ]; then
    echo "✅ Upload directory contains files"
    UPLOAD_COUNT=$(find backend/uploads -type f | wc -l)
    echo "   Number of uploaded files: $UPLOAD_COUNT"
else
    echo "⚠️  Upload directory is empty or doesn't exist"
    echo "   You will need to transfer uploaded files manually"
fi

# Check Node.js and npm
echo "🔍 Checking Node.js and npm..."
if command -v node &> /dev/null; then
    echo "✅ Node.js $(node --version) found"
else
    echo "❌ Node.js not found. Please install it first:"
    echo "   sudo dnf install -y nodejs npm"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "✅ npm $(npm --version) found"
else
    echo "❌ npm not found. Please install it first:"
    echo "   sudo dnf install -y nodejs npm"
    exit 1
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 found"
else
    echo "⚠️  PM2 not found. Installing..."
    npm install -g pm2
    if [ $? -eq 0 ]; then
        echo "✅ PM2 installed successfully"
    else
        echo "❌ PM2 installation failed"
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Backend dependencies installation failed"
    exit 1
fi

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install
if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Frontend dependencies installation failed"
    exit 1
fi

cd ..

# Check firewall ports
echo "🔍 Checking firewall configuration..."
if command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --list-ports | grep -q "3600"; then
        echo "✅ Port 3600 (frontend) is open"
    else
        echo "⚠️  Port 3600 (frontend) is not open"
        echo "   Run: sudo firewall-cmd --permanent --add-port=3600/tcp"
    fi
    
    if firewall-cmd --list-ports | grep -q "3601"; then
        echo "✅ Port 3601 (backend) is open"
    else
        echo "⚠️  Port 3601 (backend) is not open"
        echo "   Run: sudo firewall-cmd --permanent --add-port=3601/tcp"
    fi
else
    echo "⚠️  firewall-cmd not found. Please check firewall manually"
fi

echo ""
echo "🎉 Migration script completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Next steps:"
echo "   1. Transfer database file if not present"
echo "   2. Transfer uploaded license files if not present"
echo "   3. Open firewall ports if needed"
echo "   4. Start the system: ./scripts/start-system.sh"
echo "   5. Test access:"
echo "      - Frontend: http://$NEW_SERVER_IP:3600"
echo "      - Backend: http://$NEW_SERVER_IP:3601"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📅 Migration completed: $(date '+%Y년 %m월 %d일 %H시 %M분 %S초')" 