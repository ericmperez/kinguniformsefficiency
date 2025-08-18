# Area-Specific Duration Implementation

## Overview
Enhanced the Daily Employee Dashboard production rate calculations to use area-specific duration calculations instead of global production duration. Each production area now calculates its duration independently.

## Changes Made

### 1. Updated Production Rate Calculation Logic
**File**: `DailyEmployeeDashboard.tsx`
**Location**: `currentProductionRates` useMemo (lines ~317-400)

#### Previous Method:
- Used global production duration (first item to last item across all areas)
- All areas shared the same duration calculation
- Duration = `lastItemTime - firstItemTime` (global)

#### New Method (Area-Specific):
- **Mangle duration** = `lastMangleItemTime - mangleConfiguredStartTime`
- **Doblado duration** = `lastDobladoItemTime - dobladoConfiguredStartTime` 
- **Segregation duration** = `currentTime - segregationConfiguredStartTime`

### 2. Implementation Details

#### Helper Function Added:
```typescript
const parseTimeToToday = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  return today;
};
```

#### Area-Specific Duration Calculations:
1. **Mangle**: Filters entries to Mangle items only, sorts by timestamp, uses last Mangle item time
2. **Doblado**: Filters entries to Doblado items only, sorts by timestamp, uses last Doblado item time
3. **Segregation**: Uses current time (to be enhanced with actual segregation timestamps later)

#### Rate Calculations:
- Each area calculates rate using its own duration: `rate = totalProduction / areaDuration`
- Minimum duration enforced: 0.5 hours (30 minutes) to prevent extremely high rates

### 3. Updated Display Logic

#### Duration Labels:
- Changed from "Production Duration: X.Xh" to "Duration: X.Xh"
- Each area now shows its specific duration instead of global duration

#### Main Heading:
- Updated from "Based on Actual Production Duration" 
- To "Area-Specific Duration Calculations"

#### Footer Explanation:
- Updated to explain area-specific calculation method
- "Each area uses its configured start time → last item time for duration calculation"

### 4. Dependencies Updated
Added area start times to the useMemo dependencies:
```typescript
}, [productionSummary, totalSegregatedWeight, mangleStartTime, dobladoStartTime, segregationStartTime]);
```

## Benefits

1. **More Accurate Rates**: Each production area gets its own precise rate calculation
2. **Independent Tracking**: Areas that start at different times or have different productivity patterns are tracked separately  
3. **Flexible Start Times**: Each area can have its own configured start time from localStorage
4. **Real-Time Updates**: Duration calculations update as new items are processed in each area

## Future Enhancements

1. **Segregation Timestamps**: Replace current time with actual last segregation item timestamp when available
2. **Area Pauses**: Handle production pauses or breaks per area
3. **Historical Comparison**: Compare area-specific rates to historical averages

## Configuration
Start times are read from localStorage:
- `mangleStartTime` (default: '08:00')
- `dobladoStartTime` (default: '08:00') 
- `segregationStartTime` (default: '08:00')

## Testing Recommendations
1. Verify different start times produce different durations
2. Test with areas that have no production (0 items)
3. Confirm minimum duration enforcement works
4. Check that rates update correctly as new items are added to specific areas
