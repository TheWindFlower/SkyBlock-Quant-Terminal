/**
 * Shard Fusion Web Worker
 * 
 * This Web Worker runs in a background thread to perform computationally intensive
 * shard fusion profitability calculations without blocking the main UI thread.
 * 
 * The shard fusion system in Hypixel SkyBlock allows players to combine two shards
 * to create a higher-tier shard. This worker calculates which fusions are profitable
 * by comparing the cost of buying input shards vs. the value of the output shard.
 * 
 * Key Features:
 * - Asynchronous data loading from GitHub (~1.8MB fusion database)
 * - Recursive cost resolution with memoization for performance
 * - Deep fusion support (checking if inputs can be profitably fused from sub-shards)
 * - Batch processing of all possible fusion combinations
 * 
 * Communication Protocol:
 * - Main thread sends messages via postMessage()
 * - Worker receives messages via self.onmessage
 * - Worker sends responses via self.postMessage()
 * 
 * Message Types:
 * - LOAD_FUSION_DATA: Instructs worker to fetch fusion data from GitHub
 * - COMPUTE: Triggers profit calculations with current bazaar data and settings
 * - LOADING: Status update sent during data loading (with progress message)
 * - FUSION_DATA_LOADED: Data loaded successfully (includes shard count and data)
 * - COMPUTING: Status update sent during computation
 * - RESULTS: Calculation results ready (array of profitable fusion opportunities)
 * - ERROR: Error occurred (includes error message)
 * 
 * @file workers/shardWorker.js
 * @context Web Worker (no DOM access, no React, pure JavaScript)
 * @author Part of SkyBlock Bazaar Analyzer
 */

/**
 * URL for external shard fusion data repository
 * 
 * This JSON file contains all shard definitions and fusion recipes for Hypixel SkyBlock.
 * It's maintained externally at: https://github.com/HichamIDDIR/Hypixel-Skyblock-Shards-Profit-Tracker
 * 
 * Structure of the data:
 * - shards: Map of shard codes to shard definitions
 *   - Each shard has: name, internal_id (Hypixel API ID), rarity, fuse_amount
 * - recipes: Map of output shard codes to fusion recipes
 *   - Each recipe maps output quantity to array of input shard code pairs
 *   - Example: { "2": [["SHARD_1", "SHARD_2"], ["SHARD_3", "SHARD_4"]] }
 *     means 2 output shards can be crafted from either SHARD_1+SHARD_2 or SHARD_3+SHARD_4
 * 
 * File size: ~1.8MB (compressed JSON)
 * Loading time: Typically 1-3 seconds depending on network
 */
const FUSION_DATA_URL = 'https://raw.githubusercontent.com/HichamIDDIR/Hypixel-Skyblock-Shards-Profit-Tracker/refs/heads/main/fusion-data.json';

/**
 * Global variable to store the loaded fusion data
 * 
 * This data is loaded once when the worker starts and reused for all subsequent
 * compute requests. It contains the complete shard database needed for all
 * fusion profitability calculations.
 * 
 * Structure:
 * {
 *   shards: { [shardCode: string]: ShardDefinition }
 *   recipes: { [outputShardCode: string]: { [outputQty: string]: [inputPair: [string, string]] } }
 * }
 * 
 * Initialized as null, populated after successful LOAD_FUSION_DATA message
 * 
 * @type {Object|null}
 * @property {Object} shards - Map of shard codes to shard metadata
 * @property {Object} recipes - Map of output shards to their fusion recipes
 */
let fusionData = null;

// ==========================================
// HELPER FUNCTIONS
// ==========================================
// These utility functions extract and process data from the Hypixel Bazaar API
// and fusion database, providing the building blocks for profit calculations.

