/**
 * Shard Fusion Web Worker
 * 
 * Runs computationally intensive shard fusion calculations in a background thread.
 * This prevents UI blocking while processing the large fusion data (~1.8MB).
 * 
 * Communication:
 * - Main thread sends messages via postMessage()
 * - Worker receives messages via self.onmessage
 * - Worker sends responses via self.postMessage()
 * 
 * Message Types:
 * - LOAD_FUSION_DATA: Load fusion data from GitHub
 * - COMPUTE: Run profit calculations with current bazaar data
 * - LOADING: Status update during loading
 * - FUSION_DATA_LOADED: Data loaded successfully
 * - COMPUTING: Status update during computation
 * - RESULTS: Calculation results ready
 * - ERROR: Error occurred
 * 
 * @file workers/shardWorker.js
 * @context Web Worker (no DOM, no React, pure JavaScript)
 */

/**
 * URL for external shard fusion data
 * Contains all shard definitions and fusion recipes
 * Size: ~1.8MB
 */
const FUSION_DATA_URL = 'https://raw.githubusercontent.com/HichamIDDIR/Hypixel-Skyblock-Shards-Profit-Tracker/refs/heads/main/fusion-data.json';

/**
 * Stores loaded fusion data
 * Structure: { shards: {...}, recipes: {...} }
 * @type {Object|null}
 */
let fusionData = null;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Extracts price data for a specific shard from bazaar data.
 * 
 * @function getShardPrices
 * @param {Object} bazaarData - Full bazaar data from Hypixel API
 * @param {string} internalId - Hypixel item ID for the shard
 * @returns {Object|null} - Price data object or null if not found
 * @property {number} instabuy - Instant buy price from quick_status
 * @property {number} buyOrder - Best buy order price
 * @property {number} sellOrder - Best sell order price
 * @property {number} instasell - Instant sell price from quick_status
 * @property {number} buyVol - 7-day buy volume
 * @property {number} sellVol - 7-day sell volume
 */
function getShardPrices(bazaarData, internalId) {
    const p = bazaarData[internalId];
    if (!p) return null;
    const qs = p.quick_status || {};
    const ss = p.sell_summary || [];
    const bs = p.buy_summary || [];
    return {
        instabuy: qs.buyPrice || 0,
        buyOrder: ss[0]?.pricePerUnit || 0,
        sellOrder: bs[0]?.pricePerUnit || 0,
        instasell: qs.sellPrice || 0,
        buyVol: qs.sellMovingWeek || 0,
        sellVol: qs.buyMovingWeek || 0,
    };
}

/**
 * Creates a memoized recursive resolver function for shard costs.
 * This is crucial for performance - without memoization, the recursive
 * resolution would have exponential complexity.
 * 
 * @function makeResolver
 * @param {Object} bazaarData - Current bazaar price data
 * @param {string} inputMode - 'instabuy' or 'buy_order' - which price to use
 * @param {Map} cache - Map to store computed values (shared across all calls)
 * @returns {Function} - The resolve function
 */
