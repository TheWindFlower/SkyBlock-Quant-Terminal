# SkyBlock Bazaar Analyzer - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [Detailed File Documentation](#detailed-file-documentation)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Key Features](#key-features)
6. [API Integration](#api-integration)
7. [State Management](#state-management)
8. [Utility Functions](#utility-functions)
9. [Component Hierarchy](#component-hierarchy)
10. [Styling Conventions](#styling-conventions)
11. [How to Edit/Extend](#how-toeditextend)

---

## Project Overview

**SkyBlock Bazaar Analyzer** is a React-based web application designed to analyze and find profitable trading opportunities in Hypixel SkyBlock's Bazaar. It provides real-time data analysis for:

- **Crafting Profitability**: Calculates profit from crafting items vs buying from bazaar
- **Pure Bazaar Flips**: Identifies items with profitable buy/sell spreads
- **NPC Flips**: Finds items profitable to buy from bazaar and sell to NPCs
- **Shard Fusion**: Analyzes shard fusion recipes for profit optimization

The application fetches live data from Hypixel's API and processes it to display actionable trading insights with various filters and sorting options.

### Technologies Used
- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Concurrency**: Web Workers for heavy computations
- **APIs**: Hypixel SkyBlock Bazaar API, NPC Price API, Shard Fusion Data

---

## File Structure

```
skyblock-bazaar-analyzer/
├── public/                  # Static assets
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Main application component & state
│   ├── index.css           # Global styles
│   ├── recipes.json        # Crafting recipes database (693KB)
│   │
│   ├── components/
│   │   ├── Header.jsx         # Top header with search & refresh
│   │   ├── FilterMenu.jsx     # Filter controls panel
│   │   ├── DataTable.jsx      # Crafting pipeline results table
│   │   ├── SimpleFlipTable.jsx # Pure bazaar flip results
│   │   ├── NpcFlipTable.jsx   # NPC flip opportunities table
│   │   ├── ShardFusionTable.jsx # Shard fusion analysis
│   │   └── ScatterChart.jsx    # Visual profit/volume scatter plot
│   │
│   ├── utils/
│   │   ├── helpers.js       # Utility functions (formatting, parsing)
│   │   └── TrendArrow.jsx    # Price trend indicator component
│   │
│   └── workers/
│       └── shardWorker.js    # Web Worker for shard fusion calculations
│
├── package.json
├── vite.config.js
├── index.html
└── DOCUMENTATION.md         # This file
```

---

## Detailed File Documentation

###  `main.jsx` - Entry Point

**Purpose**: Initializes the React application and renders the main App component.

**Key Functions**:
- Creates React root element
- Wraps App in StrictMode for development error checking
- Mounts to DOM element with id "root"

**Dependencies**: 
- React, ReactDOM
- App.jsx
- index.css

---

###  `App.jsx` - Main Application Component

**Purpose**: The heart of the application. Manages all global state, data fetching, processing, and tab navigation.

**State Management**:
```javascript
// Data States
- bazaarData: Object containing all bazaar product data
- npcPrices: Object mapping item IDs to NPC sell prices
- loading: Boolean for API fetch status

// UI States
- activeTab: Current view ('crafting', 'bazaar', 'npc', 'shards')
- activeNpcTab: Sub-tab for NPC view ('craft', 'flip', 'instant')
- searchTerm: Text filter for item names
- expandedItem: Currently expanded row ID
- hiddenItems: Array of item IDs user has hidden
- showHiddenManager: Toggle for hidden items manager

// Filter States
- limit: Max results to display (default: 50)
- minProfit: Minimum profit threshold
- minBuyOrders/minSellOrders: Minimum order count
- minBuyVolume/minSellVolume: Minimum trading volume
- maxCraftDepth: Recursion depth for ingredient cost resolution (1-3)
- maxFlipTime: Maximum acceptable flip time
- minMarginPct/maxMarginPct: Profit margin range
```

**Constants**:
- `BAZAAR_API_URL`: Hypixel Bazaar API endpoint
- `NPC_PRICE_API_URL`: Hypixel items API endpoint
- `MAX_ORDER_LIMIT`: 71680 (Hypixel's maximum order size)

**Data Fetching Functions**:

#### `fetchBazaarData()`
- Fetches data from Hypixel Bazaar API every 45 seconds
- Stores snapshot of previous prices in `prevPricesRef` for trend detection
- Updates `bazaarData` state with product information
- Error handling with user feedback

#### `fetchNpcPrices()`
- Fetches NPC sell prices from Hypixel items API
- Creates a lookup map of item IDs to prices
- One-time fetch on component mount

**Core Processing Functions**:

#### `resolveIngredientCost(ingId, depth, maxDepth)`
- **Purpose**: Recursively resolves the true cost of an ingredient by checking if it's cheaper to craft or buy
- **Parameters**:
  - `ingId`: The ingredient's Hypixel ID
  - `depth`: Current recursion depth
  - `maxDepth`: Maximum recursion depth (from filters)
- **Returns**: The lowest possible cost per unit
- **Logic**: 
  1. Gets market price from bazaar
  2. If at max depth, returns market price
  3. Finds recipe for the ingredient
  4. Recursively resolves costs of sub-ingredients
  5. Returns minimum of craft cost or market price

#### `getRawLeafCount(ingId, ingCount, depth, maxDepth)`
- **Purpose**: Calculates how many raw leaf ingredients are needed per craft
- **Used for**: Determining max batch size based on the 71,680 order limit
- **Returns**: Maximum raw ingredient count needed

#### `processCraftingItems()`
- **Purpose**: Main processing function for crafting pipeline analysis
- **Process**:
  1. Iterates through all recipes from `recipes.json`
  2. For each recipe, resolves ingredient costs recursively
  3. Calculates crafting cost per unit
  4. Computes profitability for both bazaar and NPC selling
  5. Determines best selling option
  6. Calculates liquidity, flip time, volume metrics
  7. Detects price trends vs previous snapshot
- **Returns**: Array of processed crafting opportunities

#### `processBazaarFlips()`
- **Purpose**: Finds profitable pure bazaar flips (buy order → sell offer)
- **Process**:
  1. Iterates through all bazaar products
  2. For each, gets best buy order and sell offer prices
  3. Calculates net profit (after 1.25% bazaar tax)
  4. Computes buying score (profit × volume)
  5. Calculates flip time based on weekly volume
  6. Applies filters and sorts by buying score
- **Returns**: Sorted array of bazaar flip opportunities

#### `processNpcFlips()`
- **Purpose**: Finds all NPC flip opportunities (3 types)
- **Includes**:
  1. **Craft → NPC**: Craft items and sell to NPC
  2. **Buy Order → NPC**: Buy from bazaar buy orders, sell to NPC
  3. **Instant Buy → NPC**: Use instant buy, sell to NPC
- **Returns**: Combined and filtered array of NPC opportunities

**Render Logic**:
- Displays different table components based on `activeTab`
- Passes processed data and state management functions to child components
- Includes tab navigation with counts

---

###  `components/` - UI Components

####  `Header.jsx`

**Purpose**: Top header bar with title, search, refresh button, and hidden items manager.

**Props**:
```javascript
{
  loading: boolean,           // API loading state
  searchTerm: string,        // Current search text
  setSearchTerm: function,   // Update search
  fetchBazaarData: function, // Trigger data refresh
  hiddenItems: array,        // List of hidden item IDs
  setHiddenItems: function,  // Update hidden items
  showHiddenManager: boolean,// Show/hide manager
  setShowHiddenManager: func,
  unhideItem: function       // Remove item from hidden list
}
```

**Features**:
- Title: "SkyBlock Quant Terminal"
- Search input with placeholder "Query matrix..."
- Refresh button with loading state "Syncing..." / "Refresh Engine"
- Hidden items management panel with:
  - Toggle button showing count
  - List of hidden items with unhide buttons
  - "Restore All Items" button

**Styling**: Dark theme with zinc color palette, Tailwind classes

---

####  `FilterMenu.jsx` (Exported as TopBar)

**Purpose**: Provides filter controls for data tables.

**Props**:
```javascript
{
  filters: object,            // Current filter values
  handleFilterChange: func   // Update filter function
}
```

**Controls**:
- **Numeric Filters**:
  - Max Output Limit
  - Min Profit Threshold
  - Min Buy Order Array
  - Min Sell Order Array
  - Min Raw Buy Volume
  - Min Raw Sell Volume
  - Max Craft Depth (1-3)
  - Max Flip Time
- **Range Filters**:
  - Margin Range % (min/max)
  - Batch Range (min/max)

**Component Structure**:
- `range()` helper function: Creates min/max input pairs
- Uses `useSortableData` hook for consistent sorting behavior

**Styling**: Grouped in a card with "Execution Parameters" title, grid layout

---

####  `DataTable.jsx` - Crafting Pipeline Table

**Purpose**: Displays crafting profitability data with expandable ingredient details.

**Props**:
```javascript
{
  displayedData: array,      // Processed crafting items
  activeTab: string,        // Current active tab
  expandedItem: string|null, // Currently expanded item ID
  setExpandedItem: function, // Toggle expansion
  hideItem: function         // Hide an item
}
```

**Features**:

**Custom Hooks**:
- `useSortableData(data, defaultKey)`: Manages sort state and provides sorted data
- Returns: `{ sorted, sortConfig, toggle }`

**Sub-components**:

1. **SortTh** - Sortable table header cell
   - Props: label, colKey, sortConfig, toggle, className, title
   - Shows sort direction arrows (↑↓) or neutral (↕)
   - Hover effect with tooltip

2. **VolumeCell** - Cell with hover tooltip showing volume breakdown
   - Displays total liquidity
   - On hover: Shows buy/sell volume split
   - Styled with dashed underline

**Table Columns**:
1. Asset Identifier (sticky, left-aligned)
2. Profit (1x) - with trend arrow
3. Max Order Profit
4. Execution Speed - FAST/MODERATE/STAGNANT badge
5. Flip Time - time estimate badge
6. Margin %
7. Unit Capital (craft cost)
8. Exposure (total batch cost)
9. Volume - with hover breakdown
10. Vol Δ (volume delta)
11. NPC Price
12. NPC Profit

**Row Features**:
- Click to expand for ingredient details (crafting tab only)
- Hide button on hover
- Color coding: profitable (emerald) vs loss (red)
- NPC indicator badge when NPC is better option
- Speed and flip time badges with color coding

**Expanded Row Content**:
- **Capital Curve**: SVG visualization of cost vs value
- **Batch Summary**: 
  - Max batch crafts count
  - Batch cost
  - Bazaar profit
  - NPC profit (if available)
- **Ingredients Table**:
  - Component name (expandable if crafted)
  - Quantity (1x and batch)
  - Unit price
  - Batch cost
  - Liquidity/volume
- **Sub-Craft Components**: Recursively shows ingredients of ingredients
- **Raw Leaf Summary**: Shows total raw materials needed

**Styling**: Dark theme, sticky first column, alternating row colors, expandable rows

---

####  `SimpleFlipTable.jsx` - Pure Bazaar Flips

**Purpose**: Displays pure bazaar flip opportunities (buy order → sell offer).

**Props**:
```javascript
{
  displayedData: array  // Processed bazaar flip items
}
```

**Constants**:
- `MAX_ORDER`: 71680 (same as MAX_ORDER_LIMIT)

**Custom Hooks**:
- `useSortableData` - same as in DataTable

**Sub-components**:

1. **MiniPriceChart** - Simulated price movement visualization
   - Generates sine-wave-like price fluctuations
   - Shows buy price (blue) and sell price (purple) lines
   - SVG-based, 220x80 viewBox

2. **AssetCell** - Item name with hover chart
   - Shows mini price chart on hover
   - Displays buy/sell prices
   - Position-aware (top or bottom placement)

3. **VolumeCell** - Same as in DataTable

**Table Columns**:
1. Asset Identifier
2. Margin (Spread)
3. Buying Score (profit × volume)
4. Volume (with hover breakdown)
5. Vol Δ (volume delta)
6. Flip Time - badge with color coding
7. Batch Profit (71K) - profit for max order
8. Batch Cost (71K) - cost for max order
9. Buy Order Price (with trend)
10. Sell Offer Price (with trend)

**Styling**: Similar to DataTable but without expandable rows

---

####  `NpcFlipTable.jsx` - NPC Flip Opportunities

**Purpose**: Displays opportunities to buy from bazaar and sell to NPCs.

**Props**:
```javascript
{
  displayedData: array,      // NPC flip items
  activeNpcTab: string,      // 'craft', 'flip', or 'instant'
  setActiveNpcTab: function, // Change sub-tab
  counts: object            // Count of items in each category
}
```

**State**:
- `expandedItem`: Currently expanded craft item
- `expandedIngredient`: Currently expanded ingredient
- `markedTrades`: Set of item IDs marked for active trade planning
- `customAmounts`: User-defined quantities for custom calculations

**Custom Hooks**:
- `useSortableData` - for sorting table data

**Sub-components**:

1. **VolumeCell** - Same volume display with hover

2. **CustomAmountCell** - Input for custom quantity calculations
   - Shows input field
   - Displays calculated profit and cost for custom quantity
   - Prevents click propagation

3. **InstantFlipTable** - Simplified table for instant buy → NPC
   - Displays all NPC flip types in a unified format
   - Includes star marking system
   - Custom quantity calculations

**Features**:

**Sub-tab Navigation**:
- Craft → NPC: Items profitable to craft then sell to NPC
- Buy Order → NPC: Buy from buy orders, sell to NPC
- Instant Buy → NPC: Instant buy from bazaar, sell to NPC

**Trade Planning**:
- Star button to mark trades for planning
- Active Trade Plan summary bar shows:
  - Number of marked items
  - Total profit across all marked trades
  - Total capital required
  - Combined ROI percentage
- Each marked item shows:
  - Item name with INSTANT/CRAFT badge
  - Custom quantity (if set)
  - Profit and cost
  - Remove button

**Table Columns** (Craft/Buy Order tabs):
1. Star marker
2. Asset Identifier (sticky)
3. NPC Price
4. Buy/Craft Cost
5. Profit (1x)
6. Margin %
7. Batch Size
8. Batch Profit
9. Batch Cost
10. Custom Qty / Profit
11. Volume (with hover)
12. Vol Δ

**Expanded Row Content** (for craft items):
- Fusion summary with output details
- Capital curve visualization
- Batch statistics
- Ingredients table with sub-craft expansion
- Raw leaf summaries
- Custom quantity calculations

**Styling**: Similar to other tables with amber highlights for NPC-related values

---

####  `ShardFusionTable.jsx` - Shard Fusion Analysis

**Purpose**: Analyzes profitability of fusing shards in Hypixel SkyBlock.

**Props**:
```javascript
{
  bazaarData: object  // Bazaar data for price lookups
}
```

**Features**:
- Uses Web Worker (`shardWorker.js`) for heavy computations
- Loads shard fusion data from external GitHub repository
- Supports deep fusion analysis (recursive ingredient resolution)

**State**:
- `workerStatus`: Current worker state ('idle', 'loading', 'computing', 'ready', 'error')
- `statusMsg`: Status message for display
- `shardCount`: Number of loaded shards
- `results`: Array of fusion opportunities
- `expandedItem`: Currently expanded fusion item
- `expandedIngredient`: Currently expanded ingredient

**Mode Settings**:
- `inputMode`: 'buy_order' or 'instabuy' - how to acquire input shards
- `outputMode`: 'sell_order' or 'instasell' - how to sell output shards
- `craftDepth`: 0-3 - depth of recursive crafting resolution

**Filter States**:
- `minProfit`, `minMargin`, `minOutVol`, `minIn1Vol`, `minIn2Vol` - minimum thresholds
- `searchTerm` - text filter for shard names

**Constants**:
- `RARITY_COLORS`: Color scheme for different shard rarities (common, uncommon, rare, epic, legendary, mythic)
- `MAX_ORDER_LIMIT`: 71680

**Sub-components**:

1. **LoadingPanel** - Displayed while loading fusion data
   - Animated spinner with dual rings
   - Status message with dots animation
   - Progress bar
   - Shard count display

2. **FusedIngRow** - Recursive ingredient row for expanded fusions
   - Shows shard name with rarity color
   - Displays prices (instabuy, buy order, fused cost)
   - Recursively renders sub-ingredients when expanded
   - Shows savings from fusion vs market price

3. **IngredientPanel** - Detailed view for expanded fusion item
   - Fusion summary with output details
   - Capital curve visualization
   - Cost, value, profit, and margin display
   - Ingredients table with recursive FusedIngRow

**Main Features**:

**Web Worker Integration**:
- Creates worker on mount
- Listens for messages:
  - 'LOADING': Loading status update
  - 'FUSION_DATA_LOADED': Data loaded successfully
  - 'COMPUTING': Computation in progress
  - 'RESULTS': Results ready
  - 'ERROR': Error occurred
- Sends messages:
  - 'LOAD_FUSION_DATA': Load fusion data
  - 'COMPUTE': Run computation with current parameters

**Computation**:
- Triggered when bazaarData or options change
- Debounced to avoid rapid re-computations
- Queues computation if data not yet loaded
- Fingerprints data to avoid unnecessary recomputations

**Controls Panel**:
- Input mode selector (Buy Order / Insta-Buy)
- Output mode selector (Sell Order / Insta-Sell)
- Craft depth selector (Off, 1×, 2×, 3×)
- Search input
- Status indicators
- Volume and profit filters
- Active mode badges

**Table Columns**:
1. Fusion (sticky) - Shows input1 + input2 → output
2. Rarity - Output shard rarity
3. Total Cost
4. Value
5. Profit
6. Margin %
7. Out Price
8. Out Vol (7d volume)
9. In1 Vol
10. In2 Vol

**Row Features**:
- Click to expand for ingredient details
- DEEP badge when deep fusion is active
- Rarity color coding
- Profit/margin color coding

**Styling**: 
- Dark theme with violet/sky color accents
- Expandable rows with indentations for hierarchy
- Rarity-based color schemes

---

####  `ScatterChart.jsx` - Profit vs Volume Visualization

**Purpose**: Visualizes trading opportunities on a 2D scatter plot.

**Props**:
```javascript
{
  scatterItems: array,   // Items to display
  expandedItem: string    // Currently expanded item ID
}
```

**Features**:
- X-axis: 7d Market Depth (Volume/Velocity)
- Y-axis: Margin %
- Bubble size: Represents profit magnitude
- Tooltip on hover: Shows item name and margin %

**Visual Elements**:
- Grid lines at 50% margin and median volume
- Dashed lines for axis references
- Color coding: White circles for highlighted items, gray for others
- Small white dot in center of each bubble for visibility

**Styling**: 
- SVG-based, 600×220 viewBox
- Dark background with zinc borders
- Top-right quadrant indicates high volume + high yield items

---

###  `utils/` - Utility Components

####  `helpers.js` - Utility Functions

**Purpose**: Collection of helper functions used throughout the application.

**Functions**:

1. **`cleanColorCodes(text)`**
   - **Purpose**: Removes Minecraft color codes (§ followed by character)
   - **Input**: String with potential color codes
   - **Output**: Clean string without color codes
   - **Example**: `"§aEmerald"` → `"Emerald"`

2. **`parseCompactNumber(input)`**
   - **Purpose**: Parses user input with compact number format (k, m, b)
   - **Input**: String like "100", "1.5k", "2m", "1b"
   - **Output**: Number (100, 1500, 2000000, 1000000000)
   - **Cases**: k=1000, m=1000000, b=1000000000

3. **`formatNum(num)`**
   - **Purpose**: Formats numbers with appropriate suffixes
   - **Input**: Number
   - **Output**: Formatted string
   - **Cases**:
     - ≥1B: "1.0B"
     - ≥1M: "1.0M"
     - ≥1K: "1.0K"
     - Otherwise: locale-formatted number
   - **Safety**: Handles undefined, null, NaN by returning "0"

4. **`parseFlipTime(input)`**
   - **Purpose**: Parses time input with units (h, d, w)
   - **Input**: String like "10", "2h", "3d", "1w"
   - **Output**: Number of hours
   - **Cases**: h=hours, d=days (×24), w=weeks (×168)
   - **Default**: Returns Infinity if invalid

---

####  `TrendArrow.jsx` - Price Trend Indicator

**Purpose**: Simple component to display price trend direction.

**Props**:
```javascript
{
  trend: string  // 'up', 'down', or any other value
}
```

**Display**:
- `up`: ▲ (emerald green)
- `down`: ▼ (red)
- Other: null (nothing displayed)

**Styling**: 
- Small font size (10px)
- Margin-left (0.5)
- Emerald for up, red for down

---

###  `workers/` - Web Workers

####  `shardWorker.js` - Shard Fusion Computation Worker

**Purpose**: Runs computationally intensive shard fusion calculations in a background thread to prevent UI blocking.

**Features**:
- Runs in Web Worker context (no React, no DOM)
- Fetches fusion data from external URL
- Performs recursive cost resolution for deep fusion analysis

**Constants**:
- `FUSION_DATA_URL`: GitHub URL for fusion data JSON

**Functions**:

1. **`getShardPrices(bazaarData, internalId)`**
   - Extracts price data for a specific shard
   - Returns: instabuy, buyOrder, sellOrder, instasell, buyVol, sellVol

2. **`makeResolver(bazaarData, inputMode, cache)`**
   - Creates a memoized recursive resolver function
   - Uses cache to prevent exponential computation
   - **Key**: `${shardCode}:${depth}`
   - Recursively resolves shard costs by checking fusion recipes
   - Returns minimum of craft cost or market price

3. **`compute({ bazaarData, inputMode, outputMode, craftDepth })`**
   - Main computation function
   - Iterates through all shard fusion recipes
   - For each recipe:
     - Gets prices for input and output shards
     - Resolves input costs (with optional deep fusion)
     - Calculates craft cost, output value, profit
     - Filters unprofitable fusions
   - Returns array of profitable fusion opportunities

**Message Handling**:

Listens for messages with `self.onmessage`:

- **'LOAD_FUSION_DATA'**:
  - Fetches fusion data from URL
  - Posts status updates
  - Posts 'FUSION_DATA_LOADED' with shard count and data
  - Posts 'ERROR' on failure

- **'COMPUTE'**:
  - Runs compute() with payload
  - Posts 'COMPUTING' status
  - Posts 'RESULTS' with computed data
  - Posts 'ERROR' on failure

**Communication Pattern**:
- Uses `self.postMessage()` to send messages to main thread
- Messages include `type` and `payload` fields
- Main thread handles results and updates UI

---

## Data Flow Architecture

### Data Fetching Pipeline

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Component     │────▶│   useEffect Hook    │────▶│  Hypixel API    │
│   Mount         │     │   (fetch functions) │     │  (Bazaar/NPC)   │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                              │                          │
                              ▼                          ▼
                     ┌─────────────────┐   ┌─────────────────┐
                     │  setBazaarData  │   │   setNpcPrices  │
                     │  (React State)  │   │   (React State) │
                     └─────────────────┘   └─────────────────┘
                              │                          │
                              └──────────┬───────────────┘
                                         ▼
                                ┌──────────────────┐
                                │ Process Functions│
                                │ (processCrafting,│
                                │  processBazaar,  │
                                │  processNpc)     │
                                └──────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ Displayed Data  │
                                │ (Filtered &     │
                                │  Sorted)        │
                                └─────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   Table         │
                                │   Components    │
                                └─────────────────┘
```

### Crafting Data Processing Flow

```
RECIPES_DB (recipes.json)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  processCraftingItems()                                 │
│  1. For each recipe:                                    │
│     a. Get target product data from bazaarData          │
│     b. For each ingredient:                             │
│        - Resolve cost (market or craft)                 │
│        - Calculate batch quantities                     │
│        - Determine if crafting is better than buying    │
│     c. Calculate total craft cost per unit              │
│     d. Calculate profitability (bazaar & NPC)           │
│     e. Determine best selling option                    │
│     f. Calculate liquidity and volume metrics           │
│     g. Detect price trends                              │
└─────────────────────────────────────────────────────────┘
    │
    ▼
Processed Items Array
    │
    ▼
applyFilters() → Filtered Array
    │
    ▼
useSortableData() → Sorted Array
    │
    ▼
DataTable Component
```

### Recursive Cost Resolution

```
resolveIngredientCost(ingId, depth, maxDepth)
    │
    ├── Get marketPrice from bazaarData
    │
    ├── If depth >= maxDepth: return marketPrice
    │
    ├── Find recipe for ingId in RECIPES_DB
    │
    ├── If no recipe: return marketPrice
    │
    ├── For each sub-ingredient:
    │       ▼
    │   resolveIngredientCost(subIng.id, depth+1, maxDepth)
    │       │
    │       ▼
    │   Calculate subCraftCost = Σ(subPrice * subCount)
    │
    ├── craftCostPerUnit = subCraftCost / outputCount
    │
    ├── Return min(craftCostPerUnit, marketPrice)
    │   (Only if craftCostPerUnit > 0 and < marketPrice)
    │
    ▼
Returns lowest possible cost
```

### Shard Fusion Processing (Worker)

```
┌─────────────────────────────────────────────────────────────┐
│  Main Thread                                                │
│  ┌─────────────────┐    POST MESSAGE     ┌────────────────┐ │
│  │ ShardFusionTable│────────────────────▶│   Worker       │ │
│  │ Component       │  {type, payload}    │   (shardWorker)│ │
│  └─────────────────┘                     └───────┬────────┘ │
│                                                  │          │
│                                                  ▼          │
│  ┌─────────────────┐    POST MESSAGE     ┌───────┴────────┐ │
│  │ Wait for        │◀────────────────────│  Handle        │ │
│  │ Results         │   type: 'RESULTS'   │  Message       │ │
│  └─────────────────┘                     │  ┌───────────┐ │ │
│                                          │  │ LOAD_DATA │ │ │
│                                          │  │ COMPUTE   │ │ │
│                                          │  └───────────┘ │ │
│                                          └────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Worker Process:
1. Receive LOAD_FUSION_DATA message
2. Fetch fusion data from GitHub
3. Parse and store data
4. Post FUSION_DATA_LOADED message
5. 
6. Receive COMPUTE message with bazaarData and options
7. Run compute() function:
   a. For each shard fusion recipe
   b. Resolve input costs (with depth)
   c. Calculate profit
   d. Filter profitable fusions
8. Post RESULTS message with array of opportunities
```

---

## Key Features

### 1. Multi-Tab Interface
- **Crafting Pipeline**: Shows items profitable to craft
- **Pure Orders**: Shows profitable buy/sell order spreads
- **NPC Flips**: Shows items profitable to sell to NPCs
- **Shard Fusion**: Shows profitable shard fusion combinations

### 2. Real-Time Data
- Automatic refresh every 45 seconds
- Manual refresh button
- Previous price tracking for trend detection

### 3. Advanced Filtering
- Profit thresholds
- Volume requirements
- Margin percentages
- Craft depth (1-3 levels)
- Flip time limits
- Search by name
- Hide individual items

### 4. Sorting & Organization
- Click any column header to sort
- Toggle between ascending/descending
- Default sorts by profit (highest first)
- Multiple sort configurations per table

### 5. Expandable Details
- Click rows to expand ingredient details
- Recursive expansion for nested crafts
- Sub-component breakdowns
- Batch calculations

### 6. Trade Planning (NPC Tab)
- Mark trades with star system
- Active trade plan summary
- Custom quantity calculations
- Combined profit/capital metrics
- Persistent marked items

### 7. Deep Analysis
- Recursive ingredient cost resolution
- Raw leaf counting for batch limits
- Multi-level crafting depth (up to 3)
- Sub-ingredient profitability

### 8. Visual Indicators
- Color-coded profitability (green/red)
- Trend arrows (up/down/flat)
- Speed badges (FAST/MODERATE/STAGNANT)
- Rarity colors for shards
- Margin percentage highlights

### 9. Volume Analytics
- 7-day volume tracking
- Buy vs sell volume comparison
- Volume delta display
- Hover tooltips with breakdowns
- Flip time calculations based on volume

### 10. Batch Calculations
- Maximum order size (71,680)
- Batch profit/cost calculations
- Batch size optimization
- Capital exposure metrics

---

## API Integration

### Hypixel Bazaar API

**Endpoint**: `https://api.hypixel.net/v2/skyblock/bazaar`

**Response Structure**:
```javascript
{
  success: boolean,
  lastUpdated: number,
  products: {
    [productId]: {
      quick_status: {
        buyPrice: number,      // Current buy price
        sellPrice: number,     // Current sell price
        buyVolume: number,    // Current buy volume
        sellVolume: number,   // Current sell volume
        buyMovingWeek: number, // Buy volume (7d)
        sellMovingWeek: number // Sell volume (7d)
        // ...
      },
      buy_summary: [         // Top buy offers
        { pricePerUnit: number, amount: number, orders: number }
      ],
      sell_summary: [        // Top sell offers
        { pricePerUnit: number, amount: number, orders: number }
      ]
      // ...
    }
  }
}
```

**Data Used**:
- `quick_status.buyPrice` / `sellPrice`: Current prices
- `buy_summary[0].pricePerUnit`: Best buy order price
- `sell_summary[0].pricePerUnit`: Best sell offer price
- `quick_status.buyMovingWeek` / `sellMovingWeek`: 7-day volumes
- `quick_status.buyOrders` / `sellOrders`: Current order counts
- `quick_status.buyVolume` / `sellVolume`: Current volumes

**Update Frequency**: Every 45 seconds (45000ms)

---

### Hypixel NPC Price API

**Endpoint**: `https://api.hypixel.net/resources/skyblock/items`

**Response Structure**:
```javascript
{
  success: boolean,
  lastUpdated: number,
  items: [
    {
      id: string,             // Item ID
      npc_sell_price: number, // NPC sell price (0 if not sold)
      // ... other fields
    }
  ]
}
```

**Data Used**:
- `id`: Item identifier (matches bazaar product IDs)
- `npc_sell_price`: Price NPC pays for the item

**Update Frequency**: Once on component mount

---

### External Shard Fusion Data

**URL**: `https://raw.githubusercontent.com/HichamIDDIR/Hypixel-Skyblock-Shards-Profit-Tracker/refs/heads/main/fusion-data.json`

**Structure**:
```javascript
{
  shards: {
    [shardCode]: {
      name: string,
      internal_id: string,    // Matches bazaar item ID
      rarity: string,         // common, uncommon, rare, epic, legendary, mythic
      fuse_amount: number     // Amount needed for fusion
    }
  },
  recipes: {
    [outputShardCode]: {
      [outputQuantity]: [
        [input1Code, input2Code]
      ]
    }
  }
}
```

**Size**: ~1.8MB
**Loading**: Once on ShardFusionTable mount, via Web Worker

---

## State Management

### Global State (App.jsx)

The application uses React's `useState` and `useRef` hooks for state management:

**useState Hooks** (Reactive, triggers re-renders):
- Data: `bazaarData`, `npcPrices`
- UI: `loading`, `activeTab`, `activeNpcTab`, `searchTerm`, `expandedItem`, `hiddenItems`, `showHiddenManager`
- Filters: `filters` object with all filter values

**useRef Hooks** (Non-reactive, for performance):
- `prevPricesRef`: Stores previous prices for trend detection (doesn't trigger re-renders)

**Pattern**: State is passed down to child components via props, with callback functions to update state.

### Component State

Each table component maintains its own state:

**DataTable**:
- `expandedIngredient`: Track which ingredient row is expanded
- Sorting state via `useSortableData`

**NpcFlipTable**:
- `expandedItem`, `expandedIngredient`: Expanded rows
- `markedTrades`: Set of marked item IDs
- `customAmounts`: User's custom quantities
- Sorting state

**ShardFusionTable**:
- `workerStatus`, `statusMsg`, `shardCount`: Worker status
- `results`: Computed fusion opportunities
- `expandedItem`, `expandedIngredient`: Expanded rows
- `inputMode`, `outputMode`, `craftDepth`: Mode settings
- `minProfit`, `minMargin`, etc.: Filter values
- `searchTerm`: Search text
- `fusionData`: Loaded fusion data

**SimpleFlipTable**:
- Sorting state only

### Data Processing Flow

1. **Fetch**: Data fetched from APIs on mount and interval
2. **Store**: Stored in React state
3. **Process**: Processing functions transform raw data into display-ready objects
4. **Filter**: `applyFilters` function filters based on user settings
5. **Sort**: `useSortableData` hook sorts the filtered data
6. **Slice**: Only first N items displayed (based on limit filter)
7. **Render**: Table components receive final display data

---

## Utility Functions

### helpers.js

All utility functions are exported individually and imported where needed.

**Usage Pattern**:
```javascript
import { cleanColorCodes, parseCompactNumber, formatNum } from './utils/helpers';
```

**Design Philosophy**:
- Pure functions (no side effects)
- Handle edge cases (null, undefined, NaN)
- Consistent return types
- Simple, focused responsibilities

### TrendArrow.jsx

A simple presentational component for displaying trends.

**Usage**:
```javascript
<TrendArrow trend={item.buyTrend} />
```

---

## Component Hierarchy

```
App
├── Header
│   └── (inputs, buttons, hidden manager)
│
├── FilterMenu (TopBar)
│   └── (filter inputs)
│
├── Tab Navigation
│   └── (crafting, bazaar, npc, shards buttons)
│
└── Active Tab Content
    ├── Crafting Tab: DataTable
    │   └── Expandable Rows
    │       ├── Capital Curve (SVG)
    │       ├── Batch Summary
    │       └── Ingredients Table
    │           └── Sub-Ingredients (recursive)
    │
    ├── Bazaar Tab: SimpleFlipTable
    │   └── Rows with MiniPriceChart (hover)
    │
    ├── NPC Tab: NpcFlipTable
    │   ├── Sub-Tabs (craft/flip/instant)
    │   ├── Marked Trades Summary
    │   └── InstantFlipTable (for instant tab)
    │       └── Rows with CustomAmountCell
    │
    └── Shards Tab: ShardFusionTable
        ├── LoadingPanel (while loading)
        ├── Controls Panel
        │   ├── Input Mode Selector
        │   ├── Output Mode Selector
        │   ├── Craft Depth Selector
        │   ├── Search
        │   └── Filters
        └── Results Table
            └── Expandable Rows
                └── IngredientPanel
                    └── FusedIngRow (recursive)

Web Worker (shardWorker.js)
└── Handles heavy computations independently
```

---

## Styling Conventions

### Color Palette

**Backgrounds**:
- Page: `#09090b` (very dark gray/black)
- Cards: `#121214` (slightly lighter)
- Elevated: `#18181b` (for headers, sticky elements)

**Text**:
- Primary: `#fafafa` (near white)
- Secondary: `zinc-400` (~#a1a1aa)
- Muted: `zinc-500` / `zinc-600`

**Accent Colors**:
- **Emerald** (`#34d399`): Profits, positive values, up trends
- **Red** (`#f87171`): Losses, negative values, down trends
- **Amber** (`#fbbf24`): NPC-related, warnings, moderate values
- **Sky Blue** (`#38bdf8`): Buy prices, water-related
- **Violet** (`#a78bfa`): Sell prices, magic/purple theme
- **Zinc** (`#71717a`): Neutral, borders, dividers

**Badges**:
- CRAFTED: Violet background, violet text
- NPC: Amber background, amber text
- INSTANT: Sky background, sky text
- FUSED: Violet background, violet text
- DEEP: Violet background, violet text
- ACTIVE: Amber background, amber text

### Spacing

Uses Tailwind's spacing scale consistently:
- `p-4`: Card padding
- `p-2.5`: Table cell padding
- `gap-4`: Gap between elements
- `space-y-6`: Vertical spacing between sections

### Typography

**Fonts**:
- Primary: `font-sans` (system sans-serif)
- Monospace: `font-mono` (for numbers, codes)

**Sizes**:
- Headers: `text-xl` (20px)
- Subheaders: `text-sm` (14px)
- Table text: `text-xs` (12px)
- Small labels: `text-[10px]` or `text-[11px]`
- Captions: `text-[9px]`

**Weights**:
- Normal: `font-normal` (400)
- Medium: `font-medium` (500)
- Semibold: `font-semibold` (600)
- Bold: `font-bold` (700)

### Borders

- Primary: `border-zinc-800` (dark gray)
- Dividers: `border-zinc-800/60` (60% opacity)
- Radius: `rounded-lg` (0.5rem) for cards, `rounded-md` (0.375rem) for inputs

### Shadows

- Cards: `shadow-sm` (small shadow)
- Overlays: `shadow-xl` (extra large)

### Transitions

- Hover: `hover:bg-zinc-900/60` (60% opacity on hover)
- Focus: `focus:ring-1 focus:ring-zinc-500`
- All: `transition-colors` for smooth color changes

---

## How to Edit/Extend

### Adding a New Feature

1. **Identify where it belongs**:
   - New tab? Add to App.jsx tab navigation
   - New filter? Add to FilterMenu.jsx
   - New data processing? Add to App.jsx processing functions
   - New table? Create a new component in `components/`

2. **Add state** (if needed):
   ```javascript
   const [newState, setNewState] = useState(initialValue);
   ```

3. **Add UI controls** (if needed):
   - Add inputs/buttons to appropriate component
   - Connect to state via props

4. **Add data processing** (if needed):
   - Add processing function in App.jsx
   - Or create a custom hook

5. **Add display** (if needed):
   - Create new component or modify existing
   - Pass data via props

### Modifying Existing Features

1. **Find the relevant component** using this documentation
2. **Understand the data flow** from the architecture section
3. **Make changes** to the appropriate file
4. **Test** the changes

### Adding New Filters

1. Add to `filters` state in App.jsx:
   ```javascript
   const [filters, setFilters] = useState({
     // ... existing filters
     newFilter: 'defaultValue',
   });
   ```

2. Add control in FilterMenu.jsx:
   ```javascript
   { label: 'New Filter', id: 'newFilter' }
   ```

3. Apply filter in `applyFilters` function in App.jsx:
   ```javascript
   if (filters.newFilter !== '' && item.someProperty !== parseSomething(filters.newFilter)) {
     return false;
   }
   ```

### Adding New Columns to Tables

1. Add data property in processing function (App.jsx)
2. Add column header in table component:
   ```javascript
   <SortTh label="New Column" colKey="newProperty" {...sh} />
   ```
3. Add cell in row render:
   ```javascript
   <td className="...">{item.newProperty}</td>
   ```

### Working with Web Worker

1. **Modify worker** (shardWorker.js):
   - Add new computation logic
   - Add new message types

2. **Update main thread** (ShardFusionTable.jsx):
   - Add message handlers
   - Update message sending

### Styling Changes

1. **Find the component** with the styling to change
2. **Modify Tailwind classes** directly in the JSX
3. **Test** the visual changes
4. **Consider dark theme**: All colors work in dark mode

### Adding New Data Sources

1. **Add API endpoint** constant in App.jsx or relevant component
2. **Add fetch function**:
   ```javascript
   const fetchNewData = async () => {
     try {
       const res = await fetch(NEW_API_URL);
       const data = await res.json();
       if (data.success) {
         setNewData(data);
       }
     } catch (err) {
       console.error(err);
     }
   };
   ```
3. **Call fetch** in useEffect or on user action
4. **Process and use** the data

### Debugging Tips

1. **Console logging**: Add `console.log()` to see data at various stages
2. **React DevTools**: Inspect component props and state
3. **Check API responses**: Verify data is being fetched correctly
4. **Validate processing**: Ensure processing functions return expected data
5. **Verify filters**: Check that filtering logic works as intended

### Performance Considerations

1. **Memoization**: Use `useMemo` for expensive calculations
2. **Debouncing**: Use `setTimeout` for rapid updates (like search)
3. **Web Workers**: Move heavy computations to workers
4. **Virtualization**: Consider for very large lists (not currently implemented)
5. **Cache**: Cache API responses when appropriate

### Testing Changes

1. **Manual testing**: Use the application and verify behavior
2. **Edge cases**: Test with empty data, extreme values, etc.
3. **Browser console**: Check for errors and warnings
4. **Responsive testing**: Test on different screen sizes

---

## Summary

This documentation provides a comprehensive guide to understanding and editing the SkyBlock Bazaar Analyzer project. The application is built with React and provides sophisticated analysis of Hypixel SkyBlock's Bazaar trading opportunities.

### Quick Reference

| Component | Purpose | File |
|-----------|---------|------|
| App | Main state & logic | `App.jsx` |
| Header | Top bar with search | `Header.jsx` |
| Filters | Filter controls | `FilterMenu.jsx` |
| Crafting | Crafting profitability | `DataTable.jsx` |
| Bazaar | Buy/sell spreads | `SimpleFlipTable.jsx` |
| NPC | NPC flip opportunities | `NpcFlipTable.jsx` |
| Shards | Shard fusion analysis | `ShardFusionTable.jsx` |
| Chart | Scatter plot visualization | `ScatterChart.jsx` |
| Helpers | Utility functions | `utils/helpers.js` |
| Trend | Trend indicator | `utils/TrendArrow.jsx` |
| Worker | Background computations | `workers/shardWorker.js` |

### File Sizes (Lines of Code)
- App.jsx: 540 lines
- DataTable.jsx: 358 lines
- NpcFlipTable.jsx: 595 lines
- ShardFusionTable.jsx: 764 lines
- SimpleFlipTable.jsx: 208 lines
- Header.jsx: 64 lines
- FilterMenu.jsx: 71 lines
- ScatterChart.jsx: 48 lines
- helpers.js: 45 lines
- TrendArrow.jsx: 5 lines
- shardWorker.js: 187 lines

### Key Data Files
- `recipes.json`: 693KB of crafting recipes
- Shard fusion data: ~1.8MB (loaded externally)

---

*Documentation generated for SkyBlock Bazaar Analyzer*
*Last updated: Project analysis date*