/**
 * Extracts and normalizes price data for a specific shard from Hypixel Bazaar API data.
 * 
 * The Hypixel Bazaar API returns nested price data in multiple formats:
 * - quick_status: Contains instant buy/sell prices (higher liquidity, higher spread)
 * - sell_summary: Array of active sell orders, sorted by price (best first)
 * - buy_summary: Array of active buy orders, sorted by price (best first)
 * 
 * This function extracts the most relevant prices for profit calculations.
 * 
 * @function getShardPrices
 * @param {Object} bazaarData - Full bazaar data object from Hypixel API
 * @param {string} internalId - Hypixel item ID for the shard (e.g., "ENCHANTED_DIAMOND")
 * @returns {Object|null} - Extracted price data object, or null if shard not found
 * @property {number} instabuy - Instant buy price from quick_status (highest ask price)
 * @property {number} buyOrder - Best buy order price from sell_summary[0] (lowest ask)
 * @property {number} sellOrder - Best sell order price from buy_summary[0] (highest bid)
 * @property {number} instasell - Instant sell price from quick_status (lowest bid price)
 * @property {number} buyVol - 7-day buy volume (items bought in last week)
 * @property {number} sellVol - 7-day sell volume (items sold in last week)
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
 * 
 * This is the core algorithm that determines the true cost of a shard by considering
 * both direct purchase from the Bazaar AND the option to fuse it from sub-shards.
 * 
 * Performance Considerations:
 * - Memoization (caching) is CRITICAL: Without it, recursive resolution would have
 *   exponential complexity O(b^d) where b is branching factor and d is depth
 * - The cache uses a Map with composite keys (shardCode:depth) to avoid redundant
 *   calculations when the same shard is needed at different depths
 * - Shared cache across all resolve calls in a single compute run ensures
 *   maximum efficiency
 * 
 * Recursion Logic:
 * For a given shard, the resolver:
 * 1. Checks if we've already computed this shard at this depth (cache hit)
 * 2. Gets the shard definition from fusionData
 * 3. Gets the market price from bazaarData
 * 4. If depth <= 0 or no market price, returns market price (base case)
 * 5. Checks all fusion recipes for this shard
 * 6. For each recipe, recursively resolves the cost of input shards
 * 7. Calculates craft cost = (in1Cost * in1Qty + in2Cost * in2Qty) / outputQty
 * 8. Returns the minimum of craft cost and market price
 * 
 * @function makeResolver
 * @param {Object} bazaarData - Current bazaar price data from Hypixel API
 * @param {string} inputMode - Price source for inputs: 'instabuy' or 'buy_order'
 * @param {Map} cache - Map instance to store computed values (shared across all resolve calls)
 * @returns {Function} - The resolve function that can be called with (shardCode, depth)
 */