function makeResolver(bazaarData, inputMode, cache) {
    /**
     * Recursively resolves the cost of a shard.
     * Checks if fusing the shard from sub-shards is cheaper than buying it.
     * 
     * @param {string} shardCode - The shard code to resolve
     * @param {number} depth - Current recursion depth
     * @returns {number} - Resolved cost (minimum of market or craft cost)
     */
    function resolve(shardCode, depth) {
        // Create cache key from shard code and depth
        const key = `${shardCode}:${depth}`;
        // Return cached value if available
        if (cache.has(key)) return cache.get(key);

        // Get shard definition
        const shard = fusionData.shards[shardCode];
        if (!shard) { cache.set(key, 0); return 0; }

        // Get market price based on input mode
        const prices = getShardPrices(bazaarData, shard.internal_id);
        const marketPrice = prices ? (inputMode === 'instabuy' ? prices.instabuy : prices.buyOrder) : 0;

        // Base cases: max depth reached or no market price
        if (depth <= 0 || !marketPrice) {
            cache.set(key, marketPrice);
            return marketPrice;
        }

        // Find fusion recipes for this shard
        const recipes = fusionData.recipes[shardCode];
        if (!recipes) {
            cache.set(key, marketPrice);
            return marketPrice;
        }

        // Find the cheapest fusion recipe
        let best = Infinity;
        for (const [qtyStr, pairs] of Object.entries(recipes)) {
            const outQty = parseInt(qtyStr, 10);
            for (const [in1Code, in2Code] of pairs) {
                const in1Shard = fusionData.shards[in1Code];
                const in2Shard = fusionData.shards[in2Code];
                if (!in1Shard || !in2Shard) continue;
                // Recursively resolve input shard costs
                const c1 = resolve(in1Code, depth - 1);
                const c2 = resolve(in2Code, depth - 1);
                if (!c1 || !c2) continue;
                // Calculate cost per output shard
                const craftCost = (in1Shard.fuse_amount * c1 + in2Shard.fuse_amount * c2) / outQty;
                if (craftCost < best) best = craftCost;
            }
        }

        // Return minimum of craft cost or market price
        const resolved = best < Infinity ? Math.min(best, marketPrice) : marketPrice;
        cache.set(key, resolved);
        return resolved;
    }
    return resolve;
}

// ==========================================
// MAIN COMPUTE FUNCTION
// ==========================================

/**
 * Main computation function for shard fusion profitability.
 * Iterates through all fusion recipes, resolves input costs,
 * calculates profitability, and returns array of opportunities.
 * 
 * @function compute
 * @param {Object} options - Compute options
 * @param {Object} options.bazaarData - Current bazaar price data
 * @param {string} options.inputMode - 'instabuy' or 'buy_order' for inputs
 * @param {string} options.outputMode - 'sell_order' or 'instasell' for outputs
 * @param {number} options.craftDepth - Recursion depth for cost resolution
 * @returns {Array} - Array of profitable fusion opportunities
 */
