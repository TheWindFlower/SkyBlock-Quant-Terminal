/**
 * Shard Fusion Table Component
 * 
 * This React component displays a sortable, filterable table of profitable shard fusion
 * opportunities in Hypixel SkyBlock. It uses a Web Worker to perform heavy computations
 * in the background, keeping the UI responsive.
 * 
 * Key Features:
 * - Real-time shard fusion profitability analysis
 * - Web Worker-based computation for performance
 * - Sortable columns by profit, margin, cost, volume, etc.
 * - Expandable rows showing detailed ingredient breakdowns
 * - Recursive display of deep fusion chains (when craftDepth > 0)
 * - Multiple price modes (buy order vs instabuy for inputs, sell order vs instasell for outputs)
 * - Filtering by profit, margin, and volume thresholds
 * - Search functionality to find specific shards
 * 
 * Component Structure:
 * - Main component: ShardFusionTable - Orchestrates worker, state, and rendering
 * - Helper hooks: useSortableData - Manages sorting state and logic
 * - Sub-components:
 *   - LoadingPanel: Shows loading spinner while data is being loaded
 *   - SortTh: Sortable table header cell component
 *   - FusedIngRow: Recursively displays fusion ingredient rows with expandable details
 *   - IngredientPanel: Detailed panel showing fusion summary and ingredient breakdown
 * 
 * @file components/ShardFusionTable.jsx
 * @requires React
 * @requires ../utils/helpers (for formatNum, parseCompactNumber)
 * @uses Web Worker: ../workers/shardWorker.js
 */
import React, { useState, useEffect, useRef } from 'react';
import { formatNum, parseCompactNumber, formatSellTime } from '../utils/helpers';

/**
 * Rarity color mapping for visual distinction in the UI.
 * 
 * Each rarity level has a distinct color scheme for:
 * - Text color
 * - Background color
 * - Border color
 * 
 * These are used to style shard name tags and rarity indicators
 * throughout the component for easy visual scanning.
 * 
 * @constant {Object}
 * @property {string} common - Gray colors for common rarity
 * @property {string} uncommon - Green colors for uncommon rarity
 * @property {string} rare - Blue colors for rare rarity
 * @property {string} epic - Purple colors for epic rarity
 * @property {string} legendary - Amber/Yellow colors for legendary rarity
 * @property {string} mythic - Pink colors for mythic rarity
 */
const RARITY_COLORS = {
    common: 'text-zinc-300 bg-zinc-800/60 border-zinc-700',
    uncommon: 'text-green-400 bg-green-950/40 border-green-800/60',
    rare: 'text-blue-400 bg-blue-950/40 border-blue-800/60',
    epic: 'text-purple-400 bg-purple-950/40 border-purple-800/60',
    legendary: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
    mythic: 'text-pink-400 bg-pink-950/40 border-pink-800/60',
};

/**
 * Helper function to get rarity color classes.
 * 
 * Safely looks up the color classes for a given rarity string.
 * Falls back to 'common' if the rarity is not recognized or is null/undefined.
 * 
 * @function rc
 * @param {string} r - The rarity string (e.g., 'common', 'rare', 'epic')
 * @returns {string} - Tailwind CSS classes for styling the rarity
 */
const rc = (r) => RARITY_COLORS[r?.toLowerCase()] || RARITY_COLORS.common;

/**
 * Custom hook for managing sortable table data.
 * 
 * This hook provides sorting functionality for the fusion table. It:
 * - Maintains the current sort key and direction in state
 * - Returns a sorted copy of the data array
 * - Provides a toggle function to change sort key/direction
 * 
 * Sorting behavior:
 * - Clicking a column header sorts by that column
 * - Clicking the same column again toggles between ascending and descending
 * - Clicking a different column starts sorting by that column in descending order
 * - Handles both string (alphabetical) and numeric (value) sorting
 * - Uses nullish coalescing (?? 0) to handle undefined/null values
 * 
 * @function useSortableData
 * @param {Array} data - The array of objects to sort
 * @param {string} [defaultKey='profit'] - The default sort key
 * @returns {Object} - Object containing sorted data, current sort config, and toggle function
 * @property {Array} sorted - The sorted data array
 * @property {Object} sortConfig - Current sort configuration { key, dir }
 * @property {Function} toggle - Function to toggle sort on a specific key
 */
function useSortableData(data, defaultKey = 'profit') {
    // State to track current sort key and direction
    // dir can be 'asc' (ascending) or 'desc' (descending)
    const [sortConfig, setSortConfig] = useState({ key: defaultKey, dir: 'desc' });

    // Create a sorted copy of the data array
    // Uses spread operator [...data] to avoid mutating the original array
    const sorted = [...data].sort((a, b) => {
        // Extract values for the current sort key, defaulting to 0 if undefined/null
        const av = a[sortConfig.key] ?? 0;
        const bv = b[sortConfig.key] ?? 0;

        // Handle string comparison (alphabetical sorting)
        if (typeof av === 'string')
            return sortConfig.dir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);

        // Handle numeric comparison
        // For descending: higher values first (bv - av)
        // For ascending: lower values first (av - bv)
        return sortConfig.dir === 'desc' ? bv - av : av - bv;
    });

    // Toggle function to change the sort configuration
    // If clicking the same key, toggle direction; otherwise, start with descending
    const toggle = (key) => setSortConfig(prev =>
        prev.key === key
            ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }  // Toggle direction
            : { key, dir: 'desc' }  // New key, start with descending
    );

    return { sorted, sortConfig, toggle };
}

/**
 * Sortable Table Header Cell Component
 * 
 * Renders a clickable table header cell that shows sorting state and
 * toggles sorting when clicked. This is used for all sortable columns
 * in the fusion table.
 * 
 * Visual indicators:
 * - ↕ (double arrow): Not currently sorted by this column
 * - ↓ (down arrow): Currently sorted descending by this column
 * - ↑ (up arrow): Currently sorted ascending by this column
 * 
 * Styling:
 * - Active sort column is highlighted (text-zinc-100)
 * - Inactive columns are dimmed (text-zinc-400)
 * - Hover effect for interactivity
 * - Supports custom CSS classes via className prop
 * 
 * @function SortTh
 * @param {Object} props - Component props
 * @param {string} props.label - Display text for the header
 * @param {string} props.colKey - The data key to sort by
 * @param {Object} props.sortConfig - Current sort configuration from useSortableData
 * @param {Function} props.toggle - Toggle function from useSortableData
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.title] - Tooltip text (title attribute)
 * @returns {JSX.Element} - Table header cell element
 */