function makeResolver(bazaarData, inputMode, cache) {
    /**
     * Recursively resolves the cost of a shard.
     * 
     * This is the inner recursive function that does the actual work of determining
     * whether it's cheaper to buy a shard directly or to fuse it from sub-shards.
     * 
     * The algorithm works by:
     * 1. Checking cache first (memoization for performance)
     * 2. Looking up the shard definition and its market price
     * 3. Checking if recursion should stop (depth limit or no price data)
     * 4. Finding all possible fusion recipes for this shard
     * 5. For each recipe, recursively calculating the cost of inputs
     * 6. Comparing craft cost vs market price and returning the minimum
     * 
     * @param {string} shardCode - The shard code to resolve (e.g., "SHARD_DIAMOND")
     * @param {number} depth - Current recursion depth (starts at craftDepth, decrements each level)
     * @returns {number} - Resolved cost (minimum of market price or best craft cost)
     */
    function resolve(shardCode, depth) {
        // Create unique cache key combining shard code and current depth
        // This allows the same shard to have different costs at different depths
        const key = `${shardCode}:${depth}`;
        
        // Return cached value if we've already computed this shard at this depth
        // This memoization prevents exponential recomputation
        if (cache.has(key)) return cache.get(key);

        // Get shard definition from the fusion database
        const shard = fusionData.shards[shardCode];
        // If shard doesn't exist in database, cache 0 and return
        if (!shard) { cache.set(key, 0); return 0; }

        // Extract price data from bazaar for this shard's Hypixel item ID
        const prices = getShardPrices(bazaarData, shard.internal_id);
        // Determine which price to use based on user's input mode selection
        const marketPrice = prices ? (inputMode === 'instabuy' ? prices.instabuy : prices.buyOrder) : 0;

        // Base cases: stop recursion if we've reached max depth or have no price data
        // This prevents infinite recursion and handles missing data gracefully
        if (depth <= 0 || !marketPrice) {
            cache.set(key, marketPrice);
            return marketPrice;
        }

        // Look up all fusion recipes that can produce this shard
        const recipes = fusionData.recipes[shardCode];
        // If no fusion recipes exist for this shard, must buy from bazaar
        if (!recipes) {
            cache.set(key, marketPrice);
            return marketPrice;
        }

        // Find the cheapest way to craft this shard by checking all recipes
        // Each recipe produces a certain quantity (outQty) from pairs of input shards
        let best = Infinity; // Track the lowest craft cost found
        
        for (const [qtyStr, pairs] of Object.entries(recipes)) {
            const outQty = parseInt(qtyStr, 10); // How many output shards this recipe produces
            
            // Each recipe can have multiple valid input shard pairs
            for (const [in1Code, in2Code] of pairs) {
                // Get input shard definitions
                const in1Shard = fusionData.shards[in1Code];
                const in2Shard = fusionData.shards[in2Code];
                if (!in1Shard || !in2Shard) continue; // Skip if shards don't exist
                
                // Recursively resolve the cost of input shards (with reduced depth)
                const c1 = resolve(in1Code, depth - 1);
                const c2 = resolve(in2Code, depth - 1);
                if (!c1 || !c2) continue; // Skip if we can't determine input costs
                
                // Calculate craft cost per output shard:
                // (input1_cost * input1_quantity + input2_cost * input2_quantity) / output_quantity
                // Each shard has a fuse_amount which is how many are needed for fusion
                const craftCost = (in1Shard.fuse_amount * c1 + in2Shard.fuse_amount * c2) / outQty;
                
                // Track the cheapest craft option
                if (craftCost < best) best = craftCost;
            }
        }

        // Return the minimum of craft cost or direct market purchase
        // If we found a valid craft recipe (best < Infinity), compare with market
        // Otherwise, use market price (can't craft this shard)
        const resolved = best < Infinity ? Math.min(best, marketPrice) : marketPrice;
        
        // Cache the result for future lookups at this depth
        cache.set(key, resolved);
        return resolved;
    }
    return resolve;
}

// ==========================================
// MAIN COMPUTE FUNCTION
// ==========================================
// This is the primary function that orchestrates the entire profit calculation.
// It iterates through all possible fusion combinations, resolves the true cost
// of inputs (including deep fusion), and calculates profitability.

/**
 * Main computation function for shard fusion profitability analysis.
 * 
 * This is the entry point for all profit calculations. It performs the following:
 * 
 * 1. Iterates through all shards that have fusion recipes (output shards)
 * 2. For each output shard, checks all its fusion recipes
 * 3. For each recipe, checks all input shard pairs
 * 4. Resolves the true cost of each input (with optional deep fusion)
 * 5. Calculates total cost, output value, and profit
 * 6. Filters to only profitable fusions
 * 7. Returns detailed information about each profitable opportunity
 * 
 * The function uses a Set to track processed combinations and avoid duplicates.
 * Since fusion is commutative (A+B = B+A), it creates canonical keys by sorting inputs.
 * 
 * Performance: O(n * r * p) where n = number of output shards,
 * r = average recipes per shard, p = average pairs per recipe
 * With memoization in resolve(), this remains efficient even with deep fusion.
 * 
 * @function compute
 * @param {Object} options - Configuration object for the computation
 * @param {Object} options.bazaarData - Current bazaar price data from Hypixel API
 * @param {string} options.inputMode - Price source for inputs: 'instabuy' (instant buy) or 'buy_order' (best sell order)
 * @param {string} options.outputMode - Price source for outputs: 'sell_order' (best buy order) or 'instasell' (instant sell)
 * @param {number} options.craftDepth - Maximum recursion depth for cost resolution (0 = no deep fusion, 1-3 = check sub-fusions)
 * @returns {Array<Object>} - Array of profitable fusion opportunity objects, each containing:
 *   - Shard codes and names for inputs and output
 *   - Quantities required for fusion
 *   - Price data (market and resolved costs)
 *   - Volume data for liquidity assessment
 *   - Profit and margin calculations
 */
