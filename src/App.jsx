/**
 * App Component - Main Application
 * 
 * This is the heart of the SkyBlock Bazaar Analyzer application.
 * It manages all global state, data fetching from Hypixel APIs,
 * data processing, filtering, and rendering of different view tabs.
 * 
 * @component
 * @file App.jsx
 */
import React, { useState, useEffect, useRef } from 'react';
import RECIPES_DB from './recipes.json';
import { cleanColorCodes, parseCompactNumber, parseFlipTime } from './utils/helpers';
import Header from './components/Header';
import TopBar from './components/FilterMenu';
// Legacy import - ScatterChart is not currently used
// import ScatterChart from './components/ScatterChart';
import DataTable from './components/DataTable';
import SimpleFlipTable from './components/SimpleFlipTable';
import NpcFlipTable from './components/NpcFlipTable';
import ShardFusionTable from './components/ShardFusionTable';

// API Configuration
/**
 * Hypixel Bazaar API endpoint
 * Fetches all bazaar product data including prices, volumes, and orders
 */
const BAZAAR_API_URL = "https://api.hypixel.net/v2/skyblock/bazaar";

/**
 * Hypixel Items API endpoint
 * Fetches NPC sell prices for all items
 */
const NPC_PRICE_API_URL = "https://api.hypixel.net/resources/skyblock/items";

/**
 * Maximum order size limit for Hypixel Bazaar
 * Used for batch calculations (71,680 items)
 */
const MAX_ORDER_LIMIT = 71680;

