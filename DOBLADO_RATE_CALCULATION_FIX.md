# Doblado Rate Calculation Fix

## Issue
The Doblado production rate was showing 10/hr when the total Doblado units were 3,886, which was clearly incorrect.

## Root Cause
**Data Source Mismatch**: 
- **Rate Calculation** was using `productionSummary.recentEntries` (limited dataset)
- **Chart Data** was using `productionSummary.allEntriesToday || productionSummary.recentEntries` (full dataset)

This meant the rate calculation was only considering a small subset of the actual production data, leading to artificially low rates.

## Solution
Updated the rate calculation to use the same data source as the charts:

### Before:
```typescript
const entries = productionSummary.recentEntries;
```

### After:
```typescript
const entries = productionSummary.allEntriesToday || productionSummary.recentEntries;
```

Also updated the condition check to properly handle both data sources:

### Before:
```typescript
if (!productionSummary || !productionSummary.recentEntries.length) {
```

### After:
```typescript
if (!productionSummary || (!productionSummary.allEntriesToday?.length && !productionSummary.recentEntries?.length)) {
```

## Expected Result
Now the Doblado rate should be calculated using all 3,886 units and show a much more accurate rate per hour, consistent with the actual production volume.

## Files Modified
- `/Users/ericperez/Desktop/react-app/src/components/DailyEmployeeDashboard.tsx`

## Impact
- **Mangle Rate**: Now calculated using full production data
- **Doblado Rate**: Now calculated using full production data  
- **Segregation Rate**: Remains using segregation data from Firebase
- **All Rates**: Now consistent with the total production numbers shown in charts
