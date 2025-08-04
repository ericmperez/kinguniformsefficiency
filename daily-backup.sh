#!/bin/bash

# Daily Firebase Backup Script
# Add this to your crontab to run automatically

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Starting daily Firebase backup...${NC}"

# Navigate to your project directory
cd /Users/ericperez/Desktop/react-app

# Create backups directory if it doesn't exist
mkdir -p backups

# Run the backup script
node backup-firebase.js

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Daily backup completed successfully!${NC}"
    
    # Optional: Upload to cloud storage (uncomment and configure as needed)
    # aws s3 cp backups/ s3://your-backup-bucket/firebase-backups/ --recursive
    # or
    # rsync -av backups/ user@your-server:/path/to/backups/
    
    # Clean up old backups (keep last 30 days)
    find backups/ -name "firebase-backup-*.json" -mtime +30 -delete
    
    echo -e "${GREEN}🧹 Cleaned up old backups (kept last 30 days)${NC}"
    
else
    echo -e "${RED}❌ Backup failed! Check the logs.${NC}"
    exit 1
fi
