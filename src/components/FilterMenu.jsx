/**
 * FilterMenu Component (Exported as TopBar)
 * 
 * Provides filter controls for data tables. Allows users to set various
 * thresholds and limits to filter the displayed trading opportunities.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.filters - Current filter values from parent state
 * @param {Function} props.handleFilterChange - Callback to update filter values
 * 
 * @file components/FilterMenu.jsx
 */
import React from 'react';


/**
 * Creates a range input component with min and max fields.
 * Used for margin percentage range and batch size range filters.
 * 
 * @function range
 * @param {string} title - Label for the range (e.g., "Margin Range %")
 * @param {string} r1 - Filter key for the minimum value
 * @param {string} r2 - Filter key for the maximum value
 * @param {Object} options - Options object containing filters and handler
 * @param {Object} options.filters - Current filter values
 * @param {Function} options.handleFilterChange - Filter update callback
 * @returns {JSX.Element} - Range input component with two connected fields
 */
function range(title, r1, r2, {filters, handleFilterChange }){
    return( 
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-[11px] font-medium text-zinc-400 block whitespace-nowrap">
            {title}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Min"
              value={filters.minMarginPct}
              onChange={(e) => handleFilterChange(r1, e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder-zinc-600"
            />
            <span className="text-zinc-600 text-xs shrink-0">—</span>
            <input
              type="text"
              placeholder="Max"
              value={filters.maxMarginPct}
              onChange={(e) => handleFilterChange(r2, e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder-zinc-600"
            />
          </div>
        </div>
    )
}
/**
 * Main filter bar component with all filter controls.
 * 
 * @function TopBar
 * @param {Object} props - Component props
 * @param {Object} props.filters - All current filter values
 * @param {Function} props.handleFilterChange - Callback to update filters
 * @returns {JSX.Element} - Complete filter bar with all controls
 */
export default function TopBar({ filters, handleFilterChange }) {
  // Definition of all single-value filter fields
  const fields = [
    { label: 'Max Output Limit', id: 'limit' },           // Maximum number of results to display
    { label: 'Min Profit Threshold', id: 'minProfit' },   // Minimum profit required
    { label: 'Min Buy Order Array', id: 'minBuyOrders' },  // Minimum number of buy orders
    { label: 'Min Sell Order Array', id: 'minSellOrders' },// Minimum number of sell orders
    { label: 'Min Raw Buy Volume', id: 'minBuyVolume' },  // Minimum buy volume (7d)
    { label: 'Min Raw Sell Volume', id: 'minSellVolume' },// Minimum sell volume (7d)
    { label: 'Max Craft Depth', id: 'maxCraftDepth' },    // Maximum recursion depth for crafting (1-3)
    { label: 'Max Flip Time', id: 'maxFlipTime' },       // Maximum acceptable flip time
  ];

  return (
    // Filter bar container card
    <div className="w-full bg-[#121214] border border-zinc-800 rounded-xl p-4 shadow-sm mb-6">
      {/* Header section */}
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Execution Parameters
        </h3>
      </div>
      
      {/* Filter Grid / Flex Container - wraps to multiple lines on small screens */}
      <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-zinc-800/60">
        {/* Render each single-value filter field */}
        {fields.map((field) => (
          <div key={field.id} className="space-y-1 flex-1 min-w-[130px]">
            <label className="text-[11px] font-medium text-zinc-400 block whitespace-nowrap">
              {field.label}
            </label>
            <input
              type="text"
              value={filters[field.id] || ''}
              onChange={(e) => handleFilterChange(field.id, e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
        ))}
        
        {/* Range filters for margin percentage */}
        {range("Margin Range %", 'minMarginPct', 'maxMarginPct', { filters, handleFilterChange })}
        
        {/* Range filters for batch size */}
        {range("Batch Range", 'minBatchSize', 'maxBatchSize', { filters, handleFilterChange })}
     </div>
    </div>
  );
}
