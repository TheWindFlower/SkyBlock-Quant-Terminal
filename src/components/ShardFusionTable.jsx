// ShardFusionTable.jsx
import React, { useState, useEffect, useRef } from 'react';
import { formatNum,parseCompactNumber } from '../utils/helpers';

const RARITY_COLORS = {
    common: 'text-zinc-300 bg-zinc-800/60 border-zinc-700',
    uncommon: 'text-green-400 bg-green-950/40 border-green-800/60',
    rare: 'text-blue-400 bg-blue-950/40 border-blue-800/60',
    epic: 'text-purple-400 bg-purple-950/40 border-purple-800/60',
    legendary: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
    mythic: 'text-pink-400 bg-pink-950/40 border-pink-800/60',
};

const rc = (r) => RARITY_COLORS[r?.toLowerCase()] || RARITY_COLORS.common;

function useSortableData(data, defaultKey = 'profit') {
    const [sortConfig, setSortConfig] = useState({ key: defaultKey, dir: 'desc' });
    const sorted = [...data].sort((a, b) => {
        const av = a[sortConfig.key] ?? 0;
        const bv = b[sortConfig.key] ?? 0;
        if (typeof av === 'string') return sortConfig.dir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
        return sortConfig.dir === 'desc' ? bv - av : av - bv;
    });
    const toggle = (key) => setSortConfig(prev =>
        prev.key === key
            ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
            : { key, dir: 'desc' }
    );
    return { sorted, sortConfig, toggle };
}

