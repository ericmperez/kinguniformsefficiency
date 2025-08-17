# Historical Production Reports System

## Quick Start

Your historical production reports system is now ready! Here's how to use it:

## 🚀 Command Line Usage

### Generate Reports

```bash
# Today's report
node historical-production-report.js today

# Specific date
node historical-production-report.js date 2024-01-15
node historical-production-report.js date 1/15/2024
node historical-production-report.js date 01-15-2024

# Date range
node historical-production-report.js range 2024-01-01 2024-01-31

# Search existing reports
node historical-production-report.js search "King Uniforms"
node historical-production-report.js search "polo shirt"
```

### Batch Generation Script

```bash
# Make it executable (first time only)
chmod +x generate-batch-reports.sh

# Interactive mode - shows menu with options
./generate-batch-reports.sh

# Quick commands
./generate-batch-reports.sh today
./generate-batch-reports.sh yesterday
./generate-batch-reports.sh this-week
./generate-batch-reports.sh last-week
./generate-batch-reports.sh this-month
./generate-batch-reports.sh last-month

# Custom range
./generate-batch-reports.sh 2024-01-01 2024-01-31
```

## 📊 Web Interface

Access the Historical Reports viewer at:
**http://localhost:5178** → **Reports** → **Historical Reports**

## 📁 Report Storage

- Reports are saved as JSON files in `production-reports/` directory
- Filename format: `YYYY-MM-DD.json`
- Each report contains comprehensive data including:
  - Timing summary (first/last items, production span)
  - Hourly breakdown
  - Top products and clients
  - Individual entries
  - Statistics and rates

## 🔍 Example Usage Scenarios

### Generate Last Month's Reports
```bash
./generate-batch-reports.sh last-month
```

### Find All Reports with a Specific Client
```bash
node historical-production-report.js search "ABC Company"
```

### Generate Reports for Q1 2024
```bash
node historical-production-report.js range 2024-01-01 2024-03-31
```

### Check Yesterday's Production
```bash
node historical-production-report.js date $(date -j -v-1d +%Y-%m-%d)
```

## 📈 Report Features

Each report includes:
- **First/Last Item Times** - Exactly what you requested
- **Production Span** - Hours and minutes of active production  
- **Hourly Breakdown** - Items processed per hour
- **Production Rates** - Units per hour calculations
- **Top Products** - Most processed items
- **Client Summary** - Production by client
- **Detailed Entries** - Complete audit trail

## 🔧 Troubleshooting

### If Firebase Authentication Fails
```bash
# Check if you're connected to the internet
# Verify Firebase configuration in the script
```

### If No Reports Found
```bash
# Make sure you have production data for the date range
# Check that items have proper addedAt timestamps
```

### Performance Tips
- For large date ranges (>30 days), the script will ask for confirmation
- Reports are cached locally, so re-running is fast
- Use search function to quickly find specific data

## 🎯 Production Analysis Examples

### Daily Efficiency Report
```bash
# Generate today's report to see timing and efficiency
node historical-production-report.js today
```

### Weekly Performance Review  
```bash
# Generate this week's reports for trend analysis
./generate-batch-reports.sh this-week
```

### Monthly Production Summary
```bash
# Generate full month for comprehensive analysis
./generate-batch-reports.sh last-month
```

Your system now provides complete historical visibility into production timing and efficiency! 🚀
