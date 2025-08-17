#!/bin/bash
# filepath: /Users/ericperez/Desktop/react-app/generate-batch-reports.sh
# Batch Production Report Generator
# Usage: ./generate-batch-reports.sh [start-date] [end-date]
# Example: ./generate-batch-reports.sh 2024-01-01 2024-01-31

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 KING UNIFORMS - BATCH REPORT GENERATOR${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if Node.js script exists
if [ ! -f "historical-production-report.js" ]; then
    echo -e "${RED}❌ Error: historical-production-report.js not found${NC}"
    echo "Make sure you're running this script from the correct directory."
    exit 1
fi

# Function to validate date format (YYYY-MM-DD)
validate_date() {
    local date_string="$1"
    if [[ ! $date_string =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        return 1
    fi
    
    # Try to create a date from the string
    if ! date -j -f "%Y-%m-%d" "$date_string" >/dev/null 2>&1; then
        return 1
    fi
    
    return 0
}

# Get date parameters
if [ $# -eq 0 ]; then
    # No parameters - show usage and provide interactive options
    echo "Usage:"
    echo "  $0 [start-date] [end-date]"
    echo "  $0 today"
    echo "  $0 yesterday"
    echo "  $0 this-week"
    echo "  $0 last-week"
    echo "  $0 this-month"
    echo "  $0 last-month"
    echo ""
    echo "Date format: YYYY-MM-DD (e.g., 2024-01-15)"
    echo ""
    echo -e "${YELLOW}Quick Options:${NC}"
    echo "1. Generate today's report"
    echo "2. Generate yesterday's report"
    echo "3. Generate this week's reports"
    echo "4. Generate last week's reports"
    echo "5. Generate this month's reports"
    echo "6. Generate last month's reports"
    echo "7. Custom date range"
    echo ""
    read -p "Select an option (1-7): " choice
    
    case $choice in
        1)
            START_DATE=$(date +%Y-%m-%d)
            END_DATE=$START_DATE
            ;;
        2)
            START_DATE=$(date -j -v-1d +%Y-%m-%d)
            END_DATE=$START_DATE
            ;;
        3)
            START_DATE=$(date -j -v-monday +%Y-%m-%d)
            END_DATE=$(date +%Y-%m-%d)
            ;;
        4)
            START_DATE=$(date -j -v-1w -v-monday +%Y-%m-%d)
            END_DATE=$(date -j -v-1w -v+6d -v-monday +%Y-%m-%d)
            ;;
        5)
            START_DATE=$(date -j -v1d +%Y-%m-%d)
            END_DATE=$(date +%Y-%m-%d)
            ;;
        6)
            START_DATE=$(date -j -v-1m -v1d +%Y-%m-%d)
            END_DATE=$(date -j -v-1m -v31d +%Y-%m-%d 2>/dev/null || date -j -v-1m -v30d +%Y-%m-%d 2>/dev/null || date -j -v-1m -v29d +%Y-%m-%d 2>/dev/null || date -j -v-1m -v28d +%Y-%m-%d)
            ;;
        7)
            echo ""
            read -p "Enter start date (YYYY-MM-DD): " START_DATE
            read -p "Enter end date (YYYY-MM-DD): " END_DATE
            ;;
        *)
            echo -e "${RED}❌ Invalid option${NC}"
            exit 1
            ;;
    esac
elif [ $# -eq 1 ]; then
    # Single parameter - handle special cases
    case $1 in
        "today")
            START_DATE=$(date +%Y-%m-%d)
            END_DATE=$START_DATE
            ;;
        "yesterday")
            START_DATE=$(date -j -v-1d +%Y-%m-%d)
            END_DATE=$START_DATE
            ;;
        "this-week")
            START_DATE=$(date -j -v-monday +%Y-%m-%d)
            END_DATE=$(date +%Y-%m-%d)
            ;;
        "last-week")
            START_DATE=$(date -j -v-1w -v-monday +%Y-%m-%d)
            END_DATE=$(date -j -v-1w -v+6d -v-monday +%Y-%m-%d)
            ;;
        "this-month")
            START_DATE=$(date -j -v1d +%Y-%m-%d)
            END_DATE=$(date +%Y-%m-%d)
            ;;
        "last-month")
            START_DATE=$(date -j -v-1m -v1d +%Y-%m-%d)
            END_DATE=$(date -j -v-1m -v31d +%Y-%m-%d 2>/dev/null || date -j -v-1m -v30d +%Y-%m-%d 2>/dev/null || date -j -v-1m -v29d +%Y-%m-%d 2>/dev/null || date -j -v-1m -v28d +%Y-%m-%d)
            ;;
        *)
            # Assume it's a single date
            if validate_date "$1"; then
                START_DATE=$1
                END_DATE=$1
            else
                echo -e "${RED}❌ Invalid date format: $1${NC}"
                echo "Use YYYY-MM-DD format (e.g., 2024-01-15)"
                exit 1
            fi
            ;;
    esac