function compute({ bazaarData, inputMode, outputMode, craftDepth }) {
    const { shards, recipes } = fusionData;
    const seen = new Set();  // Track processed combinations to avoid duplicates
    const out = [];  // Results array
    const cache = new Map(); // Shared cache for all resolve calls in this run
    const resolve = makeResolver(bazaarData, inputMode, cache);

    // Iterate through all output shards with fusion recipes
    for (const [outCode, qtyMap] of Object.entries(recipes)) {
        const outShard = shards[outCode];
        if (!outShard) continue;

        // Get output shard prices
        const outPrices = getShardPrices(bazaarData, outShard.internal_id);
        if (!outPrices) continue;

        // Determine output sell price based on mode
        const outSellPrice = outputMode === 'sell_order' ? outPrices.sellOrder : outPrices.instasell;
        if (!outSellPrice) continue;

        // Iterate through all output quantities for this shard
        for (const [qtyStr, inputPairs] of Object.entries(qtyMap)) {
            const outQty = parseInt(qtyStr, 10);

            // Iterate through all input shard pairs
            for (const [in1Code, in2Code] of inputPairs) {
                // Create canonical key to avoid duplicate processing
                // Sort inputs to treat [A,B] and [B,A] as the same
                const canonKey = [...[in1Code, in2Code].sort(), outCode, outQty].join('|');
                if (seen.has(canonKey)) continue;
                seen.add(canonKey);

                // Get input shard definitions
                const in1Shard = shards[in1Code];
                const in2Shard = shards[in2Code];
                if (!in1Shard || !in2Shard) continue;

                // Get input shard prices
                const in1Prices = getShardPrices(bazaarData, in1Shard.internal_id);
                const in2Prices = getShardPrices(bazaarData, in2Shard.internal_id);
                if (!in1Prices || !in2Prices) continue;

                // Get market prices based on input mode
                const in1MarketPrice = inputMode === 'instabuy' ? in1Prices.instabuy : in1Prices.buyOrder;
                const in2MarketPrice = inputMode === 'instabuy' ? in2Prices.instabuy : in2Prices.buyOrder;

                // Resolve actual costs (may use crafting if depth > 0)
                const in1Cost = craftDepth > 0 ? resolve(in1Code, craftDepth) : in1MarketPrice;
                const in2Cost = craftDepth > 0 ? resolve(in2Code, craftDepth) : in2MarketPrice;
                if (!in1Cost || !in2Cost) continue;

                // Get required quantities for fusion
                const in1Qty = in1Shard.fuse_amount;
                const in2Qty = in2Shard.fuse_amount;

                // Calculate total cost and value
                const cost = in1Qty * in1Cost + in2Qty * in2Cost;
                const value = outQty * outSellPrice;
                const profit = value - cost;
                
                // Skip unprofitable fusions
                if (profit <= 0) continue;

                // Calculate profit percentage
                const profitPct = cost > 0 ? (profit / cost) * 100 : 0;

                // Add to results
                out.push({
                    id: canonKey,
                    in1Code, in2Code, outCode,
                    in1InternalId: in1Shard.internal_id,
                    in2InternalId: in2Shard.internal_id,
                    outInternalId: outShard.internal_id,
                    in1Name: in1Shard.name,
                    in1Qty,
                    in1Price: in1Cost,
                    in1MarketInstabuy: in1Prices.instabuy,
                    in1MarketBuyOrder: in1Prices.buyOrder,
                    in1Volume: in1Prices.buyVol,
                    in1Rarity: in1Shard.rarity?.toLowerCase() || 'common',
                    in2Name: in2Shard.name,
                    in2Qty,
                    in2Price: in2Cost,
                    in2MarketInstabuy: in2Prices.instabuy,
                    in2MarketBuyOrder: in2Prices.buyOrder,
                    in2Volume: in2Prices.buyVol,
                    in2Rarity: in2Shard.rarity?.toLowerCase() || 'common',
                    outName: outShard.name,
                    outQty,
                    outPrice: outSellPrice,
                    outInstasell: outPrices.instasell,
                    outSellOrder: outPrices.sellOrder,
                    outRarity: outShard.rarity?.toLowerCase() || 'common',
                    outVolume: outPrices.sellVol,
                    cost, value, profit, profitPct,
                });
            }
        }
    }

    return out;
}

// ==========================================
// MESSAGE HANDLER
// ==========================================

/**
 * Handles messages from the main thread.
 * This is the entry point for the worker - it receives messages
 * and performs the appropriate action.
 * 
 * @function onmessage
 * @listens self.onmessage
 */
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    // ----------------------------------------
    // LOAD_FUSION_DATA message
    // ----------------------------------------
    if (type === 'LOAD_FUSION_DATA') {
        try {
            // Notify main thread that loading has started
            self.postMessage({ type: 'LOADING', payload: 'Fetching fusion database…' });
            
            // Fetch fusion data from GitHub
            const res = await fetch(FUSION_DATA_URL);
            fusionData = await res.json();
            
            // Notify success with shard count and data
            self.postMessage({ 
                type: 'FUSION_DATA_LOADED', 
                payload: { 
                    shardCount: Object.keys(fusionData.shards).length, 
                    fusionData 
                } 
            });
        } catch (err) {
            // Notify error
            self.postMessage({ type: 'ERROR', payload: err.message });
        }
        return;
    }

    // ----------------------------------------
    // COMPUTE message
    // ----------------------------------------
    if (type === 'COMPUTE') {
        // Check if fusion data is loaded
        if (!fusionData) {
            self.postMessage({ type: 'ERROR', payload: 'Fusion data not loaded yet.' });
            return;
        }
        try {
            // Notify that computation has started
            self.postMessage({ type: 'COMPUTING', payload: 'Running fusion profit engine…' });
            
            // Run the main compute function
            const results = compute(payload);
            
            // Send results back to main thread
            self.postMessage({ type: 'RESULTS', payload: results });
        } catch (err) {
            // Notify error
            self.postMessage({ type: 'ERROR', payload: err.message });
        }
        return;
    }
};
