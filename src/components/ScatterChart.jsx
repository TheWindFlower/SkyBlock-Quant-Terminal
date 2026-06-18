/**
 * ScatterChart Component
 * 
 * Visualizes trading opportunities on a 2D scatter plot.
 * - X-axis: 7d Market Depth (Volume/Velocity)
 * - Y-axis: Margin %
 * - Bubble size: Represents profit magnitude
 * - Tooltip on hover: Shows item name and margin %
 * 
 * Top-right quadrant indicates high volume + high yield items (best opportunities)
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.scatterItems - Items to display on the chart
 * @param {string} props.expandedItem - Currently expanded item ID (for highlighting)
 * 
 * @file components/ScatterChart.jsx
 */
import React from 'react';

export default function ScatterChart({ scatterItems, expandedItem }) {
    // Don't render if there are no items to display
    if (scatterItems.length === 0) return null;

    // Calculate max values for scaling the axes
    const maxScatterMargin = Math.max(...scatterItems.map(i => i.marginPct), 1);
    const maxScatterLiquidity = Math.max(...scatterItems.map(i => i.liquidity), 1);

    return (
        <div className="bg-[#121214] border border-zinc-800 rounded-xl p-5 shadow-sm">
            {/* Chart header with description */}
            <div className="mb-3">
                <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase block">Upgrade Scope: Risk vs. Reward Efficiency Matrix</span>
                <p className="text-xs text-zinc-400 mt-0.5">Top quadrant maps high velocity + high yield items.</p>
            </div>
            
            {/* SVG container for the chart */}
            <div className="w-full bg-[#09090b] border border-zinc-800/60 rounded-lg p-2 overflow-hidden">
                <svg viewBox="0 0 600 220" className="w-full h-56">
                    {/* Y-axis line (left) */}
                    <line x1="40" y1="20" x2="40" y2="180" stroke="#27272a" strokeWidth="1" />
                    {/* X-axis line (bottom) */}
                    <line x1="40" y1="180" x2="580" y2="180" stroke="#27272a" strokeWidth="1" />
                    {/* Horizontal dashed line at 50% margin */}
                    <line x1="40" y1="100" x2="580" y2="100" stroke="#18181b" strokeDasharray="3,3" />
                    {/* Vertical dashed line at median volume */}
                    <line x1="310" y1="20" x2="310" y2="180" stroke="#18181b" strokeDasharray="3,3" />
                    
                    {/* X-axis label */}
                    <text x="580" y="195" textAnchor="end" fill="#71717a" className="text-[9px] uppercase">7d Market Depth (Velocity) →</text>
                    {/* Y-axis label (vertical) */}
                    <text x="35" y="25" textAnchor="end" fill="#71717a" className="text-[9px] uppercase [writing-mode:vertical-lr]">Margin % →</text>

                    {/* Plot each item as a circle */}
                    {scatterItems.map((item, idx) => {
                        // --- SAFETY FALLBACKS ---
                        // Ensure we have valid values even if item data is incomplete
                        const mPct = item.marginPct || 0;
                        const liquidity = item.liquidity || 0;
                        const profit = item.margin || 0; // Assuming margin is used as profit here

                        // Scale calculations for SVG positioning
                        // x: 40-580 based on liquidity (normalized by max)
                        // y: 20-180 based on margin (inverted, normalized by max)
                        // r: 4-16 based on profit (capped)
                        const cx = 40 + ((liquidity / maxScatterLiquidity) * 520);
                        const cy = 180 - ((mPct / maxScatterMargin) * 150);
                        const r = Math.min(Math.max(profit / 250000, 4), 16);

                        return (
                            // Group for each item (enables tooltip)
                            <g key={`scatter-${item.id}-${idx}`} className="group cursor-pointer">
                                {/* Tooltip text shown on hover */}
                                <title>{`${item.name} | Margin: ${mPct.toFixed(1)}%`}</title>
                                {/* Main circle - larger, color indicates if expanded */}
                                <circle cx={cx} cy={cy} r={r} fill={expandedItem === item.id ? "#fafafa" : "#a1a1aa"} />
                                {/* Small white dot in center for visibility */}
                                <circle cx={cx} cy={cy} r="2" fill="#ffffff" />
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