function SortTh({ label, colKey, sortConfig, toggle, className = '', title }) {
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

// ── Loading panel ────────────────────────────────────────────────────────
function LoadingPanel({ status, shardCount }) {
    const [dots, setDots] = useState('');
    useEffect(() => {
        const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="bg-[#121214] border border-zinc-800 rounded-xl p-12 flex flex-col items-center gap-6">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
                <div className="absolute inset-0 rounded-full border-2 border-t-violet-500 border-r-violet-500/30 border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-t-transparent border-r-transparent border-b-sky-500/60 border-l-sky-500 animate-spin"
                    style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div className="text-center space-y-1">
                <div className="text-sm font-medium text-zinc-200">{status}{dots}</div>
                {shardCount > 0 && (
                    <div className="text-xs text-zinc-500">{shardCount.toLocaleString()} shards loaded</div>
                )}
                <div className="text-[10px] text-zinc-700 mt-2">
                    Fusion database is 1.8MB — processing on background thread
                </div>
            </div>
            <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-violet-600 via-sky-500 to-violet-600 rounded-full animate-pulse"
                    style={{ width: shardCount > 0 ? '80%' : '30%', transition: 'width 0.5s ease' }}
                />
            </div>
        </div>
    );
}

// ── Ingredient expanded panel ─────────────────────────────────────────────
function FusedIngRow({ shardCode, parentQty, depth, fusionData, bazaarData, inputMode, rowKey }) {
    const [isExpanded, setIsExpanded] = useState(false);

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

    const shard = fusionData?.shards?.[shardCode];
    if (!shard) return null;

    const prices = getPrices(shard.internal_id);
    const marketPrice = prices ? (inputMode === 'instabuy' ? prices.instabuy : prices.buyOrder) : 0;

    // Find the cheapest sub-fusion recipe for this shard
    const recipes = fusionData?.recipes?.[shardCode];
    const bestSubFusion = (() => {
        if (!recipes) return null;
        let best = null;
        let bestCost = Infinity;
        for (const [qtyStr, pairs] of Object.entries(recipes)) {
            const outQty = parseInt(qtyStr, 10);
            for (const [in1Code, in2Code] of pairs) {
                const in1Shard = fusionData.shards[in1Code];
                const in2Shard = fusionData.shards[in2Code];
                if (!in1Shard || !in2Shard) continue;
                const p1 = getPrices(in1Shard.internal_id);
                const p2 = getPrices(in2Shard.internal_id);
                if (!p1 || !p2) continue;
                const c1 = inputMode === 'instabuy' ? p1.instabuy : p1.buyOrder;
                const c2 = inputMode === 'instabuy' ? p2.instabuy : p2.buyOrder;
                const craftCost = (in1Shard.fuse_amount * c1 + in2Shard.fuse_amount * c2) / outQty;
                if (craftCost < bestCost) {
                    bestCost = craftCost;
                    best = { outQty, in1Code, in2Code, in1Shard, in2Shard, craftCostPerUnit: craftCost };
                }
            }
        }
        return best;
    })();

    const isFused = bestSubFusion !== null && bestSubFusion.craftCostPerUnit < marketPrice;
    const effectivePrice = isFused ? bestSubFusion.craftCostPerUnit : marketPrice;
    const totalCost = parentQty * effectivePrice;
    const indent = depth * 12;

    return (
        <React.Fragment>
            <tr
                onClick={() => isFused && setIsExpanded(e => !e)}
                className={`text-zinc-400 hover:bg-zinc-900/40 ${isFused ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-zinc-900/30' : ''}`}
            >
                <td className="p-2.5 font-sans font-medium uppercase tracking-tight" style={{ paddingLeft: `${10 + indent}px` }}>
                    <div className="flex items-center gap-1.5">
                        {isFused && (
                            <span className="text-[9px] text-zinc-500 font-mono w-2 shrink-0">
                                {isExpanded ? '▼' : '▶'}
                            </span>
                        )}
                        {!isFused && depth > 0 && <span className="w-2 shrink-0" />}
                        <span className={`text-[9px] px-1 py-0.5 rounded border font-mono ${rc(shard.rarity?.toLowerCase())}`}>
                            {shard.name}
                        </span>
                        {isFused && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-violet-950/60 border border-violet-800/50 text-violet-400 font-mono shrink-0">
                                FUSED
                            </span>
                        )}
                    </div>
                </td>
                <td className="p-2.5 text-right font-mono text-zinc-500">×{parentQty}</td>
                <td className="p-2.5 text-right font-mono text-sky-400">{formatNum(prices?.instabuy || 0)}</td>
                <td className="p-2.5 text-right font-mono text-zinc-400">{formatNum(prices?.buyOrder || 0)}</td>
                <td className="p-2.5 text-right font-mono text-violet-400">
                    {isFused ? formatNum(effectivePrice) : <span className="text-zinc-700">—</span>}
                </td>
                <td className="p-2.5 text-right font-mono font-semibold text-zinc-200">{formatNum(totalCost)}</td>
                <td className="p-2.5 text-right font-mono text-zinc-600">{formatNum(prices?.sellVol || 0)}</td>
            </tr>

            {/* Savings summary row when expanded */}
            {isFused && isExpanded && (
                <>
                    {/* Savings info */}
                    <tr className="bg-zinc-950/60">
                        <td
                            colSpan="7"
                            className="px-3 py-1.5 border-l-2 border-violet-800/40"
                            style={{ paddingLeft: `${22 + indent}px` }}
                        >
                            <div className="flex gap-6 text-[10px]">
                                <div>
                                    <span className="text-zinc-600">Fused cost/unit: </span>
                                    <span className="font-mono text-violet-400">{formatNum(bestSubFusion.craftCostPerUnit)}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-600">vs market: </span>
                                    <span className="font-mono text-zinc-400">{formatNum(marketPrice)}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-600">Savings: </span>
                                    <span className="font-mono text-emerald-400">
                                        {formatNum(marketPrice - bestSubFusion.craftCostPerUnit)}
                                        {' '}({marketPrice > 0 ? (((marketPrice - bestSubFusion.craftCostPerUnit) / marketPrice) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-600">Output per fuse: </span>
                                    <span className="font-mono text-zinc-400">×{bestSubFusion.outQty}</span>
                                </div>
                            </div>
                        </td>
                    </tr>

                    {/* Recursively render sub-ingredients */}
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

// ── Ingredient expanded panel ─────────────────────────────────────────────
function IngredientPanel({ item, inputMode, outputMode, bazaarData, fusionData }) {
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

    const outPrices = getPrices(item.outInternalId);
    const outSellPrice = outputMode === 'sell_order'
        ? (outPrices?.sellOrder || 0)
        : (outPrices?.instasell || 0);

    const effectiveValue = item.outQty * outSellPrice;
    const effectiveProfit = effectiveValue - item.cost;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Summary card */}
            <div className="md:col-span-1 bg-[#121214] border border-zinc-800 rounded-lg p-4 space-y-3">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Fusion Summary
                </span>
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${rc(item.outRarity)}`}>
                            {item.outName}
                        </span>
                        <span className="text-[10px] text-zinc-600">×{item.outQty}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mt-2">
                        <span className="text-zinc-600">Insta-Sell</span>
                        <span className="font-mono text-violet-400 text-right">{formatNum(outPrices?.instasell || 0)}</span>
                        <span className="text-zinc-600">Sell Order</span>
                        <span className="font-mono text-zinc-300 text-right">{formatNum(outPrices?.sellOrder || 0)}</span>
                        <span className="text-zinc-600">7d Vol</span>
                        <span className="font-mono text-zinc-500 text-right">{formatNum(outPrices?.sellVol || 0)}</span>
                    </div>
                </div>
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

            {/* Ingredients table — now uses recursive FusedIngRow */}
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

// ── Main component ────────────────────────────────────────────────────────
export default function ShardFusionTable({ bazaarData }) {
    const workerRef = useRef(null);
    const fusionReadyRef = useRef(false);
    const pendingComputeRef = useRef(null);
    const computeTimerRef = useRef(null);
    const lastBazaarFpRef = useRef('');
    const lastOptionsFpRef = useRef('');

    const [workerStatus, setWorkerStatus] = useState('idle');
    const [statusMsg, setStatusMsg] = useState('Initializing…');
    const [shardCount, setShardCount] = useState(0);
    const [results, setResults] = useState([]);
    const [expandedItem, setExpandedItem] = useState(null);

    const [inputMode, setInputMode] = useState('buy_order');
    const [outputMode, setOutputMode] = useState('sell_order');
    const [craftDepth, setCraftDepth] = useState(1);

    const [minProfit, setMinProfit] = useState('');
    const [minMargin, setMinMargin] = useState('');
    const [minOutVol, setMinOutVol] = useState('');
    const [minIn1Vol, setMinIn1Vol] = useState('');
    const [minIn2Vol, setMinIn2Vol] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [fusionData, setFusionData] = useState(null);

    // ── Boot worker once ────────────────────────────────────────────────────
    useEffect(() => {
        const worker = new Worker(
            new URL('../workers/shardWorker.js', import.meta.url),
            { type: 'module' }
        );
        workerRef.current = worker;

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            if (type === 'LOADING') {
                setStatusMsg(payload);
                setWorkerStatus('loading');
            }

            if (type === 'FUSION_DATA_LOADED') {
                setShardCount(payload.shardCount);
                setFusionData(payload.fusionData);
                fusionReadyRef.current = true;
                setStatusMsg('Computing fusions…');
                if (pendingComputeRef.current) {
                    worker.postMessage({ type: 'COMPUTE', payload: pendingComputeRef.current });
                    pendingComputeRef.current = null;
                    setWorkerStatus('computing');
                } else {
                    setWorkerStatus('ready_idle');
                }
            }

            if (type === 'COMPUTING') {
                setStatusMsg(payload);
                // Don't wipe results — keep old table visible during recompute
            }

            if (type === 'RESULTS') {
                setResults(payload);
                setWorkerStatus('ready');
                setStatusMsg('');
            }

            if (type === 'ERROR') {
                setWorkerStatus('error');
                setStatusMsg(payload);
            }
        };

        worker.postMessage({ type: 'LOAD_FUSION_DATA' });

        return () => {
            clearTimeout(computeTimerRef.current);
            worker.terminate();
            workerRef.current = null;
        };
    }, []); // runs exactly once

    // ── Trigger compute when bazaarData or options change ───────────────────
    useEffect(() => {
        if (!workerRef.current) return;
        if (Object.keys(bazaarData).length === 0) return;

        // Fingerprint bazaar data by item count + a sentinel price
        // so we don't re-fire just because React made a new object reference
        const sentinelPrice = (
            bazaarData['ENCHANTED_DIAMOND']?.quick_status?.buyPrice ||
            bazaarData['WHEAT']?.quick_status?.buyPrice ||
            0
        ).toFixed(2);
        const bazaarFp = `${Object.keys(bazaarData).length}:${sentinelPrice}`;
        const optionsFp = `${inputMode}:${outputMode}:${craftDepth}`;

        if (bazaarFp === lastBazaarFpRef.current && optionsFp === lastOptionsFpRef.current) return;

        lastBazaarFpRef.current = bazaarFp;
        lastOptionsFpRef.current = optionsFp;

        const payload = { bazaarData, inputMode, outputMode, craftDepth };

        clearTimeout(computeTimerRef.current);
        computeTimerRef.current = setTimeout(() => {
            if (!fusionReadyRef.current) {
                // Fusion JSON not done yet — queue it
                pendingComputeRef.current = payload;
                return;
            }
            workerRef.current.postMessage({ type: 'COMPUTE', payload });
            // Only show computing state if we have no results yet
            setWorkerStatus(prev => prev === 'ready' ? 'ready' : 'computing');
        }, 400);
    }, [bazaarData, inputMode, outputMode, craftDepth]);

    // ── Client-side filters (instant, no worker) ────────────────────────────
    const filtered = results.filter(r => {
        if (minProfit && r.profit < parseFloat(minProfit)) return false;
        if (minMargin && r.profitPct < parseFloat(minMargin)) return false;
        if (minOutVol && r.outVolume < parseFloat(minOutVol)) return false;
        if (minIn1Vol && r.in1Volume < parseFloat(minIn1Vol)) return false;
        if (minIn2Vol && r.in2Volume < parseFloat(minIn2Vol)) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            if (
                !r.in1Name.toLowerCase().includes(s) &&
                !r.in2Name.toLowerCase().includes(s) &&
                !r.outName.toLowerCase().includes(s)
            ) return false;
        }
        return true;
    });

    const { sorted, sortConfig, toggle } = useSortableData(filtered, 'profit');
    const sh = { sortConfig, toggle };

    const isFirstLoad = ['idle', 'loading', 'computing', 'ready_idle'].includes(workerStatus) && results.length === 0;
    const isRecomputing = workerStatus === 'computing' && results.length > 0;

    return (
        <div className="space-y-4">

            {/* ── Controls ──────────────────────────────────────────────────── */}
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

            {/* ── First-load spinner ────────────────────────────────────────── */}
            {isFirstLoad && (
                <LoadingPanel status={statusMsg} shardCount={shardCount} />
            )}

            {/* ── Error state ───────────────────────────────────────────────── */}
            {workerStatus === 'error' && (
                <div className="bg-[#121214] border border-red-800/40 rounded-xl p-6 text-center space-y-2">
                    <div className="text-sm font-semibold text-red-400">Failed to load shard fusion data</div>
                    <div className="text-xs text-zinc-500">{statusMsg}</div>
                </div>
            )}

            {/* ── Table — shown as soon as we have any results ──────────────── */}
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