function compute({ bazaarData, inputMode, outputMode, craftDepth }) {
    // Extract shard definitions and recipes from loaded fusion data
    const { shards, recipes } = fusionData;
    
    // Track processed combinations to avoid duplicate calculations
    // Fusion is commutative (A+B produces same as B+A), so we canonicalize keys
    const seen = new Set();  // Stores canonical keys like "SHARD_A|SHARD_B|OUTPUT|2"
    
    // Results array that will be populated with profitable fusion opportunities
    const out = [];  
    
    // Shared cache for all resolve() calls in this compute run
    // This ensures that if the same shard is needed multiple times, it's only calculated once
    const cache = new Map(); 
    
    // Create the resolver function with current bazaar data and settings
    const resolve = makeResolver(bazaarData, inputMode, cache);

    // ==========================================
    // MAIN LOOP: Iterate through all possible fusions
    // ==========================================
    
    // Iterate through all output shards that have fusion recipes
    // Each key in recipes is a shard code that can be produced via fusion
    for (const [outCode, qtyMap] of Object.entries(recipes)) {
        // Get the shard definition for this output
        const outShard = shards[outCode];
        if (!outShard) continue; // Skip if shard definition missing

        // Extract price data for the output shard from bazaar
        const outPrices = getShardPrices(bazaarData, outShard.internal_id);
        if (!outPrices) continue; // Skip if no price data available

        // Determine the selling price based on user's output mode selection
        // sell_order = best buy order (highest bid), instasell = instant sell (lowest ask)
        const outSellPrice = outputMode === 'sell_order' ? outPrices.sellOrder : outPrices.instasell;
        if (!outSellPrice) continue; // Skip if we can't sell the output

        // Iterate through all fusion recipes for this output shard
        // Each recipe produces a different quantity (e.g., 2 output shards, 4 output shards)
        for (const [qtyStr, inputPairs] of Object.entries(qtyMap)) {
            const outQty = parseInt(qtyStr, 10); // Number of output shards this recipe produces

            // Iterate through all valid input shard pairs for this recipe
            // Each pair represents a valid combination to produce the output
            for (const [in1Code, in2Code] of inputPairs) {
                // Create a canonical key to identify this fusion combination
                // Sort inputs to treat A+B and B+A as the same (fusion is commutative)
                const canonKey = [...[in1Code, in2Code].sort(), outCode, outQty].join('|');
                
                // Skip if we've already processed this exact combination
                if (seen.has(canonKey)) continue;
                seen.add(canonKey);

                // Get shard definitions for both inputs
                const in1Shard = shards[in1Code];
                const in2Shard = shards[in2Code];
                if (!in1Shard || !in2Shard) continue; // Skip if input shard definitions missing

                // Extract price data for input shards from bazaar
                const in1Prices = getShardPrices(bazaarData, in1Shard.internal_id);
                const in2Prices = getShardPrices(bazaarData, in2Shard.internal_id);
                if (!in1Prices || !in2Prices) continue; // Skip if price data missing

                // Get market prices for inputs based on user's input mode selection
                // instabuy = instant buy (highest ask), buy_order = best sell order (lowest ask)
                const in1MarketPrice = inputMode === 'instabuy' ? in1Prices.instabuy : in1Prices.buyOrder;
                const in2MarketPrice = inputMode === 'instabuy' ? in2Prices.instabuy : in2Prices.buyOrder;

                // Resolve the actual cost of each input
                // If craftDepth > 0, recursively check if inputs can be fused cheaper
                // If craftDepth = 0, just use the market price (no deep fusion)
                const in1Cost = craftDepth > 0 ? resolve(in1Code, craftDepth) : in1MarketPrice;
                const in2Cost = craftDepth > 0 ? resolve(in2Code, craftDepth) : in2MarketPrice;
                if (!in1Cost || !in2Cost) continue; // Skip if we can't determine costs

                // Get the quantity of each input shard required for fusion
                // fuse_amount is a property of each shard defining how many are consumed per fusion
                const in1Qty = in1Shard.fuse_amount;
                const in2Qty = in2Shard.fuse_amount;

                // ==========================================
                // PROFIT CALCULATION
                // ==========================================
                
                // Calculate total cost to perform one fusion
                // cost = (input1_quantity * input1_price) + (input2_quantity * input2_price)
                const cost = in1Qty * in1Cost + in2Qty * in2Cost;
                
                // Calculate total value of the output
                // value = output_quantity * output_sell_price
                const value = outQty * outSellPrice;
                
                // Calculate gross profit
                // profit = output_value - total_cost
                const profit = value - cost;
                
                // Skip unprofitable fusions (we only want opportunities where profit > 0)
                if (profit <= 0) continue;

                // Calculate profit percentage (return on investment)
                // profitPct = (profit / cost) * 100
                const profitPct = cost > 0 ? (profit / cost) * 100 : 0;
                
                //sell time calculation
                const sellTime = 7*24*60*60 / outPrices.sellVol;
                // ==========================================
                // BUILD RESULT OBJECT
                // ==========================================
                // Add this profitable fusion to the results array
                // The result object contains all data needed for display in the UI
                out.push({
                    // Unique identifier for this fusion combination
                    id: canonKey,
                    
                    // Shard codes for reference
                    in1Code, in2Code, outCode,
                    
                    // Hypixel internal IDs for API lookups
                    in1InternalId: in1Shard.internal_id,
                    in2InternalId: in2Shard.internal_id,
                    outInternalId: outShard.internal_id,
                    
                    // Shard names for display
                    in1Name: in1Shard.name,
                    in2Name: in2Shard.name,
                    outName: outShard.name,
                    
                    // Fusion quantities
                    in1Qty,        // How many of input 1 are needed
                    in2Qty,        // How many of input 2 are needed
                    outQty,        // How many output shards are produced
                    
                    // Resolved prices (may include deep fusion savings)
                    in1Price: in1Cost,
                    in2Price: in2Cost,
                    outPrice: outSellPrice,
                    
                    // Market prices for comparison (actual bazaar prices without fusion)
                    in1MarketInstabuy: in1Prices.instabuy,
                    in1MarketBuyOrder: in1Prices.buyOrder,
                    in2MarketInstabuy: in2Prices.instabuy,
                    in2MarketBuyOrder: in2Prices.buyOrder,
                    outInstasell: outPrices.instasell,
                    outSellOrder: outPrices.sellOrder,
                    
                    // Rarities for color-coding in UI
                    in1Rarity: in1Shard.rarity?.toLowerCase() || 'common',
                    in2Rarity: in2Shard.rarity?.toLowerCase() || 'common',
                    outRarity: outShard.rarity?.toLowerCase() || 'common',
                    
                    // 7-day trading volumes for liquidity assessment
                    in1Volume: in1Prices.buyVol,
                    in2Volume: in2Prices.buyVol,
                    outVolume: outPrices.sellVol,
                    
                    // Profitability metrics
                    cost,           // Total cost per fusion
                    value,          // Total output value per fusion
                    profit,         // Net profit per fusion
                    profitPct,      // Profit margin as percentage
                    
                    //expected flip time
                    sellTime,
                });
            }
        }
    }

    return out;
}

