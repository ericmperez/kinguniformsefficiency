# Production Classification Dashboard - Mangle/Doblado Split Implementation

## Overview
Successfully modified the Production Classification Dashboard to show Mangle vs Doblado classification percentages and counts in the hourly breakdown table instead of just total items added.

## Changes Made

### 1. **Updated Data Structure**
- Enhanced `hourlyData` interface to include:
  - `mangleItems`: Count of Mangle items per hour
  - `dobladoItems`: Count of Doblado items per hour  
  - `mangleUnits`: Total Mangle units per hour
  - `dobladoUnits`: Total Doblado units per hour

### 2. **Enhanced Data Processing**
- Added classification logic to hourly breakdown processing
- Each entry is now classified as Mangle or Doblado using `getClassification()` function
- Tracks both item counts and unit totals for each classification type

### 3. **Updated Table Display**
- **Column Header**: Changed from "Items Added" to "Mangle/Doblado Split"
- **Column Content**: Now shows:
  - Percentage badges: `M XX%` (green) and `D XX%` (yellow/orange)
  - Item counts below: `XM / XD` format
  - Tooltips show exact counts when hovering

### 4. **Enhanced Debug Logging**
- Updated console logs to include classification breakdowns
- Shows `mangleItems`, `dobladoItems`, `manglePercent`, `dobladoPercent` for each hour

## Display Format

The new column shows:
```
┌─────────────────────────┐
│  M 65%     D 35%       │ ← Percentage badges
│   13M / 7D             │ ← Item counts  
└─────────────────────────┘
```

- **Green badge (M)**: Mangle percentage and count
- **Yellow badge (D)**: Doblado percentage and count  
- **Tooltips**: Show exact item counts on hover
- **Small text**: Shows breakdown like "13M / 7D"

## Benefits

1. **Better Production Insights**: See the split between Mangle and Doblado work at each hour
2. **Visual Classification**: Color-coded badges make it easy to see which process dominates each hour
3. **Detailed Information**: Both percentages and raw counts are visible
4. **Consistent Styling**: Matches the existing dashboard design language

## Usage

- **Green badges**: Indicate Mangle items (items that go through mangle machines)
- **Yellow badges**: Indicate Doblado items (items that require manual folding)
- **Hover tooltips**: Show exact item counts for each category
- **Classification rules**: Based on product names (sheets, duvets → Mangle; others → Doblado)
- **Custom overrides**: Can be modified through the "Edit Classifications" modal

## Example Output

For an hour with 20 items total:
- 13 Mangle items (65%)
- 7 Doblado items (35%)

Display: `M 65%` `D 35%` with `13M / 7D` below

This provides immediate visibility into production workflow distribution throughout the day.
