/**
 * Header Component
 * 
 * Top header bar for the application with:
 * - Title and subtitle
 * - Search input
 * - Refresh button
 * - Hidden items manager
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.loading - Whether data is currently being fetched
 * @param {string} props.searchTerm - Current search query text
 * @param {Function} props.setSearchTerm - Callback to update search term
 * @param {Function} props.fetchBazaarData - Callback to trigger data refresh
 * @param {Array} props.hiddenItems - List of item IDs that user has hidden
 * @param {Function} props.setHiddenItems - Callback to update hidden items list
 * @param {boolean} props.showHiddenManager - Whether to show the hidden items manager
 * @param {Function} props.setShowHiddenManager - Callback to toggle hidden manager visibility
 * @param {Function} props.unhideItem - Callback to remove an item from hidden list
 * 
 * @file components/Header.jsx
 */
import { cleanColorCodes } from '../utils/helpers';

export default function Header({
  loading,
  searchTerm,
  setSearchTerm,
  fetchBazaarData,
  hiddenItems,
  setHiddenItems,
  showHiddenManager,
  setShowHiddenManager,
  unhideItem
}) {
  return (
    <div className="space-y-6">
      {/* Main header with title, search, and refresh */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
        {/* Left side: Title and subtitle */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">SkyBlock Quant Terminal</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">Advanced multi-graph algorithmic execution matrix.</p>
        </div>
        
        {/* Right side: Controls (search, refresh, hidden manager toggle) */}
        <div className="flex w-full md:w-auto items-center gap-3">
          {/* Hidden items manager toggle button - only shown if items are hidden */}
          {hiddenItems.length > 0 && (
            <button 
              onClick={() => setShowHiddenManager(!showHiddenManager)}
              className="text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 px-3 py-2 rounded-md hover:text-white transition"
            >
              {showHiddenManager ? "Hide Manager" : `Manage Hidden (${hiddenItems.length})`}
            </button>
          )}
          
          {/* Search input field */}
          <input 
            type="text" 
            placeholder="Query matrix..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121214] text-sm text-zinc-100 placeholder-zinc-500 border border-zinc-800 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition"
          />
          
          {/* Refresh button - triggers API data fetch */}
          <button onClick={fetchBazaarData} className="w-50 text-sm font-medium bg-zinc-100 text-zinc-900 px-4 py-2 rounded-md hover:bg-zinc-200 shadow-sm transition cursor-pointer">
            {loading ? "Syncing..." : "Refresh Engine"}
          </button>
        </div>
      </header>

      {/* Hidden items manager panel - shown when toggle is active and items are hidden */}
      {showHiddenManager && hiddenItems.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
          {/* Manager header with restore all button */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Hidden & Excluded Recipes Archive</span>
            <button onClick={() => setHiddenItems([])} className="text-[10px] text-red-400 hover:underline">Restore All Items</button>
          </div>
          
          {/* List of hidden items with unhide buttons */}
          <div className="flex flex-wrap gap-2">
            {hiddenItems.map(id => (
              <div key={`hidden-${id}`} className="bg-[#121214] border border-zinc-800 rounded px-2.5 py-1 text-xs flex items-center gap-2 text-zinc-300">
                {/* Clean up the ID for display (remove underscores, clean color codes) */}
                <span className="uppercase tracking-tight font-medium font-sans">{cleanColorCodes(id.replace(/_/g, ' '))}</span>
                {/* Unhide button for this specific item */}
                <button onClick={() => unhideItem(id)} className="text-zinc-500 hover:text-white font-bold font-mono text-[11px] px-0.5">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
