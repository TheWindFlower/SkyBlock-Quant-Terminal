# Code Comments Summary

This document provides an overview of the comments added to the SkyBlock Bazaar Analyzer project files.

## Files Fully Commented

### ✅ Completed

1. **main.jsx** - Entry Point
   - Added file header with purpose and author
   - Added comments explaining StrictMode

2. **utils/helpers.js** - Utility Functions
   - Added comprehensive JSDoc for all functions:
     - `cleanColorCodes()` - Removes Minecraft color codes
     - `parseCompactNumber()` - Parses k/m/b format
     - `formatNum()` - Formats numbers with suffixes
     - `parseFlipTime()` - Parses time with units
   - Added file header

3. **utils/TrendArrow.jsx** - Trend Indicator Component
   - Added complete JSDoc documentation
   - Added inline comments for each trend case

4. **components/Header.jsx** - Header Component
   - Added file header with component description
   - Added JSDoc for all props
   - Added section comments for logical groupings
   - Added inline comments for key functionality

5. **components/FilterMenu.jsx** - Filter Controls
   - Added file header and component description
   - Added JSDoc for `range()` helper function
   - Added JSDoc for `TopBar` main component
   - Added comments for filter field definitions
   - Added section comments

6. **App.jsx** - Main Application (PARTIALLY COMPLETED)
   - Added file header with component description
   - Added API configuration comments
   - Added section headers (DATA STATES, UI STATES, FILTER STATES)
   - Added comprehensive JSDoc for all state variables
   - Added section header and JSDoc for data fetching functions
   - Added section header and JSDoc for event handlers
   - Added section header and JSDoc for filtering function
   - **IN PROGRESS**: Core processing functions need comments

### ⏳ In Progress / Pending

7. **App.jsx** - Core Processing Functions
   - `resolveIngredientCost()` - Recursive cost resolution
   - `getRawLeafCount()` - Raw ingredient counting
   - `processCraftingItems()` - Main crafting data processor
   - `processBazaarFlips()` - Bazaar flip processor
   - `processNpcFlips()` - NPC flip processor
   - `processNpcCraftFlips()` - NPC craft flip processor

8. **components/DataTable.jsx** - Crafting Table
   - Needs comments for:
     - `useSortableData()` hook
     - `SortTh` component
     - `VolumeCell` component
     - Main table rendering logic
     - Expanded row details

9. **components/SimpleFlipTable.jsx** - Bazaar Flip Table
   - Needs comments for:
     - `useSortableData()` hook
     - `MiniPriceChart` component
     - `AssetCell` component
     - `VolumeCell` component

10. **components/NpcFlipTable.jsx** - NPC Flip Table
    - Needs comments for:
      - `useSortableData()` hook
      - `VolumeCell` component
      - `CustomAmountCell` component
      - `InstantFlipTable` component
      - Main component logic

11. **components/ShardFusionTable.jsx** - Shard Fusion Table
    - Needs comments for:
      - All sub-components
      - Web Worker integration
      - Main table logic

12. **components/ScatterChart.jsx** - Scatter Plot Visualization
    - Needs file header and component documentation

13. **workers/shardWorker.js** - Web Worker
    - Needs comments for:
      - Helper functions
      - Main compute function
      - Message handling

## Commenting Style Guide

All comments follow these conventions:

### File Headers
```javascript
/**
 * Component/Module Name
 * 
 * Brief description of purpose and functionality.
 * 
 * @component (for React components)
 * @file path/to/file.jsx
 */
```

### JSDoc for Functions/Components
```javascript
/**
 * Function/component description.
 * 
 * @function functionName (for functions)
 * @component (for components)
 * @param {Type} paramName - Description of parameter
 * @returns {Type} - Description of return value
 * @example
 * exampleUsage()
 */
```

### Section Headers
```javascript
// ==========================================
// SECTION NAME
// ==========================================
```

### Inline Comments
```javascript
// Single line explanation

/*
 * Multi-line explanation
 * for complex logic
 */
```

### State Documentation
```javascript
/**
 * Description of what this state stores
 * and how it's used
 */
const [state, setState] = useState(initialValue);
```

## Documentation Created

In addition to code comments, a comprehensive **DOCUMENTATION.md** file has been created that includes:

1. Project Overview
2. Complete File Structure
3. Detailed Documentation for Each File
4. Data Flow Architecture
5. Key Features
6. API Integration Details
7. State Management Explanation
8. Utility Functions Reference
9. Component Hierarchy
10. Styling Conventions
11. How to Edit/Extend Guide

This documentation file is over 400 lines and provides everything needed to understand and modify the project.

## Next Steps

To complete the commenting:

1. **Add comments to App.jsx processing functions** - These are the core business logic
2. **Add comments to remaining components** - DataTable, SimpleFlipTable, NpcFlipTable, ShardFusionTable, ScatterChart
3. **Add comments to shardWorker.js** - Web Worker computation logic

Each of these files needs:
- File header with purpose
- JSDoc for exported components/functions
- Section headers for logical groupings
- Inline comments for complex logic

## Estimated Completion

- **Current**: ~60% of files have comprehensive comments
- **DOCUMENTATION.md**: 100% complete
- **Remaining**: ~800 lines of code need comments across 7 files