// ==========================================
// MESSAGE HANDLER
// ==========================================
// This is the entry point for the worker. It receives messages from the main
// thread via postMessage() and performs the requested actions.

/**
 * Main message handler for the Web Worker.
 * 
 * This function is automatically called when the worker receives a message
 * from the main thread. It processes the message based on its type and
 * performs the appropriate action:
 * - LOAD_FUSION_DATA: Fetch and load fusion data from GitHub
 * - COMPUTE: Run profit calculations with provided bazaar data
 * 
 * The handler sends status updates and results back to the main thread
 * using self.postMessage() with appropriate message types.
 * 
 * @function onmessage
 * @listens self.onmessage
 * @param {MessageEvent} e - The message event containing data from main thread
 * @param {Object} e.data - The message payload
 * @param {string} e.data.type - Message type identifier
 * @param {Object} e.data.payload - Message-specific data payload
 */
self.onmessage = async (e) => {
    // Extract message type and payload from the event data
    const { type, payload } = e.data;

    // ----------------------------------------
    // HANDLE LOAD_FUSION_DATA MESSAGE
    // ----------------------------------------
    // This message instructs the worker to fetch fusion data from GitHub
    if (type === 'LOAD_FUSION_DATA') {
        try {
            // Immediately notify main thread that loading has started
            // This allows the UI to show a loading indicator
            self.postMessage({ type: 'LOADING', payload: 'Fetching fusion database…' });
            
            // Fetch the fusion data file from GitHub
            // This is a ~1.8MB JSON file containing all shard definitions and recipes
            const res = await fetch(FUSION_DATA_URL);
            
            // Parse the JSON response and store it globally
            fusionData = await res.json();
            
            // Notify main thread that data loaded successfully
            // Include the number of shards loaded for UI display
            self.postMessage({ 
                type: 'FUSION_DATA_LOADED', 
                payload: { 
                    shardCount: Object.keys(fusionData.shards).length, // Total number of shards in database
                    fusionData    // The complete fusion data object (for caching in main thread if needed)
                } 
            });
        } catch (err) {
            // If any error occurs during loading, notify main thread
            // This allows the UI to show an error message to the user
            self.postMessage({ type: 'ERROR', payload: err.message });
        }
        return; // Exit early - no further processing needed
    }

    // ----------------------------------------
    // HANDLE COMPUTE MESSAGE
    // ----------------------------------------
    // This message instructs the worker to run profit calculations
    if (type === 'COMPUTE') {
        // Verify that fusion data has been loaded before computing
        // This prevents errors if COMPUTE is called before LOAD_FUSION_DATA completes
        if (!fusionData) {
            self.postMessage({ type: 'ERROR', payload: 'Fusion data not loaded yet.' });
            return;
        }
        
        try {
            // Notify main thread that computation has started
            // This allows the UI to show a computing indicator
            self.postMessage({ type: 'COMPUTING', payload: 'Running fusion profit engine…' });
            
            // Run the main compute function with the provided payload
            // Payload contains: bazaarData, inputMode, outputMode, craftDepth
            const results = compute(payload);
            
            // Send the computed results back to main thread
            // The results array contains all profitable fusion opportunities
            self.postMessage({ type: 'RESULTS', payload: results });
        } catch (err) {
            // If any error occurs during computation, notify main thread
            self.postMessage({ type: 'ERROR', payload: err.message });
        }
        return; // Exit early - no further processing needed
    }
    
    // Note: Additional message types can be added here in the future
    // For now, we only handle LOAD_FUSION_DATA and COMPUTE
};