function SortTh({ label, colKey, sortConfig, toggle, className = '', title }) {
    // Check if this column is currently being used for sorting
    const active = sortConfig.key === colKey;

    return (
        <th
            title={title}
            className={`p-4 font-medium select-none cursor-pointer hover:text-zinc-200 transition-colors whitespace-nowrap ${active ? 'text-zinc-100' : 'text-zinc-400'} ${className}`}
            onClick={() => toggle(colKey)}
        >
            {label} {active
                ? (sortConfig.dir === 'desc' ? '↓' : '↑')
                : <span className="text-zinc-700">↕</span>}
        </th>
    );
}

/**
 * Loading Panel Component
 * 
 * Displays a loading indicator while the fusion data is being loaded from GitHub.
 * Shows progress information and an animated spinner to indicate activity.
 * 
 * Features:
 * - Animated dual-ring spinner with violet and sky colors
 * - Animated dots (ellipsis) after the status text
 * - Progress indicator showing shard count when available
 * - Informational text about the background processing
 * - Smooth progress bar animation
 * 
 * This component is shown during:
 * - Initial fusion data loading
 * - Worker initialization
 * - Background computation (in some states)
 * 
 * @function LoadingPanel
 * @param {Object} props - Component props
 * @param {string} props.status - Current loading status message
 * @param {number} props.shardCount - Number of shards loaded (0 if not yet known)
 * @returns {JSX.Element} - Loading panel with spinner and status
 */