export default function App() {
    // ==========================================
    // DATA STATES
    // ==========================================
    
    /**
     * Stores all bazaar product data from Hypixel API
     * Structure: { [productId]: { quick_status, buy_summary, sell_summary, ... } }
     */
    const [bazaarData, setBazaarData] = useState({});
    
    /**
     * Maps item IDs to their NPC sell prices
     * Structure: { [itemId]: npcSellPrice }
     */
    const [npcPrices, setNpcPrices] = useState({});
    
    /**
     * Indicates whether API data is currently being fetched
     */
    const [loading, setLoading] = useState(true);

    // ==========================================
    // UI STATES
    // ==========================================
    
    /**
     * Current active tab: 'crafting', 'bazaar', 'npc', or 'shards'
     */
    const [activeTab, setActiveTab] = useState('crafting');
    
    /**
     * Current active NPC sub-tab: 'craft', 'flip', or 'instant'
     * Only used when activeTab === 'npc'
     */
    const [activeNpcTab, setActiveNpcTab] = useState('craft');
    
    /**
     * Text filter for item names (case-insensitive search)
     */
    const [searchTerm, setSearchTerm] = useState('');
    
    /**
     * Currently expanded item ID for detailed view
     * null means no item is expanded
     */
    const [expandedItem, setExpandedItem] = useState(null);
    
    /**
     * Array of item IDs that user has chosen to hide from results
     */
    const [hiddenItems, setHiddenItems] = useState([]);
    
    /**
     * Controls visibility of the hidden items manager panel
     */
    const [showHiddenManager, setShowHiddenManager] = useState(false);
    
    /**
     * Reference to store previous prices for trend detection
     * Uses ref to avoid triggering re-renders when updated
     * Structure: { [productId]: { buyPrice, sellPrice } }
     */
    const prevPricesRef = useRef({});

    // ==========================================
    // FILTER STATES
    // ==========================================
    
    /**
     * All filter settings for data tables
     * These are applied to processed data before display
     */
    const [filters, setFilters] = useState({
        limit: '50',         // Max number of results to display
        minProfit: '0',      // Minimum profit threshold
        minBuyOrders: '0',   // Minimum number of buy orders
        minSellOrders: '0',  // Minimum number of sell orders
        minBuyVolume: '0',   // Minimum buy volume (7d)
        minSellVolume: '0',  // Minimum sell volume (7d)
        maxCraftDepth: '3',  // Maximum recursion depth for ingredient cost resolution (1-3)
        maxFlipTime: '',     // Maximum acceptable flip time (empty = no limit)
        minMarginPct: '',    // Minimum profit margin percentage
        maxMarginPct: '',    // Maximum profit margin percentage
    });

    // ==========================================
    // DATA FETCHING
    // ==========================================
    
    /**
     * Initial data fetch on component mount
     * Fetches bazaar data immediately and sets up interval for refresh
     */
    useEffect(() => {
        fetchBazaarData();
        fetchNpcPrices();
        // Auto-refresh bazaar data every 45 seconds
        const interval = setInterval(fetchBazaarData, 45000);
        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, []);

    /**
     * Fetches bazaar data from Hypixel API
     * - Sets loading state while fetching
     * - Creates snapshot of current prices for trend detection
     * - Updates bazaarData state with product information
     * - Runs every 45 seconds via useEffect
     * 
     * @function fetchBazaarData
     * @returns {Promise<void>}
     */
    const fetchBazaarData = async () => {
        try {
            setLoading(true);
            const res = await fetch(BAZAAR_API_URL);
            const data = await res.json();
            if (data.success) {
                // Create snapshot of current prices for trend comparison
                const snapshot = {};
                Object.keys(data.products).forEach(key => {
                    const qs = data.products[key]?.quick_status;
                    if (qs) snapshot[key] = { buyPrice: qs.buyPrice, sellPrice: qs.sellPrice };
                });
                prevPricesRef.current = snapshot;
                setBazaarData(data.products);
            }
        } catch (err) {
            console.error("Error connecting to Hypixel Bazaar API:", err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Fetches NPC sell prices from Hypixel API
     * - Runs once on component mount
     * - Creates lookup map of item IDs to NPC prices
     * - Only includes items with non-zero NPC sell prices
     * 
     * @function fetchNpcPrices
     * @returns {Promise<void>}
     */
    const fetchNpcPrices = async () => {
        try {
            const res = await fetch(NPC_PRICE_API_URL);
            const data = await res.json();
            if (data.success) {
                // Create map of item IDs to NPC sell prices
                const map = {};
                data.items.forEach(item => {
                    if (item.npc_sell_price) map[item.id] = item.npc_sell_price;
                });
                setNpcPrices(map);
            }
        } catch (err) {
            console.error('Error fetching NPC prices:', err);
        }
    };

    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    
    /**
     * Updates a single filter value
     * Preserves all other filter values
     * 
     * @function handleFilterChange
     * @param {string} key - Filter key to update
     * @param {string|number} value - New value for the filter
     */
    const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

    /**
     * Hides an item from results
     * - Prevents event from bubbling to parent (to avoid expanding row when hiding)
     * - Adds item to hiddenItems if not already hidden
     * - Closes expanded view if hiding the currently expanded item
     * 
     * @function hideItem
     * @param {string} id - Item ID to hide
     * @param {Event} e - Click event (to stop propagation)
     */
    const hideItem = (id, e) => {
        e.stopPropagation();
        if (!hiddenItems.includes(id)) setHiddenItems(prev => [...prev, id]);
        if (expandedItem === id) setExpandedItem(null);
    };

    /**
     * Removes an item from the hidden list
     * 
     * @function unhideItem
     * @param {string} id - Item ID to unhide
     */
    const unhideItem = (id) => setHiddenItems(prev => prev.filter(item => item !== id));

    // ==========================================
    // FILTERING
    // ==========================================
    
    /**
     * Applies all filter settings to an item
     * Returns false if item should be filtered out, true if it should be displayed
     * 
     * @function applyFilters
     * @param {Object} item - The item to check against filters
     * @returns {boolean} - true if item passes all filters, false otherwise
     */
    const applyFilters = (item) => {
        // Hidden items filter
        if (hiddenItems.includes(item.id)) return false;
        
        // Search filter (case-insensitive)
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        // Profit threshold filter
        if (item.profit < parseCompactNumber(filters.minProfit)) return false;
        
        // Order count filters
        if (item.buyOrders < parseCompactNumber(filters.minBuyOrders)) return false;
        if (item.sellOrders < parseCompactNumber(filters.minSellOrders)) return false;
        
        // Volume filters
        if (item.buyVolume < parseCompactNumber(filters.minBuyVolume)) return false;
        if (item.sellVolume < parseCompactNumber(filters.minSellVolume)) return false;

        // Flip time filter
        const flipHours = item.flipTimeHours ?? item.hoursToFill ?? 0;
        const maxFlip = parseFlipTime(filters.maxFlipTime);
        if (flipHours > maxFlip) return false;

        // Margin percentage range filter
        if (filters.minMarginPct !== '' && item.marginPct < parseFloat(filters.minMarginPct)) return false;
        if (filters.maxMarginPct !== '' && item.marginPct > parseFloat(filters.maxMarginPct)) return false;

        // Duplicate check (sell volume) - this appears to be redundant
        if (item.sellVolume < parseCompactNumber(filters.minSellVolume)) return false;

        // Item passed all filters
        return true;
    };

    // ==========================================
    // CORE PROCESSING FUNCTIONS
    // ==========================================
    
    /**
     * Recursively resolves the true cost of an ingredient.
     * This is the heart of the crafting profitability calculation.
     * For each ingredient, it checks if crafting it from sub-ingredients
     * would be cheaper than buying it directly from the bazaar.
     * 
     * @function resolveIngredientCost
     * @param {string} ingId - The ingredient's Hypixel item ID
     * @param {number} depth - Current recursion depth
     * @param {number} maxDepth - Maximum allowed recursion depth (from filters)
     * @returns {number} - The lowest possible cost per unit for this ingredient
     */
    const resolveIngredientCost = (ingId, depth, maxDepth) => {
        // Get the current market price for this ingredient
        const marketPrice = bazaarData[ingId]?.quick_status?.sellPrice || 0;
        
        // Base case: if we've reached max depth, return market price
        if (depth >= maxDepth) return marketPrice;

        // Find the recipe for crafting this ingredient
        const subRecipe = RECIPES_DB.find(r => r.targetItem === ingId);
        if (!subRecipe) return marketPrice;

        // Get output count (default to 1 if not specified)
        const outputCount = subRecipe.outputCount || 1;

        // Calculate the cost of crafting one unit
        let subCraftCost = 0;
        for (const subIng of subRecipe.ingredients) {
            // Recursively resolve each sub-ingredient's cost
            const subPrice = resolveIngredientCost(subIng.id, depth + 1, maxDepth);
            subCraftCost += subPrice * subIng.count;
        }

        // Calculate cost per unit of output
        const costPerUnit = subCraftCost / outputCount;
        
        // Return the cheaper option: craft cost or market price
        // Only use craft cost if it's positive and actually cheaper than market
        return costPerUnit > 0 && costPerUnit < marketPrice ? costPerUnit : marketPrice;
    };

    /**
     * Recursively walks down through ingredient recipes to find the
     * true bottleneck count of raw leaf ingredients needed per craft.
     * 
     * This is used to determine the maximum batch size based on the
     * MAX_ORDER_LIMIT (71,680 items), ensuring we don't exceed the
     * limit for any single raw ingredient.
     * 
     * @function getRawLeafCount
     * @param {string} ingId - The ingredient's Hypixel item ID
     * @param {number} ingCount - The count of this ingredient needed
     * @param {number} depth - Current recursion depth
     * @param {number} maxDepth - Maximum allowed recursion depth
     * @returns {number} - The maximum count of raw leaf ingredients needed
     */
    const getRawLeafCount = (ingId, ingCount, depth, maxDepth) => {
        // Base case: if we've reached max depth, return the ingredient count
        if (depth >= maxDepth) return ingCount;
        
        // Find the recipe for this ingredient
        const subRecipe = RECIPES_DB.find(r => r.targetItem === ingId);
        if (!subRecipe) return ingCount;
        
        // Get output count (default to 1 if not specified)
        const outputCount = subRecipe.outputCount || 1;
        
        // Track the maximum raw count needed across all sub-ingredients
        let maxSubCount = 0;
        for (const subIng of subRecipe.ingredients) {
            // Recursively get the raw count for each sub-ingredient
            const rawCount = getRawLeafCount(subIng.id, subIng.count, depth + 1, maxDepth);
            // Calculate total raw needed for this path
            const totalRaw = (ingCount / outputCount) * rawCount;
            if (totalRaw > maxSubCount) maxSubCount = totalRaw;
        }
        return maxSubCount;
    };
    /**
     * Main processing function for crafting pipeline analysis.
     * This is the most complex function in the application.
     * 
     * Process:
     * 1. Iterates through all recipes from RECIPES_DB
     * 2. For each recipe, resolves ingredient costs recursively
     * 3. Calculates crafting cost per unit
     * 4. Computes profitability for both bazaar and NPC selling
     * 5. Determines best selling option (bazaar vs NPC)
     * 6. Calculates liquidity, flip time, volume metrics
     * 7. Detects price trends vs previous snapshot
     * 
     * @function processCraftingItems
     * @returns {Array} - Array of processed crafting opportunities
     */
    const processCraftingItems = () => {
        const maxDepth = parseInt(filters.maxCraftDepth, 10) || 1;

        return RECIPES_DB.map((recipe) => {
            const targetProduct = bazaarData[recipe.targetItem]?.quick_status;
            if (!targetProduct) return null;

            let maxRawLeafCount = 0;
            recipe.ingredients.forEach(ing => {
                const rawCount = getRawLeafCount(ing.id, ing.count, 1, maxDepth);
                if (rawCount > maxRawLeafCount) maxRawLeafCount = rawCount;
            });
            if (maxRawLeafCount === 0) return null;

            const maxBatchCraftsMultiplier = Math.max(1, Math.floor(MAX_ORDER_LIMIT / maxRawLeafCount));

            const ingredientsWithPrices = recipe.ingredients.map(ing => {
                const ingData = bazaarData[ing.id]?.quick_status;
                const marketUnitPrice = ingData?.sellPrice || 0;
                const unitPrice = resolveIngredientCost(ing.id, 1, maxDepth);
                const isCraftResolved = unitPrice < marketUnitPrice;

                const subRecipe = RECIPES_DB.find(r => r.targetItem === ing.id);
                const subIngredients = subRecipe?.ingredients.map(sub => ({
                    ...sub,
                    name: cleanColorCodes(sub.id.replace(/_/g, ' ')),
                    unitPrice: bazaarData[sub.id]?.quick_status?.sellPrice || 0,
                })) || [];
                const subRecipeOutputCount = subRecipe?.outputCount || 1;

                const singleCraftCount = ing.count;
                const batchCraftCount = singleCraftCount * maxBatchCraftsMultiplier;

                return {
                    ...ing,
                    name: cleanColorCodes(ing.id.replace(/_/g, ' ')),
                    unitPrice,
                    totalPrice: unitPrice * singleCraftCount,
                    sellPrice: marketUnitPrice,
                    resolvedPrice: unitPrice,
                    isCraftResolved,
                    liquidity: ingData ? (ingData.buyMovingWeek + ingData.sellMovingWeek) : 0,
                    buyOrders: ingData ? ingData.buyOrders : 0,
                    sellOrders: ingData ? ingData.sellOrders : 0,
                    batchCount: batchCraftCount,
                    batchCost: unitPrice * batchCraftCount,
                    subIngredients,
                    subRecipeOutputCount,
                };
            });

            let craftCost = 0;
            ingredientsWithPrices.forEach(i => craftCost += i.totalPrice);
            if (craftCost === 0) return null;

            const outputCount = recipe.outputCount || 1;
            const craftCostPerUnit = craftCost / outputCount;

            // Bazaar sell
            const bazaarSellPrice = targetProduct.buyPrice;
            const bazaarProfit = bazaarSellPrice - craftCostPerUnit - (bazaarSellPrice * 0.0125);
            const bazaarMarginPct = craftCostPerUnit > 0 ? (bazaarProfit / craftCostPerUnit) * 100 : 0;

            // NPC sell
            const npcPrice = npcPrices[recipe.targetItem] || null;
            const npcProfit = npcPrice ? npcPrice - craftCostPerUnit : null;
            const npcMarginPct = npcPrice && craftCostPerUnit > 0 ? (npcProfit / craftCostPerUnit) * 100 : null;

            // Best sell destination
            const bestSell = npcProfit !== null && npcProfit > bazaarProfit ? 'npc' : 'bazaar';
            const bestProfit = bestSell === 'npc' ? npcProfit : bazaarProfit;
            const bestMarginPct = bestSell === 'npc' ? npcMarginPct : bazaarMarginPct;
            const bestSellPrice = bestSell === 'npc' ? npcPrice : bazaarSellPrice;

            const liquidity = targetProduct.buyMovingWeek + targetProduct.sellMovingWeek;
            const weeklyIngredientVolume = Math.min(...ingredientsWithPrices.map(i => i.liquidity / 2 || 1));
            const hourlyVolumeVelocity = (weeklyIngredientVolume / 7) / 24;
            const hoursToFill = hourlyVolumeVelocity > 0 ? (MAX_ORDER_LIMIT / hourlyVolumeVelocity) : 999;

            const prev = prevPricesRef.current[recipe.targetItem] || {};

            return {
                id: recipe.targetItem,
                name: cleanColorCodes(recipe.displayName),

                // Bazaar sell fields
                profit: bazaarProfit,
                marginPct: bazaarMarginPct,
                sellPrice: bazaarSellPrice,

                // NPC sell fields
                npcPrice,
                npcProfit,
                npcMarginPct,

                // Best option fields
                bestSell,
                bestProfit,
                bestMarginPct,
                bestSellPrice,

                // Shared fields
                craftCost: craftCostPerUnit,
                liquidity,
                flipTimeHours: hoursToFill,
                hoursToFill,
                buyOrders: targetProduct.buyOrders,
                sellOrders: targetProduct.sellOrders,
                buyVolume: targetProduct.buyVolume,
                sellVolume: targetProduct.sellVolume,
                buy7dVolume: targetProduct.buyMovingWeek,
                sell7dVolume: targetProduct.sellMovingWeek,
                volumeDelta: (targetProduct.buyMovingWeek || 0) - (targetProduct.sellMovingWeek || 0),
                ingredients: ingredientsWithPrices,
                maxBatchCraftsMultiplier,
                totalBatchCost: craftCostPerUnit * maxBatchCraftsMultiplier,
                totalBatchProfit: bazaarProfit * maxBatchCraftsMultiplier,
                npcBatchProfit: npcProfit !== null ? npcProfit * maxBatchCraftsMultiplier : null,
                npcBatchCost: craftCostPerUnit * maxBatchCraftsMultiplier,
                buyTrend: prev.buyPrice
                    ? (bazaarSellPrice > prev.buyPrice ? 'up' : bazaarSellPrice < prev.buyPrice ? 'down' : 'flat')
                    : 'flat',
                sellTrend: 'flat',
            };
        }).filter(Boolean);
    };

    // ==========================================
    // BAZAAR FLIP PROCESSING
    // ==========================================
    
    /**
     * Finds profitable pure bazaar flips (buy order -> sell offer).
     * 
     * A "pure flip" means buying from the best buy order and selling to
     * the best sell offer, without any crafting involved.
     * 
     * Process:
     * 1. Iterates through all bazaar products
     * 2. For each, gets best buy order and sell offer prices
     * 3. Calculates net profit (after 1.25% bazaar tax on sell)
     * 4. Computes buying score (profit × volume) for sorting
     * 5. Calculates flip time based on weekly volume
     * 6. Detects price trends vs previous snapshot
     * 7. Applies filters and sorts by buying score
     * 
     * @function processBazaarFlips
     * @returns {Array} - Sorted array of bazaar flip opportunities
     */
    const processBazaarFlips = () => {
        return Object.keys(bazaarData)
            .map((key) => {
                const p = bazaarData[key];

                // Skip items without buy/sell orders
                if (!p.buy_summary?.[0] || !p.sell_summary?.[0]) return null;

                // Get best prices: we want to BUY low (from buy orders) and SELL high (to sell offers)
                const buyOrderPrice = p.sell_summary[0].pricePerUnit;  // Buy from sell orders (people selling cheap)
                const sellOfferPrice = p.buy_summary[0].pricePerUnit;  // Sell to buy orders (people buying expensive)

                // Calculate profitability
                const grossMargin = sellOfferPrice - buyOrderPrice;
                const tax = sellOfferPrice * 0.0125;  // 1.25% bazaar tax on sell
                const netProfit = grossMargin - tax;

                // Get quick status data
                const quick = p.quick_status || {};
                // Combined weekly volume for liquidity calculation
                const weeklyVol = (quick.buyMovingWeek || 1) + (quick.sellMovingWeek || 1);
                // Estimate time to flip MAX_ORDER_LIMIT items based on weekly volume
                const flipTimeHours = MAX_ORDER_LIMIT / (weeklyVol / (7 * 24));

                // Get previous prices for trend detection
                const prev = prevPricesRef.current[key] || {};

                return {
                    id: key,
                    name: cleanColorCodes(key.replace(/_/g, ' ')),
                    margin: netProfit,
                    buyingScore: netProfit * weeklyVol,  // Higher = better combination of profit and liquidity
                    buyPrice: buyOrderPrice,
                    sellPrice: sellOfferPrice,
                    volume: weeklyVol,
                    marginPct: (netProfit / buyOrderPrice) * 100,
                    flipTimeHours,
                    batchProfit: netProfit * MAX_ORDER_LIMIT,  // Profit for max order size
                    batchCost: buyOrderPrice * MAX_ORDER_LIMIT,  // Cost for max order size
                    volumeDelta: (quick.buyMovingWeek || 0) - (quick.sellMovingWeek || 0),
                    buyTrend: prev.buyPrice
                        ? (buyOrderPrice > prev.buyPrice ? 'up' : buyOrderPrice < prev.buyPrice ? 'down' : 'flat')
                        : 'flat',
                    sellTrend: prev.sellPrice
                        ? (sellOfferPrice > prev.sellPrice ? 'up' : sellOfferPrice < prev.sellPrice ? 'down' : 'flat')
                        : 'flat',
                    profit: netProfit,
                    buyOrders: quick.buyOrders || 0,
                    sellOrders: quick.sellOrders || 0,
                    buyVolume: quick.buyVolume || 0,
                    sellVolume: quick.sellVolume || 0,
                    buy7dVolume: quick.buyMovingWeek || 0,
                    sell7dVolume: quick.sellMovingWeek || 0,
                };
            })
            .filter(Boolean)  // Remove null entries (items without orders)
            .filter(applyFilters)  // Apply user's filter settings
            .sort((a, b) => b.buyingScore - a.buyingScore);  // Sort by buying score (highest first)
    };

    // ==========================================
    // CRAFTING FLIP PROCESSING
    // ==========================================
    
    /**
     * Filters crafting items to only show profitable ones
     * and applies user filters.
     * 
     * @function processCraftingFlips
     * @returns {Array} - Filtered array of profitable crafting opportunities
     */
    const processCraftingFlips = () =>
        processCraftingItems()
            .filter(item => item.profit > 0)  // Only profitable items
            .filter(applyFilters);  // Apply user's filter settings

    // ==========================================
    // NPC CRAFT FLIP PROCESSING
    // ==========================================
    
    /**
     * Filters crafting items to only show those profitable when
     * selling to NPC instead of bazaar.
     * 
     * @function processNpcCraftFlips
     * @returns {Array} - Filtered array of profitable NPC craft opportunities
     */
    const processNpcCraftFlips = () =>
        processCraftingItems()
            .filter(item => item.npcProfit !== null && item.npcProfit > 0)  // Only items with NPC profit
            // Apply filters with NPC profit/margin instead of bazaar values
            .filter(i => applyFilters({ ...i, profit: i.npcProfit, marginPct: i.npcMarginPct }));

    // ==========================================
    // NPC FLIP PROCESSING (ALL TYPES)
    // ==========================================
    
    /**
     * Finds all NPC flip opportunities (3 types combined):
     * 1. Craft → NPC: Craft items and sell to NPC
     * 2. Buy Order → NPC: Buy from bazaar buy orders, sell to NPC
     * 3. Instant Buy → NPC: Use instant buy, sell to NPC
     * 
     * @function processNpcFlips
     * @returns {Array} - Combined and filtered array of all NPC flip opportunities
     */
    const processNpcFlips = () => {
        const MAX_BATCH = MAX_ORDER_LIMIT;
        const results = [];

        // Craft → NPC: reuse shared processor, remap fields for NpcFlipTable shape
        processNpcCraftFlips().forEach(item => {
            results.push({
                ...item,
                source: 'craft',
                acquireCost: item.craftCost,
                npcProfit: item.npcProfit,
                npcMarginPct: item.npcMarginPct,
                marginPct: item.npcMarginPct,
                batchSize: item.maxBatchCraftsMultiplier,
                npcBatchProfit: item.npcBatchProfit,
                npcBatchCost: item.npcBatchCost,
                profit: item.npcProfit,
            });
        });

        // Buy order → NPC: unchanged
        Object.keys(bazaarData).forEach((key) => {
            const npcPrice = npcPrices[key];
            if (!npcPrice) return;

            const p = bazaarData[key];
            if (!p.sell_summary?.[0]) return;

            const buyOrderPrice = p.sell_summary[0].pricePerUnit;
            const npcProfit = npcPrice - buyOrderPrice;
            if (npcProfit <= 0) return;

            const quick = p.quick_status || {};
            const npcMarginPct = (npcProfit / buyOrderPrice) * 100;
            const weeklyVol = (quick.buyMovingWeek || 1) + (quick.sellMovingWeek || 1);
            const flipTimeHours = MAX_BATCH / (weeklyVol / (7 * 24));

            results.push({
                id: key,
                name: cleanColorCodes(key.replace(/_/g, ' ')),
                source: 'flip',
                npcPrice,
                acquireCost: buyOrderPrice,
                npcProfit,
                npcMarginPct,
                marginPct: npcMarginPct,
                batchSize: MAX_BATCH,
                npcBatchProfit: npcProfit * MAX_BATCH,
                npcBatchCost: buyOrderPrice * MAX_BATCH,
                totalVolume: weeklyVol,
                buy7dVolume: quick.buyMovingWeek || 0,
                sell7dVolume: quick.sellMovingWeek || 0,
                volumeDelta: (quick.buyMovingWeek || 0) - (quick.sellMovingWeek || 0),
                profit: npcProfit,
                buyOrders: quick.buyOrders || 0,
                sellOrders: quick.sellOrders || 0,
                buyVolume: quick.buyVolume || 0,
                sellVolume: quick.sellVolume || 0,
                flipTimeHours,
                hoursToFill: flipTimeHours,
            });
        });

        // ── INSTANT BUY → NPC ────────────────────────────────────────
        Object.keys(bazaarData).forEach((key) => {
            const npcPrice = npcPrices[key];
            if (!npcPrice) return;

            const p = bazaarData[key];
            const quick = p.quick_status || {};

            const instantBuyPrice = quick.buyPrice || 0;
            if (!instantBuyPrice) return;

            const npcProfit = npcPrice - instantBuyPrice;
            if (npcProfit <= 0) return;

            const npcMarginPct = (npcProfit / instantBuyPrice) * 100;
            const weeklyVol = (quick.buyMovingWeek || 1) + (quick.sellMovingWeek || 1);
            const flipTimeHours = MAX_BATCH / (weeklyVol / (7 * 24));

            results.push({
                id: key + '_instant',
                name: cleanColorCodes(key.replace(/_/g, ' ')),
                source: 'instant',
                npcPrice,
                acquireCost: instantBuyPrice,
                npcProfit,
                npcMarginPct,
                marginPct: npcMarginPct,
                batchSize: MAX_BATCH,
                npcBatchProfit: npcProfit * MAX_BATCH,
                npcBatchCost: instantBuyPrice * MAX_BATCH,
                totalVolume: weeklyVol,
                buy7dVolume: quick.buyMovingWeek || 0,
                sell7dVolume: quick.sellMovingWeek || 0,
                volumeDelta: (quick.buyMovingWeek || 0) - (quick.sellMovingWeek || 0),
                profit: npcProfit,
                buyOrders: quick.buyOrders || 0,
                sellOrders: quick.sellOrders || 0,
                buyVolume: quick.buyVolume || 0,
                sellVolume: quick.sellVolume || 0,
                flipTimeHours,
                hoursToFill: flipTimeHours,
            });
        });

        return results.filter(applyFilters);
    };

    // ==========================================
    // DATA SELECTION FOR DISPLAY
    // ==========================================
    
    /**
     * Selects the active dataset based on current tab
     * - NPC tab: Uses processNpcFlips()
     * - Crafting tab: Uses processCraftingFlips()
     * - Other tabs: Uses processBazaarFlips()
     * All sorted by profit (highest first)
     */
    const activeDataSet = activeTab === 'npc'
        ? processNpcFlips()
        : (activeTab === 'crafting' ? processCraftingFlips() : processBazaarFlips())
            .sort((a, b) => b.profit - a.profit);

    /**
     * Slices the active dataset to the user's specified limit
     */
    const displayedData = activeDataSet.slice(0, parseInt(filters.limit, 10) || 50);

    // For NPC tab, calculate counts for sub-tabs
    const npcData = activeTab === 'npc' ? processNpcFlips() : [];
    const npcCraftCount = npcData.filter(i => i.source === 'craft').length;
    const npcFlipCount = npcData.filter(i => i.source === 'flip').length;

    // ==========================================
    // RENDER
    // ==========================================
    
    return (
        // Main application container with dark theme
        <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased font-sans p-4 md:p-8">
            {/* Main content container with max width and vertical spacing */}
            <div className="max-w-9xl mx-auto space-y-6">

                {/* Header with search, refresh, and hidden items manager */}
                <Header
                    loading={loading}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    fetchBazaarData={fetchBazaarData}
                    hiddenItems={hiddenItems}
                    setHiddenItems={setHiddenItems}
                    showHiddenManager={showHiddenManager}
                    setShowHiddenManager={setShowHiddenManager}
                    unhideItem={unhideItem}
                />

                {/* Main grid layout for content */}
                <div className="grid grid-cols-1 gap-6 items-start">

                    {/* Main content section (spans 3 columns on large screens) */}
                    <section className="lg:col-span-3 space-y-6">

                        {/* Filter controls bar */}
                        <TopBar filters={filters} handleFilterChange={handleFilterChange} />
                        {/* Tab navigation for different analysis views */}
                        <div className="bg-[#121214] p-1 rounded-lg border border-zinc-800 inline-flex w-full sm:w-auto">
                            {/* Crafting Pipeline Tab - Shows items profitable to craft */}
                            <button
                                onClick={() => { setActiveTab('crafting'); setExpandedItem(null); }}
                                className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'crafting' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Crafting Pipeline ({processCraftingFlips().length})
                            </button>
                            
                            {/* Pure Orders Tab - Shows profitable buy/sell order spreads */}
                            <button
                                onClick={() => { setActiveTab('bazaar'); setExpandedItem(null); }}
                                className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'bazaar' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Pure Orders ({processBazaarFlips().length})
                            </button>
                            
                            {/* NPC Flips Tab - Shows items profitable to sell to NPCs */}
                            <button
                                onClick={() => { setActiveTab('npc'); setExpandedItem(null); }}
                                className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'npc' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                NPC Flips ({processNpcFlips().length})
                            </button>
                            
                            {/* Shard Fusion Tab - Shows profitable shard fusion combinations */}
                            <button
                                onClick={() => { setActiveTab('shards'); setExpandedItem(null); }}
                                className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeTab === 'shards' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Shard Fusion
                            </button>
                        </div>

                        {/* Render the appropriate table based on active tab */}
                        {activeTab === 'crafting' ? (
                            {/* Crafting Pipeline Table - Shows expandable crafting opportunities */}
                            <DataTable
                                displayedData={displayedData}
                                activeTab={activeTab}
                                expandedItem={expandedItem}
                                setExpandedItem={setExpandedItem}
                                hideItem={hideItem}
                            />
                        ) : activeTab === 'bazaar' ? (
                            {/* Pure Orders Table - Shows bazaar flip opportunities */}
                            <SimpleFlipTable displayedData={displayedData} />
                        ) : activeTab === 'npc' ? (
                            {/* NPC Flips Table - Shows NPC selling opportunities with sub-tabs */}
                            <NpcFlipTable
                                displayedData={npcData.filter(i => i.source === activeNpcTab).slice(0, parseInt(filters.limit, 10) || 50)}
                                activeNpcTab={activeNpcTab}
                                setActiveNpcTab={setActiveNpcTab}
                                counts={{ 
                                    craft: npcCraftCount, 
                                    flip: npcFlipCount, 
                                    instant: npcData.filter(i => i.source === 'instant').length, 
                                }}
                            />
                        ) : activeTab === 'shards' ? (
                            {/* Shard Fusion Table - Uses Web Worker for heavy computations */}
                            <ShardFusionTable bazaarData={bazaarData} />
                        ) : null}

                    </section>
                </div>
            </div>
        </div>
    );
}