elif [ $# -eq 2 ]; then
    # Two parameters - start and end dates
    if validate_date "$1" && validate_date "$2"; then
        START_DATE=$1
        END_DATE=$2
    else
        echo -e "${RED}❌ Invalid date format${NC}"
        echo "Use YYYY-MM-DD format (e.g., 2024-01-15)"
        exit 1
    fi
else
    echo -e "${RED}❌ Too many parameters${NC}"
    echo "Usage: $0 [start-date] [end-date]"
    exit 1
fi

# Validate date range
if [[ "$START_DATE" > "$END_DATE" ]]; then
    echo -e "${RED}❌ Start date ($START_DATE) must be before or equal to end date ($END_DATE)${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📅 Generating reports from $START_DATE to $END_DATE${NC}"
echo ""

# Calculate number of days
START_TIMESTAMP=$(date -j -f "%Y-%m-%d" "$START_DATE" "+%s")
END_TIMESTAMP=$(date -j -f "%Y-%m-%d" "$END_DATE" "+%s")
DAYS_DIFF=$(( (END_TIMESTAMP - START_TIMESTAMP) / 86400 + 1 ))

if [ $DAYS_DIFF -gt 31 ]; then
    echo -e "${YELLOW}⚠️  Warning: You're about to generate $DAYS_DIFF reports.${NC}"
    echo "This might take a while and consume significant resources."
    read -p "Do you want to continue? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "Operation cancelled."
        exit 0
    fi
fi

echo -e "${GREEN}📊 Processing $DAYS_DIFF day(s)...${NC}"
echo ""

# Create reports directory if it doesn't exist
mkdir -p production-reports

# Initialize counters
SUCCESSFUL_REPORTS=0
FAILED_REPORTS=0
TOTAL_UNITS=0
ACTIVE_DAYS=0

# Generate reports
CURRENT_DATE=$START_DATE
while [[ "$CURRENT_DATE" <= "$END_DATE" ]]; do
    echo -e "${BLUE}🔄 Processing $CURRENT_DATE...${NC}"
    
    # Run the report generation
    if node historical-production-report.js date "$CURRENT_DATE"; then
        SUCCESSFUL_REPORTS=$((SUCCESSFUL_REPORTS + 1))
        echo -e "${GREEN}✅ $CURRENT_DATE - Report generated successfully${NC}"
        
        # Check if report file was created and has data
        REPORT_FILE="production-reports/${CURRENT_DATE}.json"
        if [ -f "$REPORT_FILE" ]; then
            # Extract total quantity from JSON (basic grep approach)
            if grep -q '"isEmpty": *false' "$REPORT_FILE"; then
                ACTIVE_DAYS=$((ACTIVE_DAYS + 1))
                # Try to extract totalQuantity (this is a basic approach)
                QUANTITY=$(grep -o '"totalQuantity": *[0-9]*' "$REPORT_FILE" | grep -o '[0-9]*' | head -1)
                if [ ! -z "$QUANTITY" ]; then
                    TOTAL_UNITS=$((TOTAL_UNITS + QUANTITY))
                fi
            fi
        fi
    else
        FAILED_REPORTS=$((FAILED_REPORTS + 1))
        echo -e "${RED}❌ $CURRENT_DATE - Report generation failed${NC}"
    fi
    
    echo ""
    
    # Move to next date
    CURRENT_DATE=$(date -j -v+1d -f "%Y-%m-%d" "$CURRENT_DATE" "+%Y-%m-%d")
done

# Summary
echo -e "${BLUE}📊 BATCH GENERATION SUMMARY${NC}"
echo -e "${BLUE}============================${NC}"
echo -e "${GREEN}✅ Successful reports: $SUCCESSFUL_REPORTS${NC}"
if [ $FAILED_REPORTS -gt 0 ]; then
    echo -e "${RED}❌ Failed reports: $FAILED_REPORTS${NC}"
fi
echo -e "${YELLOW}📅 Active days (with data): $ACTIVE_DAYS${NC}"
echo -e "${YELLOW}📊 Total units processed: $(printf "%'d" $TOTAL_UNITS)${NC}"
if [ $ACTIVE_DAYS -gt 0 ]; then
    AVERAGE_PER_DAY=$((TOTAL_UNITS / ACTIVE_DAYS))
    echo -e "${YELLOW}📈 Average units per active day: $(printf "%'d" $AVERAGE_PER_DAY)${NC}"
fi

echo ""
echo -e "${BLUE}📁 Reports saved in: ./production-reports/${NC}"
echo -e "${BLUE}🔍 Search reports with: node historical-production-report.js search \"keyword\"${NC}"
echo -e "${BLUE}📊 View in dashboard: http://localhost:5178 (Reports → Historical Reports)${NC}"

echo ""
echo -e "${GREEN}🎉 Batch generation complete!${NC}"