// ── Loading panel ────────────────────────────────────────────────────────
function LoadingPanel({ status, shardCount }) {
    // State for animated dots (ellipsis) after status text
    const [dots, setDots] = useState('');

    // Effect to animate the dots (0 -> 1 -> 2 -> 3 -> 0 dots, repeating)
    useEffect(() => {
        const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="bg-[#121214] border border-zinc-800 rounded-xl p-12 flex flex-col items-center gap-6">
            {/* Dual-ring animated spinner */}
            <div className="relative w-16 h-16">
                {/* Outer static ring */}
                <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
                {/* Inner spinning ring (violet) - spins clockwise */}
                <div className="absolute inset-0 rounded-full border-2 border-t-violet-500 border-r-violet-500/30 border-b-transparent border-l-transparent animate-spin" />
                {/* Inner spinning ring (sky) - spins counter-clockwise with longer duration */}
                <div className="absolute inset-2 rounded-full border-2 border-t-transparent border-r-transparent border-b-sky-500/60 border-l-sky-500 animate-spin"
                    style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>

            {/* Status text and information */}
            <div className="text-center space-y-1">
                {/* Main status message with animated dots */}
                <div className="text-sm font-medium text-zinc-200">{status}{dots}</div>

                {/* Show shard count when available */}
                {shardCount > 0 && (
                    <div className="text-xs text-zinc-500">{shardCount.toLocaleString()} shards loaded</div>
                )}

                {/* Informational text about background processing */}
                <div className="text-[10px] text-zinc-700 mt-2">
                    Fusion database is 1.8MB — processing on background thread
                </div>
            </div>

            {/* Progress bar ( animated width based on loading state ) */}
            <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-violet-600 via-sky-500 to-violet-600 rounded-full animate-pulse"
                    style={{ width: shardCount > 0 ? '80%' : '30%', transition: 'width 0.5s ease' }}
                />
            </div>
        </div>
    );
}

/**
 * Recursive Fusion Ingredient Row Component
 * 
 * This component displays a single row in the ingredient table, showing details
 * about a shard used in a fusion. It's recursive - if the shard can be profitably
 * fused from sub-shards, clicking the row expands to show those sub-ingredients.
 * 
 * This creates a tree-like visualization of deep fusion chains, allowing users
 * to see exactly how much they can save by fusing shards at different levels.
 * 
 * Key Features:
 * - Displays shard name, rarity, quantities, and prices
 * - Shows whether the shard is profitably fused (vs bought directly)
 * - Expandable to reveal sub-ingredients when fused
 * - Indented based on depth in the fusion tree
 * - Displays savings information when expanded
 * 
 * Recursion:
 * This component calls itself to render sub-ingredients, creating a nested
 * structure that can go multiple levels deep (limited by craftDepth setting).
 * 
 * @function FusedIngRow
 * @param {Object} props - Component props
 * @param {string} props.shardCode - The shard code to display (e.g., "SHARD_DIAMOND")
 * @param {number} props.parentQty - How many of this shard are needed by parent
 * @param {number} props.depth - Current depth in the recursion tree (0 = top level)
 * @param {Object} props.fusionData - The loaded fusion data (shards and recipes)
 * @param {Object} props.bazaarData - Current bazaar price data
 * @param {string} props.inputMode - Price mode for inputs ('instabuy' or 'buy_order')
 * @param {string} props.rowKey - Unique key for React rendering
 * @returns {JSX.Element|null} - Table row(s) for this ingredient, or null if shard not found
 */
// ── Ingredient expanded panel ─────────────────────────────────────────────
function FusedIngRow({ shardCode, parentQty, depth, fusionData, bazaarData, inputMode, rowKey }) {
    // State to track if this row is expanded (showing sub-ingredients)
    const [isExpanded, setIsExpanded] = useState(false);

    /**
     * Extracts price data for a shard from bazaar data.
     * 
     * This is a local helper function that mirrors the logic in shardWorker.js
     * but is used for client-side display calculations.
     * 
     * @function getPrices
     * @param {string} internalId - Hypixel item ID for the shard
     * @returns {Object|null} - Price data or null if not found
     */
    const getPrices = (internalId) => {
        const p = bazaarData[internalId];
        if (!p) return null;
        const qs = p.quick_status || {};
        const ss = p.sell_summary || [];
        return {
            instabuy: qs.buyPrice || 0,
            buyOrder: ss[0]?.pricePerUnit || 0,
            sellVol: qs.sellMovingWeek || 0,
        };
    };

    // Look up the shard definition from fusion data
    const shard = fusionData?.shards?.[shardCode];
    if (!shard) return null; // Don't render if shard definition missing

    // Get price data for this shard
    const prices = getPrices(shard.internal_id);
    // Determine market price based on user's input mode selection
    const marketPrice = prices ? (inputMode === 'instabuy' ? prices.instabuy : prices.buyOrder) : 0;

    // ==========================================
    // FIND BEST SUB-FUSION OPTION
    // ==========================================
    // Check if this shard can be profitably fused from sub-shards
    // This mirrors the logic in the worker's makeResolver function

    const recipes = fusionData?.recipes?.[shardCode];

    // Find the cheapest way to craft this shard by checking all recipes
    const bestSubFusion = (() => {
        if (!recipes) return null; // No fusion recipes for this shard

        let best = null;
        let bestCost = Infinity;

        // Iterate through all fusion recipes for this shard
        for (const [qtyStr, pairs] of Object.entries(recipes)) {
            const outQty = parseInt(qtyStr, 10); // Output quantity for this recipe

            // Check all input shard pairs for this recipe
            for (const [in1Code, in2Code] of pairs) {
                const in1Shard = fusionData.shards[in1Code];
                const in2Shard = fusionData.shards[in2Code];
                if (!in1Shard || !in2Shard) continue; // Skip if shard definitions missing

                const p1 = getPrices(in1Shard.internal_id);
                const p2 = getPrices(in2Shard.internal_id);
                if (!p1 || !p2) continue; // Skip if price data missing

                // Get prices based on input mode
                const c1 = inputMode === 'instabuy' ? p1.instabuy : p1.buyOrder;
                const c2 = inputMode === 'instabuy' ? p2.instabuy : p2.buyOrder;

                // Calculate cost per output shard:
                // (input1_fuse_amount * input1_price + input2_fuse_amount * input2_price) / output_quantity
                const craftCost = (in1Shard.fuse_amount * c1 + in2Shard.fuse_amount * c2) / outQty;

                // Track the cheapest option
                if (craftCost < bestCost) {
                    bestCost = craftCost;
                    best = { outQty, in1Code, in2Code, in1Shard, in2Shard, craftCostPerUnit: craftCost };
                }
            }
        }
        return best;
    })();

    // Determine if fusing this shard is cheaper than buying it
    const isFused = bestSubFusion !== null && bestSubFusion.craftCostPerUnit < marketPrice;

    // Use fused cost if profitable, otherwise use market price
    const effectivePrice = isFused ? bestSubFusion.craftCostPerUnit : marketPrice;

    // Calculate total cost for the required quantity
    const totalCost = parentQty * effectivePrice;

    // Calculate indentation based on depth (12px per level)
    const indent = depth * 12;

    // ==========================================
    // RENDER ROW AND SUB-INGREDIENTS
    // ==========================================
    return (
        <React.Fragment>
            {/* Main ingredient row */}
            <tr
                onClick={() => isFused && setIsExpanded(e => !e)}
                className={`text-zinc-400 hover:bg-zinc-900/40 ${isFused ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-zinc-900/30' : ''}`}
            >
                {/* Shard name and indicators */}
                <td className="p-2.5 font-sans font-medium uppercase tracking-tight" style={{ paddingLeft: `${10 + indent}px` }}>
                    <div className="flex items-center gap-1.5">
                        {/* Expand/collapse arrow - only shown if this shard is fused */}
                        {isFused && (
                            <span className="text-[9px] text-zinc-500 font-mono w-2 shrink-0">
                                {isExpanded ? '▼' : '▶'}
                            </span>
                        )}
                        {/* Spacer for alignment when not fused */}
                        {!isFused && depth > 0 && <span className="w-2 shrink-0" />}

                        {/* Shard name with rarity styling */}
                        <span className={`text-[9px] px-1 py-0.5 rounded border font-mono ${rc(shard.rarity?.toLowerCase())}`}>
                            {shard.name}
                        </span>

                        {/* FUSED badge - indicates this shard is profitably crafted */}
                        {isFused && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-violet-950/60 border border-violet-800/50 text-violet-400 font-mono shrink-0">
                                FUSED
                            </span>
                        )}
                    </div>
                </td>

                {/* Quantity needed */}
                <td className="p-2.5 text-right font-mono text-zinc-500">×{parentQty}</td>

                {/* Market prices */}
                <td className="p-2.5 text-right font-mono text-sky-400">{formatNum(prices?.instabuy || 0)}</td>
                <td className="p-2.5 text-right font-mono text-zinc-400">{formatNum(prices?.buyOrder || 0)}</td>

                {/* Effective price (fused price if profitable, otherwise market) */}
                <td className="p-2.5 text-right font-mono text-violet-400">
                    {isFused ? formatNum(effectivePrice) : <span className="text-zinc-700">—</span>}
                </td>

                {/* Total cost for this quantity */}
                <td className="p-2.5 text-right font-mono font-semibold text-zinc-200">{formatNum(totalCost)}</td>

                {/* 7-day buy volume */}
                <td className="p-2.5 text-right font-mono text-zinc-600">{formatNum(prices?.sellVol || 0)}</td>
            </tr>

            {/* Expanded content - shown when row is clicked and shard is fused */}
            {isFused && isExpanded && (
                <>
                    {/* ==========================================
                     * SAVINGS SUMMARY ROW
                     * Shows detailed savings information for the fusion
                     * ========================================== */}
                    <tr className="bg-zinc-950/60">
                        <td
                            colSpan="7"
                            className="px-3 py-1.5 border-l-2 border-violet-800/40"
                            style={{ paddingLeft: `${22 + indent}px` }}
                        >
                            <div className="flex gap-6 text-[10px]">
                                {/* Fused cost per unit */}
                                <div>
                                    <span className="text-zinc-600">Fused cost/unit: </span>
                                    <span className="font-mono text-violet-400">{formatNum(bestSubFusion.craftCostPerUnit)}</span>
                                </div>

                                {/* Comparison with market price */}
                                <div>
                                    <span className="text-zinc-600">vs market: </span>
                                    <span className="font-mono text-zinc-400">{formatNum(marketPrice)}</span>
                                </div>

                                {/* Savings amount and percentage */}
                                <div>
                                    <span className="text-zinc-600">Savings: </span>
                                    <span className="font-mono text-emerald-400">
                                        {formatNum(marketPrice - bestSubFusion.craftCostPerUnit)}
                                        {' '}({marketPrice > 0 ? (((marketPrice - bestSubFusion.craftCostPerUnit) / marketPrice) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>

                                {/* Output quantity per fusion */}
                                <div>
                                    <span className="text-zinc-600">Output per fuse: </span>
                                    <span className="font-mono text-zinc-400">×{bestSubFusion.outQty}</span>
                                </div>
                            </div>
                        </td>
                    </tr>

                    {/* ==========================================
                     * RECURSIVE SUB-INGREDIENTS
                     * Render the input shards for this fusion
                     * ========================================== */}
                    <FusedIngRow
                        shardCode={bestSubFusion.in1Code}
                        parentQty={bestSubFusion.in1Shard.fuse_amount}
                        depth={depth + 1}
                        fusionData={fusionData}
                        bazaarData={bazaarData}
                        inputMode={inputMode}
                        rowKey={`${rowKey}-in1`}
                    />
                    <FusedIngRow
                        shardCode={bestSubFusion.in2Code}
                        parentQty={bestSubFusion.in2Shard.fuse_amount}
                        depth={depth + 1}
                        fusionData={fusionData}
                        bazaarData={bazaarData}
                        inputMode={inputMode}
                        rowKey={`${rowKey}-in2`}
                    />
                </>
            )}
        </React.Fragment>
    );
}

/**
 * Ingredient Panel Component
 * 
 * This component displays a detailed breakdown of a fusion opportunity when a row
 * in the main table is expanded. It shows:
 * - Fusion summary (output shard details, pricing, profitability)
 * - Ingredient table with all input shards
 * 
 * The panel is organized in a responsive grid layout:
 * - On mobile: Single column with summary on top, ingredients below
 * - On desktop: 3-column layout with summary in column 1, ingredients spanning columns 2-3
 * 
 * This component uses FusedIngRow to render the ingredient table, which means
 * it supports recursive expansion to show deep fusion chains.
 * 
 * @function IngredientPanel
 * @param {Object} props - Component props
 * @param {Object} props.item - The fusion opportunity data from the worker results
 * @param {string} props.inputMode - Current input price mode ('instabuy' or 'buy_order')
 * @param {string} props.outputMode - Current output price mode ('sell_order' or 'instasell')
 * @param {Object} props.bazaarData - Current bazaar price data
 * @param {Object} props.fusionData - Loaded fusion data (shards and recipes)
 * @returns {JSX.Element} - Detailed panel with fusion information
 */
// ── Ingredient expanded panel ─────────────────────────────────────────────
function IngredientPanel({ item, inputMode, outputMode, bazaarData, fusionData }) {
    /**
     * Extracts price data for a shard from bazaar data.
     * 
     * Similar to getPrices in FusedIngRow but includes additional fields
     * needed for the detailed panel display (sellOrder, instasell).
     * 
     * @function getPrices
     * @param {string} internalId - Hypixel item ID for the shard
     * @returns {Object|null} - Price data or null if not found
     */
    const getPrices = (internalId) => {
        const p = bazaarData[internalId];
        if (!p) return null;
        const qs = p.quick_status || {};
        const ss = p.sell_summary || [];
        const bs = p.buy_summary || [];
        return {
            instabuy: qs.buyPrice || 0,
            buyOrder: ss[0]?.pricePerUnit || 0,
            sellOrder: qs.sellPrice || 0,
            instasell: bs[0]?.pricePerUnit || 0,
            buyVol: qs.buyMovingWeek || 0,
            sellVol: qs.sellMovingWeek || 0,
        };
    };

    // Get price data for the output shard
    const outPrices = getPrices(item.outInternalId);

    // Determine the selling price based on user's output mode selection
    const outSellPrice = outputMode === 'sell_order'
        ? (outPrices?.sellOrder || 0)
        : (outPrices?.instasell || 0);

    // Calculate the total value of the output
    // effectiveValue = output_quantity * sell_price_per_unit
    const effectiveValue = item.outQty * outSellPrice;

    // Calculate profit after accounting for the actual output value
    // This may differ from item.profit if the user changed output mode
    const effectiveProfit = effectiveValue - item.cost;

    // ==========================================
    // RENDER PANEL LAYOUT
    // ==========================================
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ==========================================
             * SUMMARY CARD (Left column on desktop)
             * Shows output shard details and profitability metrics
             * ========================================== */}
            <div className="md:col-span-1 bg-[#121214] border border-zinc-800 rounded-lg p-4 space-y-3">
                {/* Section title */}
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Fusion Summary
                </span>

                {/* Output shard info */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        {/* Output shard name with rarity styling */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${rc(item.outRarity)}`}>
                            {item.outName}
                        </span>
                        {/* Output quantity */}
                        <span className="text-[10px] text-zinc-600">×{item.outQty}</span>
                    </div>

                    {/* Output price information grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mt-2">
                        <span className="text-zinc-600">Insta-Sell</span>
                        <span className="font-mono text-violet-400 text-right">{formatNum(outPrices?.instasell || 0)}</span>
                        <span className="text-zinc-600">Sell Order</span>
                        <span className="font-mono text-zinc-300 text-right">{formatNum(outPrices?.sellOrder || 0)}</span>
                        <span className="text-zinc-600">7d Vol</span>
                        <span className="font-mono text-zinc-500 text-right">{formatNum(outPrices?.sellVol || 0)}</span>
                    </div>
                </div>

                {/* Profitability metrics with divider */}
                <div className="pt-2 border-t border-zinc-800 space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Total cost</span>
                        <span className="font-mono text-zinc-400">{formatNum(item.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Output value</span>
                        <span className="font-mono text-zinc-300">{formatNum(effectiveValue)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span className="text-zinc-400">Profit</span>
                        {/* Profit is green if positive, red if negative */}
                        <span className={`font-mono ${effectiveProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {effectiveProfit > 0 ? '+' : ''}{formatNum(effectiveProfit)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Margin</span>
                        <span className="font-mono text-amber-400">
                            {item.cost > 0 ? ((effectiveProfit / item.cost) * 100).toFixed(1) : '0'}%
                        </span>
                    </div>
                </div>
            </div>

            {/* ==========================================
             * INGREDIENTS TABLE (Right 2 columns on desktop)
             * Uses recursive FusedIngRow to show fusion chains
             * ========================================== */}
            <div className="md:col-span-2 border border-zinc-800 rounded-lg overflow-hidden bg-[#121214]">
                <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                        <tr className="border-b border-zinc-800 bg-[#18181b]/40 text-zinc-500 font-medium select-none">
                            <th className="p-2.5">Ingredient</th>
                            <th className="p-2.5 text-right">Fuse Qty</th>
                            <th className="p-2.5 text-right text-sky-400/70">Insta-Buy</th>
                            <th className="p-2.5 text-right text-zinc-400/70">Buy Order</th>
                            <th className="p-2.5 text-right text-violet-400/70">Fused Cost</th>
                            <th className="p-2.5 text-right text-zinc-300">Total Cost</th>
                            <th className="p-2.5 text-right">In Vol</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 font-mono">
                        {/* Render both input shards using FusedIngRow */}
                        {/* This allows recursive expansion for deep fusion chains */}
                        <FusedIngRow
                            shardCode={item.in1Code}
                            parentQty={item.in1Qty}
                            depth={0}
                            fusionData={fusionData}
                            bazaarData={bazaarData}
                            inputMode={inputMode}
                            rowKey={`${item.id}-in1`}
                        />
                        <FusedIngRow
                            shardCode={item.in2Code}
                            parentQty={item.in2Qty}
                            depth={0}
                            fusionData={fusionData}
                            bazaarData={bazaarData}
                            inputMode={inputMode}
                            rowKey={`${item.id}-in2`}
                        />
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Main Shard Fusion Table Component
 * 
 * This is the primary component that orchestrates the entire shard fusion
 * profitability analysis feature. It manages the Web Worker, handles state,
 * and renders the UI with controls, table, and detailed panels.
 * 
 * Architecture:
 * - Uses a Web Worker (shardWorker.js) for heavy computations
 * - Communicates with worker via postMessage() API
 * - Manages worker lifecycle (creation, termination)
 * - Handles user settings (price modes, craft depth, filters)
 * - Renders the main table with sortable, filterable, expandable rows
 * 
 * State Management:
 * - Uses useRef for mutable values that don't trigger re-renders
 * - Uses useState for UI state and display data
 * - Uses useEffect for side effects (worker communication, auto-compute)
 * 
 * Worker Communication:
 * The component maintains a bidirectional communication channel with the worker:
 * - Sends: LOAD_FUSION_DATA, COMPUTE messages
 * - Receives: LOADING, FUSION_DATA_LOADED, COMPUTING, RESULTS, ERROR messages
 * 
 * @function ShardFusionTable
 * @param {Object} props - Component props
 * @param {Object} props.bazaarData - Current bazaar price data from Hypixel API
 * @returns {JSX.Element} - Complete shard fusion table UI
 */
// ── Main component ────────────────────────────────────────────────────────
export default function ShardFusionTable({ bazaarData }) {
    // ==========================================
    // REFS (mutable values that don't trigger re-renders)
    // ==========================================

    // Reference to the Web Worker instance
    const workerRef = useRef(null);

    // Flag indicating if fusion data is loaded and ready
    const fusionReadyRef = useRef(false);

    // Stores a pending compute request if worker isn't ready yet
    const pendingComputeRef = useRef(null);

    // Timer for debouncing compute requests
    const computeTimerRef = useRef(null);

    // Fingerprints for detecting when bazaar data or options actually change
    // Used to avoid unnecessary re-computation due to React creating new objects
    const lastBazaarFpRef = useRef('');  // Last bazaar data fingerprint
    const lastOptionsFpRef = useRef(''); // Last options fingerprint

    // ==========================================
    // STATE
    // ==========================================

    // Worker status: 'idle', 'loading', 'computing', 'ready_idle', 'ready', 'error'
    const [workerStatus, setWorkerStatus] = useState('idle');

    // Current status message for display in UI
    const [statusMsg, setStatusMsg] = useState('Initializing…');

    // Number of shards loaded from fusion database
    const [shardCount, setShardCount] = useState(0);

    // Array of profitable fusion opportunities from worker
    const [results, setResults] = useState([]);

    // ID of the currently expanded item in the table (null = none)
    const [expandedItem, setExpandedItem] = useState(null);

    // ==========================================
    // USER SETTINGS STATE
    // ==========================================

    // Input price mode: 'buy_order' (best sell order) or 'instabuy' (instant buy)
    const [inputMode, setInputMode] = useState('buy_order');

    // Output price mode: 'sell_order' (best buy order) or 'instasell' (instant sell)
    const [outputMode, setOutputMode] = useState('sell_order');

    // Deep fusion depth: 0 (off), 1, 2, or 3 levels of recursive cost resolution
    const [craftDepth, setCraftDepth] = useState(1);

    // ==========================================
    // FILTER SETTINGS STATE
    // ==========================================

    // Minimum profit threshold (empty = no filter)
    const [minProfit, setMinProfit] = useState('');

    // Minimum profit margin percentage (empty = no filter)
    const [minMargin, setMinMargin] = useState('');

    // Minimum output shard 7-day volume (empty = no filter)
    const [minOutVol, setMinOutVol] = useState('');

    // Minimum input 1 shard 7-day volume (empty = no filter)
    const [minIn1Vol, setMinIn1Vol] = useState('');

    // Minimum input 2 shard 7-day volume (empty = no filter)
    const [minIn2Vol, setMinIn2Vol] = useState('');

    // Search term for filtering by shard name
    const [searchTerm, setSearchTerm] = useState('');

    // ==========================================
    // FUSION DATA STATE
    // ==========================================

    // The loaded fusion data (shards and recipes) from the worker
    // This is cached client-side for the ingredient panel display
    const [fusionData, setFusionData] = useState(null);

    // ==========================================
    // USE EFFECT: BOOT WORKER ONCE
    // ==========================================
    // This effect runs exactly once when the component mounts.
    // It creates the Web Worker, sets up message handling, and initiates
    // the fusion data loading process.
    useEffect(() => {
        // Create a new Web Worker from the shardWorker.js file
        // Using { type: 'module' } allows ES module syntax in the worker
        const worker = new Worker(
            new URL('../workers/shardWorker.js', import.meta.url),
            { type: 'module' }
        );

        // Store worker reference for later use
        workerRef.current = worker;

        // ==========================================
        // MESSAGE HANDLER
        // ==========================================
        // This function processes messages received from the worker
        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            // ----------------------------------------
            // HANDLE LOADING MESSAGE
            // Worker is fetching fusion data from GitHub
            // ----------------------------------------
            if (type === 'LOADING') {
                // Update status message with worker's payload
                setStatusMsg(payload);
                setWorkerStatus('loading');
            }

            // ----------------------------------------
            // HANDLE FUSION_DATA_LOADED MESSAGE
            // Worker has successfully loaded fusion data
            // ----------------------------------------
            if (type === 'FUSION_DATA_LOADED') {
                // Store shard count for display
                setShardCount(payload.shardCount);

                // Cache fusion data client-side
                setFusionData(payload.fusionData);

                // Mark fusion data as ready
                fusionReadyRef.current = true;

                // Update status
                setStatusMsg('Computing fusions…');

                // If there's a pending compute request, execute it now
                if (pendingComputeRef.current) {
                    worker.postMessage({ type: 'COMPUTE', payload: pendingComputeRef.current });
                    pendingComputeRef.current = null;
                    setWorkerStatus('computing');
                } else {
                    // No pending compute - worker is ready but idle
                    setWorkerStatus('ready_idle');
                }
            }

            // ----------------------------------------
            // HANDLE COMPUTING MESSAGE
            // Worker is running profit calculations
            // ----------------------------------------
            if (type === 'COMPUTING') {
                // Update status message
                setStatusMsg(payload);
                // Don't wipe results — keep old table visible during recompute
            }

            // ----------------------------------------
            // HANDLE RESULTS MESSAGE
            // Worker has completed profit calculations
            // ----------------------------------------
            if (type === 'RESULTS') {
                // Store the results
                setResults(payload);
                setWorkerStatus('ready');
                setStatusMsg('');
            }

            // ----------------------------------------
            // HANDLE ERROR MESSAGE
            // Worker encountered an error
            // ----------------------------------------
            if (type === 'ERROR') {
                setWorkerStatus('error');
                setStatusMsg(payload);
            }
        };

        // ==========================================
        // INITIATE DATA LOADING
        // ==========================================
        // Tell the worker to load fusion data from GitHub
        worker.postMessage({ type: 'LOAD_FUSION_DATA' });

        // ==========================================
        // CLEANUP FUNCTION
        // ==========================================
        // Called when component unmounts
        return () => {
            // Clear any pending compute timer
            clearTimeout(computeTimerRef.current);

            // Terminate the worker to free resources
            worker.terminate();
            workerRef.current = null;
        };
    }, []); // Empty dependency array = runs exactly once on mount

    // ==========================================
    // USE EFFECT: TRIGGER COMPUTE ON DATA/SETTINGS CHANGE
    // ==========================================
    // This effect triggers profit calculations whenever:
    // - bazaarData changes (new prices from API)
    // - User changes inputMode, outputMode, or craftDepth
    // 
    // It uses debouncing (400ms delay) and fingerprinting to avoid
    // unnecessary computations.
    useEffect(() => {
        // Safety checks
        if (!workerRef.current) return; // Worker not initialized yet
        if (Object.keys(bazaarData).length === 0) return; // No bazaar data

        // ==========================================
        // CREATE FINGERPRINTS FOR CHANGE DETECTION
        // ==========================================
        // Fingerprint bazaar data by item count + a sentinel price
        // This prevents re-firing just because React created a new object reference
        // We use ENCHANTED_DIAMOND or WHEAT as a representative price to detect
        // actual price changes vs. just object reference changes
        const sentinelPrice = (
            bazaarData['ENCHANTED_DIAMOND']?.quick_status?.buyPrice ||
            bazaarData['WHEAT']?.quick_status?.buyPrice ||
            0
        ).toFixed(2);
        const bazaarFp = `${Object.keys(bazaarData).length}:${sentinelPrice}`;
        const optionsFp = `${inputMode}:${outputMode}:${craftDepth}`;

        // Skip if nothing has actually changed
        if (bazaarFp === lastBazaarFpRef.current && optionsFp === lastOptionsFpRef.current) return;

        // Update fingerprints
        lastBazaarFpRef.current = bazaarFp;
        lastOptionsFpRef.current = optionsFp;

        // Prepare payload for worker
        const payload = { bazaarData, inputMode, outputMode, craftDepth };

        // ==========================================
        // DEBOUNCED COMPUTE REQUEST
        // ==========================================
        // Clear any pending compute timer
        clearTimeout(computeTimerRef.current);

        // Set a new timer (400ms debounce)
        computeTimerRef.current = setTimeout(() => {
            if (!fusionReadyRef.current) {
                // Fusion data not loaded yet - queue the compute for later
                pendingComputeRef.current = payload;
                return;
            }

            // Send compute request to worker
            workerRef.current.postMessage({ type: 'COMPUTE', payload });

            // Only show computing state if we have no results yet
            // If we already have results, keep showing them while computing
            setWorkerStatus(prev => prev === 'ready' ? 'ready' : 'computing');
        }, 400); // 400ms debounce delay
    }, [bazaarData, inputMode, outputMode, craftDepth]); // Re-run when these dependencies change

    // ==========================================
    // CLIENT-SIDE FILTERING
    // ==========================================
    // Apply filters to the worker results before sorting and display.
    // This filtering happens instantly in the main thread (no worker needed).
    // All filters are optional - empty strings mean no filter for that criteria.
    const filtered = results.filter(r => {
        // Filter by minimum profit
        if (minProfit && r.profit < parseFloat(minProfit)) return false;

        // Filter by minimum profit margin percentage
        if (minMargin && r.profitPct < parseFloat(minMargin)) return false;

        // Filter by minimum output shard 7-day volume
        if (minOutVol && r.outVolume < parseFloat(minOutVol)) return false;

        // Filter by minimum input 1 shard 7-day volume
        if (minIn1Vol && r.in1Volume < parseFloat(minIn1Vol)) return false;

        // Filter by minimum input 2 shard 7-day volume
        if (minIn2Vol && r.in2Volume < parseFloat(minIn2Vol)) return false;

        // Filter by search term (matches any shard name)
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            if (
                !r.in1Name.toLowerCase().includes(s) &&
                !r.in2Name.toLowerCase().includes(s) &&
                !r.outName.toLowerCase().includes(s)
            ) return false;
        }

        // Passed all filters
        return true;
    });

    // Apply sorting to the filtered results
    const { sorted, sortConfig, toggle } = useSortableData(filtered, 'profit');

    // Helper object to spread sort config to SortTh components
    const sh = { sortConfig, toggle };

    // ==========================================
    // UI STATE DERIVATION
    // ==========================================

    // True during initial load (no results yet, worker still loading)
    const isFirstLoad = ['idle', 'loading', 'computing', 'ready_idle'].includes(workerStatus) && results.length === 0;

    // True when worker is recomputing but we already have results to show
    const isRecomputing = workerStatus === 'computing' && results.length > 0;

    // ==========================================
    // RENDER MAIN UI
    // ==========================================
    return (
        <div className="space-y-4">

            {/* ==========================================
             * CONTROLS SECTION
             * Contains all user controls and filters
             * ========================================== */}
            <div className="bg-[#121214] border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap gap-4 items-end">

                    {/* Input mode */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Buy Inputs Via
                        </label>
                        <div className="bg-[#09090b] p-0.5 rounded-lg border border-zinc-800 inline-flex">
                            <button
                                onClick={() => setInputMode('buy_order')}
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer ${inputMode === 'buy_order' ? 'bg-[#27272a] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >Buy Order</button>
                            <button
                                onClick={() => setInputMode('instabuy')}
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer ${inputMode === 'instabuy' ? 'bg-sky-900/60 text-sky-300 border border-sky-700/40' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >Insta-Buy</button>
                        </div>
                    </div>

                    {/* Output mode */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Sell Output Via
                        </label>
                        <div className="bg-[#09090b] p-0.5 rounded-lg border border-zinc-800 inline-flex">
                            <button
                                onClick={() => setOutputMode('sell_order')}
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer ${outputMode === 'sell_order' ? 'bg-[#27272a] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >Sell Order</button>
                            <button
                                onClick={() => setOutputMode('instasell')}
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer ${outputMode === 'instasell' ? 'bg-violet-900/60 text-violet-300 border border-violet-700/40' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >Insta-Sell</button>
                        </div>
                    </div>

                    {/* Craft depth */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Deep Fusion Depth
                        </label>
                        <div className="bg-[#09090b] p-0.5 rounded-lg border border-zinc-800 inline-flex">
                            {[0, 1, 2, 3].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setCraftDepth(d)}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition cursor-pointer ${craftDepth === d ? 'bg-[#27272a] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    {d === 0 ? 'Off' : `${d}×`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="space-y-1 flex-1 min-w-[160px]">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Search
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Filter by shard name…"
                            className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder-zinc-600"
                        />
                    </div>

                    {/* Status / count */}
                    <div className="ml-auto text-right text-[10px] space-y-0.5">
                        {isFirstLoad ? (
                            <div className="flex items-center gap-2 text-zinc-500">
                                <div className="w-3 h-3 rounded-full border border-t-violet-500 border-zinc-700 animate-spin" />
                                {statusMsg}
                            </div>
                        ) : (
                            <>
                                <div className="text-zinc-400 font-medium flex items-center gap-2 justify-end">
                                    {isRecomputing && (
                                        <div
                                            className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"
                                            title="Updating in background…"
                                        />
                                    )}
                                    {filtered.length.toLocaleString()} profitable fusions
                                </div>
                                <div className="text-zinc-700">{results.length.toLocaleString()} total checked</div>
                            </>
                        )}
                    </div>
                </div>

                {/* Volume + profit filters */}
                <div className="flex flex-wrap gap-3 pt-3 border-t border-zinc-800/60">
                    {[
                        { label: 'Min Profit', val: minProfit, set: setMinProfit },
                        { label: 'Min Margin %', val: minMargin, set: setMinMargin },
                        { label: 'Min Output Vol', val: minOutVol, set: setMinOutVol },
                        { label: 'Min In1 Vol', val: minIn1Vol, set: setMinIn1Vol },
                        { label: 'Min In2 Vol', val: minIn2Vol, set: setMinIn2Vol },
                    ].map(({ label, val, set }) => (
                        <div key={label} className="space-y-1">
                            <label className="text-[10px] font-medium text-zinc-500 block">{label}</label>
                            <input
                                type="text"
                                value={val}
                                onChange={e => set(parseCompactNumber(e.target.value))}
                                placeholder="0"
                                className="w-28 bg-[#09090b] border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder-zinc-600"
                            />
                        </div>
                    ))}
                </div>

                {/* Active mode badges */}
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-zinc-600">Mode:</span>
                    <span className={`px-2 py-0.5 rounded border font-mono ${inputMode === 'instabuy' ? 'text-sky-400 bg-sky-950/40 border-sky-800/60' : 'text-zinc-300 bg-zinc-800/60 border-zinc-700'}`}>
                        {inputMode === 'instabuy' ? 'Insta-Buy inputs' : 'Buy Order inputs'}
                    </span>
                    <span className="text-zinc-700">→ fuse →</span>
                    <span className={`px-2 py-0.5 rounded border font-mono ${outputMode === 'instasell' ? 'text-violet-400 bg-violet-950/40 border-violet-800/60' : 'text-zinc-300 bg-zinc-800/60 border-zinc-700'}`}>
                        {outputMode === 'instasell' ? 'Insta-Sell output' : 'Sell Order output'}
                    </span>
                    {craftDepth > 0 && (
                        <span className="px-2 py-0.5 rounded border font-mono text-violet-400 bg-violet-950/40 border-violet-800/60">
                            Deep {craftDepth}×
                        </span>
                    )}
                </div>
            </div>

            {/* ==========================================
             * LOADING PANEL
             * Shown only during first load when no results yet
             * ========================================== */}
            {isFirstLoad && (
                <LoadingPanel status={statusMsg} shardCount={shardCount} />
            )}

            {/* ==========================================
             * ERROR STATE
             * Shown when worker fails to load data
             * ========================================== */}
            {workerStatus === 'error' && (
                <div className="bg-[#121214] border border-red-800/40 rounded-xl p-6 text-center space-y-2">
                    <div className="text-sm font-semibold text-red-400">Failed to load shard fusion data</div>
                    <div className="text-xs text-zinc-500">{statusMsg}</div>
                </div>
            )}

            {/* ==========================================
             * MAIN RESULTS TABLE
             * Shown when we have results to display
             * ========================================== */}
            {results.length > 0 && (
                <div className="bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-max w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-[#18181b]/40">
                                    <th
                                        className={`p-4 font-medium select-none cursor-pointer hover:text-zinc-200 transition-colors whitespace-nowrap sticky left-0 bg-[#18181b] z-10 min-w-[280px] ${sortConfig.key === 'outName' ? 'text-zinc-100' : 'text-zinc-400'}`}
                                        onClick={() => toggle('outName')}
                                    >
                                        Fusion {sortConfig.key === 'outName'
                                            ? (sortConfig.dir === 'desc' ? '↓' : '↑')
                                            : <span className="text-zinc-700">↕</span>}
                                    </th>
                                    <SortTh label="Rarity" colKey="outRarity"  {...sh} className="text-right" />
                                    <SortTh label="Total Cost" colKey="cost"       {...sh} className="text-right" />
                                    <SortTh label="Value" colKey="value"      {...sh} className="text-right" />
                                    <SortTh label="Profit ⓘ" colKey="profit" title="Net profit per fusion" {...sh} className="text-right" />
                                    <SortTh label="Margin %" colKey="profitPct"  {...sh} className="text-right" />
                                    <SortTh label="Out Price" colKey="outPrice"   {...sh} className="text-right" />
                                    <SortTh label="Out Vol ⓘ" colKey="outVolume" title="Output 7d sell volume" {...sh} className="text-right" />
                                    <SortTh label="In1 Vol" colKey="in1Volume" title="Input 1 — 7d volume" {...sh} className="text-right" />
                                    <SortTh label="In2 Vol" colKey="in2Volume" title="Input 2 — 7d volume" {...sh} className="text-right" />
                                    <SortTh label="sell Time" colKey="sellTime" title="Expected Selling Time" {...sh} className="text-right" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {sorted.map((item, i) => {
                                    const isExpanded = expandedItem === item.id;
                                    const isDeep =
                                        craftDepth > 0 &&
                                        (item.in1Price < item.in1MarketInstabuy ||
                                            item.in2Price < item.in2MarketBuyOrder);

                                    return (
                                        <React.Fragment key={`shard-${item.id}-${i}`}>
                                            <tr
                                                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                className={`hover:bg-zinc-900/60 transition-colors cursor-pointer group select-none ${isExpanded ? 'bg-zinc-900/40' : ''}`}
                                            >
                                                {/* Sticky label cell */}
                                                <td className={`p-4 sticky left-0 z-10 transition-colors ${isExpanded ? 'bg-zinc-900/40' : 'bg-[#121214]'} group-hover:bg-zinc-900/60`}>
                                                    <div className="flex items-center gap-1.5 flex-wrap min-w-[260px]">
                                                        <span className="text-[9px] text-zinc-500 font-mono w-2">
                                                            {isExpanded ? '▼' : '▶'}
                                                        </span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${rc(item.in1Rarity)}`}>
                                                            {item.in1Name}
                                                        </span>
                                                        <span className="text-zinc-600 text-[10px]">+</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${rc(item.in2Rarity)}`}>
                                                            {item.in2Name}
                                                        </span>
                                                        <span className="text-zinc-600 text-[10px]">→</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${rc(item.outRarity)}`}>
                                                            {item.outName}
                                                        </span>
                                                        {isDeep && (
                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-violet-950/60 border border-violet-800/50 text-violet-400 font-mono">
                                                                DEEP
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="p-4 text-right whitespace-nowrap">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono capitalize ${rc(item.outRarity)}`}>
                                                        {item.outRarity}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                                                    {formatNum(item.cost)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-300 whitespace-nowrap">
                                                    {formatNum(item.value)}
                                                </td>
                                                <td className={`p-4 text-right font-mono font-bold whitespace-nowrap ${item.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {item.profit > 0 ? '+' : ''}{formatNum(item.profit)}
                                                </td>
                                                <td className="p-4 text-right font-mono whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-medium ${item.profitPct > 10 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                                        {item.profitPct.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                                                    {formatNum(item.outPrice)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-500 whitespace-nowrap">
                                                    {formatNum(item.outVolume)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-600 whitespace-nowrap">
                                                    {formatNum(item.in1Volume)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-600 whitespace-nowrap">
                                                    {formatNum(item.in2Volume)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-600 whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-medium ${item.sellTime < 60 ? 'text-emerald-400' : 'text-red-400'}`}>

                                                        {formatSellTime(item.sellTime)}
                                                    </span>

                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr key={`exp-${item.id}`} className="bg-[#09090b]/60">
                                                    <td colSpan="10" className="p-6 border-l border-zinc-500 bg-zinc-950/20">
                                                        <IngredientPanel
                                                            item={item}
                                                            inputMode={inputMode}
                                                            outputMode={outputMode}
                                                            bazaarData={bazaarData}
                                                            fusionData={fusionData}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {sorted.length === 0 && (
                                    <tr>
                                        <td colSpan="10" className="p-8 text-center text-zinc-600 text-xs">
                                            No profitable shard fusions found with current filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// END OF ShardFusionTable.jsx
// ==========================================
// This component provides a complete shard fusion profitability
// analysis tool for Hypixel SkyBlock, with Web Worker-based
// computation for performance and a rich, interactive UI.
// ==========================================

