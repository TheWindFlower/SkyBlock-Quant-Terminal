//NpcFlipTable.jsx
import React, { useState } from 'react';
import { formatNum, cleanColorCodes } from '../utils/helpers';

function useSortableData(data, defaultKey = 'npcProfit') {
  const [sortConfig, setSortConfig] = useState({ key: defaultKey, dir: 'desc' });
  const sorted = [...data].sort((a, b) => {
    const av = a[sortConfig.key] ?? 0;
    const bv = b[sortConfig.key] ?? 0;
    if (typeof av === 'string') return sortConfig.dir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
    return sortConfig.dir === 'desc' ? bv - av : av - bv;
  });
  const toggle = (key) => setSortConfig(prev =>
    prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }
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
      {label} {active ? (sortConfig.dir === 'desc' ? '↓' : '↑') : <span className="text-zinc-700">↕</span>}
    </th>
  );
}

function VolumeCell({ buy7dVolume, sell7dVolume }) {
  const [hovered, setHovered] = useState(false);
  const total = (buy7dVolume || 0) + (sell7dVolume || 0);
  return (
    <td
      className="p-4 text-right font-mono text-zinc-400 relative cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="underline decoration-dashed decoration-zinc-600 underline-offset-2">
        {formatNum(total)}
      </span>
      {hovered && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#1c1c1e] border border-zinc-700 rounded-lg p-3 shadow-xl text-left min-w-[160px] pointer-events-none">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">7d Volume Breakdown</div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-zinc-400">Buy vol</span>
            <span className="font-mono text-sky-400">{formatNum(buy7dVolume || 0)}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs mt-1">
            <span className="text-zinc-400">Sell vol</span>
            <span className="font-mono text-violet-400">{formatNum(sell7dVolume || 0)}</span>
          </div>
        </div>
      )}
    </td>
  );
}

function CustomAmountCell({ item, customAmounts, setCustomAmounts }) {
  const key = item.id;
  const val = customAmounts[key] ?? '';
  const qty = parseInt(val, 10);
  const hasQty = !isNaN(qty) && qty > 0;
  const customProfit = hasQty ? item.npcProfit * qty : null;
  const customCost = hasQty ? item.acquireCost * qty : null;

  return (
    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
      <div className="flex flex-col items-end gap-1">
        <input
          type="text"
          placeholder="Qty…"
          value={val}
          onChange={e => setCustomAmounts(prev => ({ ...prev, [key]: e.target.value }))}
          className="w-24 bg-[#09090b] border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-500 text-right placeholder-zinc-600"
        />
        {hasQty && (
          <div className="text-[10px] text-right space-y-0.5">
            <div className={`font-mono font-bold ${customProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {customProfit >= 0 ? '+' : ''}{formatNum(customProfit)}
            </div>
            <div className="text-zinc-600 font-mono">{formatNum(customCost)} cost</div>
          </div>
        )}
      </div>
    </td>
  );
}

// Instant Buy → NPC table (no expandable rows, simpler layout)
function InstantFlipTable({ data, markedTrades, toggleMark, customAmounts, setCustomAmounts }) {
  const { sorted, sortConfig, toggle } = useSortableData(data, 'npcProfit');
  const sh = { sortConfig, toggle };

  return (
    <div className="bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-[#18181b]/40">
              <th className="p-4 w-8" />
              <th
                className={`p-4 font-medium select-none cursor-pointer hover:text-zinc-200 transition-colors whitespace-nowrap sticky left-8 bg-[#18181b] z-10 ${sortConfig.key === 'name' ? 'text-zinc-100' : 'text-zinc-400'}`}
                onClick={() => toggle('name')}
              >
                Asset Identifier {sortConfig.key === 'name' ? (sortConfig.dir === 'desc' ? '↓' : '↑') : <span className="text-zinc-700">↕</span>}
              </th>
              <SortTh label="NPC Price" colKey="npcPrice" title="Fixed NPC sell price" {...sh} className="text-right" />
              <SortTh label="Instant Buy Price" colKey="acquireCost" title="Current instant buy price from bazaar order book" {...sh} className="text-right" />
              <SortTh label="Profit (1x) ⓘ" colKey="npcProfit" title="Net profit per unit — no tax on NPC sales" {...sh} className="text-right" />
              <SortTh label="Margin %" colKey="npcMarginPct" title="Profit as % of cost" {...sh} className="text-right" />
              <SortTh label="Batch Size" colKey="batchSize" title="Max units (71,680)" {...sh} className="text-right" />
              <SortTh label="Batch Profit ⓘ" colKey="npcBatchProfit" title="Total profit for 71,680 units" {...sh} className="text-right" />
              <SortTh label="Batch Cost ⓘ" colKey="npcBatchCost" title="Total capital needed for 71,680 units" {...sh} className="text-right" />
              <th className="p-4 text-right font-medium text-zinc-400 whitespace-nowrap">Custom Qty / Profit</th>
              <SortTh label="Volume ⓘ" colKey="totalVolume" title="7d combined volume — hover for split" {...sh} className="text-right" />
              <SortTh label="Vol Δ" colKey="volumeDelta" title="Buy minus sell volume" {...sh} className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {sorted.map((item, i) => {
              const isMarked = markedTrades.has(item.id);
              const isProfitable = item.npcProfit > 0;
              const delta = (item.buy7dVolume || 0) - (item.sell7dVolume || 0);
              const deltaColor = delta > 0 ? 'text-sky-400' : delta < 0 ? 'text-violet-400' : 'text-zinc-500';

              return (
                <tr
                  key={`instant-${item.id}-${i}`}
                  className={`transition-colors group select-none ${
                    isMarked
                      ? 'bg-amber-950/20 hover:bg-amber-950/30 border-l-2 border-amber-500/60'
                      : 'hover:bg-zinc-900/60'
                  }`}
                >
                  {/* Mark button */}
                  <td className="p-4 w-8 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => toggleMark(item.id, e)}
                      title={isMarked ? 'Unmark trade' : 'Mark trade'}
                      className={`text-sm transition-all ${isMarked ? 'text-amber-400 scale-110' : 'text-zinc-700 hover:text-amber-500'}`}
                    >
                      ★
                    </button>
                  </td>

                  {/* Sticky name */}
                  <td className={`p-4 font-medium text-zinc-100 uppercase tracking-tight sticky left-8 z-10 transition-colors min-w-[180px] ${isMarked ? 'bg-amber-950/20' : 'bg-[#121214]'} group-hover:bg-zinc-900/60`}>
                    <div className="flex items-center gap-2">
                      {item.name}
                      {isMarked && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-400 font-mono">ACTIVE</span>}
                      <span className="text-[9px] px-1 py-0.5 rounded bg-sky-950/60 border border-sky-800/50 text-sky-400 font-mono">INSTANT</span>
                    </div>
                  </td>

                  <td className="p-4 text-right font-mono text-amber-400 font-bold whitespace-nowrap">
                    {formatNum(item.npcPrice)}
                  </td>
                  <td className="p-4 text-right font-mono text-sky-400 whitespace-nowrap">
                    {formatNum(item.acquireCost)}
                  </td>
                  <td className={`p-4 text-right font-mono font-semibold whitespace-nowrap ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isProfitable ? '+' : ''}{formatNum(item.npcProfit)}
                  </td>
                  <td className="p-4 text-right font-mono whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-medium ${item.npcMarginPct > 10 ? 'text-emerald-400' : item.npcMarginPct > 0 ? 'text-zinc-300' : 'text-red-400'}`}>
                      {item.npcMarginPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                    {item.batchSize.toLocaleString()}
                  </td>
                  <td className={`p-4 text-right font-mono font-bold whitespace-nowrap ${item.npcBatchProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatNum(item.npcBatchProfit)}
                  </td>
                  <td className="p-4 text-right font-mono text-zinc-300 whitespace-nowrap">
                    {formatNum(item.npcBatchCost)}
                  </td>
                  <CustomAmountCell item={item} customAmounts={customAmounts} setCustomAmounts={setCustomAmounts} />
                  <VolumeCell buy7dVolume={item.buy7dVolume} sell7dVolume={item.sell7dVolume} />
                  <td className="p-4 text-right font-mono whitespace-nowrap">
                    <span className={deltaColor}>{delta > 0 ? '+' : ''}{formatNum(delta)}</span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan="12" className="p-8 text-center text-zinc-600 text-xs">
                  No instant buy NPC opportunities found with current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function NpcFlipTable({ displayedData, activeNpcTab, setActiveNpcTab, counts }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [expandedIngredient, setExpandedIngredient] = useState(null);
  const [markedTrades, setMarkedTrades] = useState(new Set());
  const [customAmounts, setCustomAmounts] = useState({});
  const { sorted, sortConfig, toggle } = useSortableData(displayedData, 'npcProfit');
  const sh = { sortConfig, toggle };

  const handleTabSwitch = (tab) => {
    setActiveNpcTab(tab);
    setExpandedItem(null);
    setExpandedIngredient(null);
  };

  const toggleMark = (id, e) => {
    e.stopPropagation();
    setMarkedTrades(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allItems = [...displayedData];
  const markedItems = allItems.filter(i => markedTrades.has(i.id));
  const totalMarkedProfit = markedItems.reduce((sum, i) => {
    const qty = parseInt(customAmounts[i.id], 10);
    return sum + (isNaN(qty) || qty <= 0 ? i.npcBatchProfit : i.npcProfit * qty);
  }, 0);
  const totalMarkedCost = markedItems.reduce((sum, i) => {
    const qty = parseInt(customAmounts[i.id], 10);
    return sum + (isNaN(qty) || qty <= 0 ? i.npcBatchCost : i.acquireCost * qty);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="bg-[#121214] p-1 rounded-lg border border-zinc-800 inline-flex w-full sm:w-auto">
        <button
          onClick={() => handleTabSwitch('craft')}
          className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeNpcTab === 'craft' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Craft → NPC ({counts.craft})
        </button>
        <button
          onClick={() => handleTabSwitch('flip')}
          className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeNpcTab === 'flip' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Buy Order → NPC ({counts.flip})
        </button>
        <button
          onClick={() => handleTabSwitch('instant')}
          className={`flex-1 sm:flex-none text-xs font-medium px-4 py-1.5 rounded-md transition cursor-pointer ${activeNpcTab === 'instant' ? 'bg-[#27272a] text-[#fafafa] shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Instant Buy → NPC ({counts.instant ?? 0})
        </button>
      </div>

      {/* Marked trades summary bar */}
      {markedTrades.size > 0 && (
        <div className="bg-[#121214] border border-amber-800/40 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              ★ Active Trade Plan — {markedTrades.size} item{markedTrades.size > 1 ? 's' : ''}
            </span>
            <button onClick={() => setMarkedTrades(new Set())} className="text-[10px] text-zinc-500 hover:text-red-400 transition">
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {markedItems.map(item => {
              const qty = parseInt(customAmounts[item.id], 10);
              const hasQty = !isNaN(qty) && qty > 0;
              const profit = hasQty ? item.npcProfit * qty : item.npcBatchProfit;
              const cost = hasQty ? item.acquireCost * qty : item.npcBatchCost;
              return (
                <div key={item.id} className="bg-zinc-900 border border-amber-800/30 rounded-lg px-3 py-2 text-[10px] flex items-start gap-3">
                  <div>
                    <div className="font-medium text-zinc-200 uppercase tracking-tight flex items-center gap-1.5">
                      {item.name}
                      {item.source === 'instant' && <span className="text-[9px] px-1 py-0.5 rounded bg-sky-950/60 border border-sky-800/50 text-sky-400 font-mono">INSTANT</span>}
                    </div>
                    <div className="text-zinc-500 mt-0.5">
                      {hasQty ? `×${qty.toLocaleString()}` : `×${item.batchSize?.toLocaleString()} (batch)`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400">{formatNum(profit)}</div>
                    <div className="font-mono text-zinc-600">{formatNum(cost)} cost</div>
                  </div>
                  <button
                    onClick={() => setMarkedTrades(prev => { const n = new Set(prev); n.delete(item.id); return n; })}
                    className="text-zinc-600 hover:text-red-400 font-mono text-[11px] mt-0.5"
                  >✕</button>
                </div>
              );
            })}
          </div>
          <div className="flex gap-6 pt-2 border-t border-zinc-800/60 text-[10px]">
            <div>
              <span className="text-zinc-500">Total profit: </span>
              <span className="font-mono font-bold text-emerald-400">{formatNum(totalMarkedProfit)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Total capital: </span>
              <span className="font-mono text-zinc-300">{formatNum(totalMarkedCost)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Combined ROI: </span>
              <span className="font-mono text-amber-400">
                {totalMarkedCost > 0 ? ((totalMarkedProfit / totalMarkedCost) * 100).toFixed(1) : '0'}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Instant buy tab — separate simpler table */}
      {activeNpcTab === 'instant' ? (
        <InstantFlipTable
          data={displayedData}
          markedTrades={markedTrades}
          toggleMark={toggleMark}
          customAmounts={customAmounts}
          setCustomAmounts={setCustomAmounts}
        />
      ) : (
        /* Craft + Buy Order tabs — existing table */
        <div className="bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-[#18181b]/40">
                  <th className="p-4 w-8" />
                  <th
                    className={`p-4 font-medium select-none cursor-pointer hover:text-zinc-200 transition-colors whitespace-nowrap sticky left-8 bg-[#18181b] z-10 ${sortConfig.key === 'name' ? 'text-zinc-100' : 'text-zinc-400'}`}
                    onClick={() => toggle('name')}
                  >
                    Asset Identifier {sortConfig.key === 'name' ? (sortConfig.dir === 'desc' ? '↓' : '↑') : <span className="text-zinc-700">↕</span>}
                  </th>
                  <SortTh label="NPC Price" colKey="npcPrice" title="Fixed NPC sell price" {...sh} className="text-right" />
                  <SortTh label="Buy/Craft Cost" colKey="acquireCost" title="Cost to acquire 1 unit" {...sh} className="text-right" />
                  <SortTh label="Profit (1x) ⓘ" colKey="npcProfit" title="Net profit selling 1 unit to NPC (no tax)" {...sh} className="text-right" />
                  <SortTh label="Margin %" colKey="npcMarginPct" title="Profit as % of cost" {...sh} className="text-right" />
                  <SortTh label="Batch Size" colKey="batchSize" title="Number of crafts/units in the batch" {...sh} className="text-right" />
                  <SortTh label="Batch Profit ⓘ" colKey="npcBatchProfit" title="Total profit for the recommended batch" {...sh} className="text-right" />
                  <SortTh label="Batch Cost ⓘ" colKey="npcBatchCost" title="Total capital needed for the recommended batch" {...sh} className="text-right" />
                  <th className="p-4 text-right font-medium text-zinc-400 whitespace-nowrap">Custom Qty / Profit</th>
                  <SortTh label="Volume ⓘ" colKey="totalVolume" title="7d combined volume — hover for split" {...sh} className="text-right" />
                  <SortTh label="Vol Δ" colKey="volumeDelta" title="Buy minus sell volume" {...sh} className="text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {sorted.map((item, rowIndex) => {
                  const isExpanded = expandedItem === item.id;
                  const isMarked = markedTrades.has(item.id);
                  const isProfitable = item.npcProfit > 0;
                  const isCraft = item.source === 'craft';
                  const delta = (item.buy7dVolume || 0) - (item.sell7dVolume || 0);
                  const deltaColor = delta > 0 ? 'text-sky-400' : delta < 0 ? 'text-violet-400' : 'text-zinc-500';
                  const uniqueRowKey = `npc-row-${item.id}-${rowIndex}`;

                  return (
                    <React.Fragment key={uniqueRowKey}>
                      <tr
                        onClick={() => isCraft && setExpandedItem(isExpanded ? null : item.id)}
                        className={`transition-colors ${isCraft ? 'cursor-pointer' : ''} group select-none ${
                          isMarked
                            ? 'bg-amber-950/20 hover:bg-amber-950/30 border-l-2 border-amber-500/60'
                            : isExpanded ? 'bg-zinc-900/40 hover:bg-zinc-900/60'
                            : 'hover:bg-zinc-900/60'
                        }`}
                      >
                        <td className="p-4 w-8 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => toggleMark(item.id, e)}
                            title={isMarked ? 'Unmark trade' : 'Mark trade'}
                            className={`text-sm transition-all ${isMarked ? 'text-amber-400 scale-110' : 'text-zinc-700 hover:text-amber-500'}`}
                          >★</button>
                        </td>

                        <td className={`p-4 font-medium text-zinc-100 uppercase tracking-tight sticky left-8 z-10 transition-colors ${isMarked ? 'bg-amber-950/20' : isExpanded ? 'bg-zinc-900/40' : 'bg-[#121214]'} group-hover:bg-zinc-900/60`}>
                          <div className="flex items-center gap-2 min-w-[180px]">
                            {isCraft && <span className="text-[9px] text-zinc-500 font-mono w-2 block">{isExpanded ? '▼' : '▶'}</span>}
                            {item.name}
                            {isMarked && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-400 font-mono">ACTIVE</span>}
                          </div>
                        </td>

                        <td className="p-4 text-right font-mono text-amber-400 font-bold whitespace-nowrap">{formatNum(item.npcPrice)}</td>
                        <td className="p-4 text-right font-mono text-zinc-400 whitespace-nowrap">{formatNum(item.acquireCost)}</td>
                        <td className={`p-4 text-right font-mono font-semibold whitespace-nowrap ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfitable ? '+' : ''}{formatNum(item.npcProfit)}
                        </td>
                        <td className="p-4 text-right font-mono whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-medium ${item.npcMarginPct > 10 ? 'text-emerald-400' : item.npcMarginPct > 0 ? 'text-zinc-300' : 'text-red-400'}`}>
                            {item.npcMarginPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-zinc-400 whitespace-nowrap">{item.batchSize.toLocaleString()}</td>
                        <td className={`p-4 text-right font-mono font-bold whitespace-nowrap ${item.npcBatchProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNum(item.npcBatchProfit)}</td>
                        <td className="p-4 text-right font-mono text-zinc-300 whitespace-nowrap">{formatNum(item.npcBatchCost)}</td>
                        <CustomAmountCell item={item} customAmounts={customAmounts} setCustomAmounts={setCustomAmounts} />
                        <VolumeCell buy7dVolume={item.buy7dVolume} sell7dVolume={item.sell7dVolume} />
                        <td className="p-4 text-right font-mono whitespace-nowrap">
                          <span className={deltaColor}>{delta > 0 ? '+' : ''}{formatNum(delta)}</span>
                        </td>
                      </tr>

                      {isCraft && isExpanded && (
                        <tr key={`expanded-${uniqueRowKey}`} className="bg-[#09090b]/60">
                          <td colSpan="12" className="p-6 border-l border-amber-800/40 bg-zinc-950/20 space-y-6">
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Selling to NPC at</span>
                              <span className="font-mono text-amber-400 font-bold">{formatNum(item.npcPrice)} coins</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-500 text-[10px]">No bazaar tax</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-500 text-[10px]">Batch crafts: ×{item.batchSize?.toLocaleString()}</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-500 text-[10px]">Batch profit:</span>
                              <span className="font-mono text-emerald-400 font-bold">{formatNum(item.npcBatchProfit)}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="md:col-span-1 bg-[#121214] border border-zinc-800 rounded-lg p-4 space-y-2">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Cumulative Capital Curve</span>
                                <div className="w-full h-32 pt-2">
                                  <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
                                    <line x1="10" y1="90" x2="190" y2="90" stroke="#27272a" strokeWidth="1" />
                                    <line x1="10" y1="90" x2="180" y2="20" stroke="#f4f4f5" strokeWidth="1.5" strokeDasharray="2,2" />
                                    <line x1="10" y1="90" x2="180" y2="40" stroke="#34d399" strokeWidth="2" />
                                    <circle cx="180" cy="40" r="3" fill="#34d399" />
                                  </svg>
                                </div>
                                <div className="pt-2 border-t border-zinc-800 space-y-1.5 text-[10px]">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">Batch crafts</span>
                                    <span className="font-mono text-zinc-300">×{item.batchSize?.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">Batch cost</span>
                                    <span className="font-mono text-zinc-300">{formatNum(item.npcBatchCost)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">NPC profit</span>
                                    <span className="font-mono font-bold text-amber-400">{formatNum(item.npcBatchProfit)}</span>
                                  </div>
                                  {(() => {
                                    const qty = parseInt(customAmounts[item.id], 10);
                                    if (isNaN(qty) || qty <= 0) return null;
                                    return (
                                      <div className="border-t border-zinc-800/60 pt-1.5 mt-1">
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Custom (×{qty.toLocaleString()})</span>
                                          <span className="font-mono font-bold text-emerald-400">{formatNum(item.npcProfit * qty)}</span>
                                        </div>
                                        <div className="flex justify-between mt-0.5">
                                          <span className="text-zinc-600">Custom cost</span>
                                          <span className="font-mono text-zinc-400">{formatNum(item.acquireCost * qty)}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              <div className="md:col-span-2 border border-zinc-800 rounded-lg overflow-hidden bg-[#121214]">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="border-b border-zinc-800 bg-[#18181b]/40 text-zinc-500 font-medium select-none">
                                      <th className="p-2.5">Component Element</th>
                                      <th className="p-2.5 text-right">Qty (1x)</th>
                                      <th className="p-2.5 text-right text-zinc-300">Batch Qty</th>
                                      <th className="p-2.5 text-right">Unit Price</th>
                                      <th className="p-2.5 text-right text-zinc-300">Batch Cost</th>
                                      <th className="p-2.5 text-right">Velocity Vol</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/40 font-mono">
                                    {item.ingredients?.map((ing, i) => {
                                      const isIngExpanded = expandedIngredient === `${uniqueRowKey}-${ing.id}-${i}`;
                                      const ingKey = `${uniqueRowKey}-${ing.id}-${i}`;
                                      return (
                                        <React.Fragment key={`ing-${ingKey}`}>
                                          <tr
                                            onClick={() => ing.isCraftResolved && setExpandedIngredient(isIngExpanded ? null : ingKey)}
                                            className={`text-zinc-400 hover:bg-zinc-900/40 ${ing.isCraftResolved ? 'cursor-pointer' : ''} ${isIngExpanded ? 'bg-zinc-900/30' : ''}`}
                                          >
                                            <td className="p-2.5 font-medium uppercase text-zinc-300 tracking-tight font-sans">
                                              <div className="flex items-center gap-1.5">
                                                {ing.isCraftResolved && <span className="text-[9px] text-zinc-500 font-mono w-2">{isIngExpanded ? '▼' : '▶'}</span>}
                                                {cleanColorCodes(ing.name)}
                                                {ing.isCraftResolved && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-950/60 border border-violet-800/50 text-violet-400 font-mono tracking-wide">CRAFTED</span>}
                                              </div>
                                            </td>
                                            <td className="p-2.5 text-right text-zinc-500">×{Number(ing.count.toFixed(2)).toLocaleString()}</td>
                                            <td className="p-2.5 text-right font-bold text-zinc-200">×{Math.round(ing.batchCount).toLocaleString()}</td>
                                            <td className="p-2.5 text-right">{Math.round(ing.unitPrice).toLocaleString()} c</td>
                                            <td className="p-2.5 text-right font-semibold text-zinc-300">{formatNum(ing.batchCost)}</td>
                                            <td className="p-2.5 text-right text-zinc-600">{formatNum(ing.liquidity)}</td>
                                          </tr>
                                          {ing.isCraftResolved && isIngExpanded && (
                                            <tr key={`sub-${ingKey}`}>
                                              <td colSpan="6" className="p-0 border-l-2 border-violet-800/40">
                                                <div className="p-3 bg-zinc-950/40">
                                                  <span className="text-[10px] font-semibold text-violet-400/70 uppercase tracking-wider block mb-2">
                                                    Sub-Craft Components — {cleanColorCodes(ing.name)}
                                                  </span>
                                                  <table className="w-full text-left border-collapse text-[10px]">
                                                    <thead>
                                                      <tr className="border-b border-zinc-800/60 text-zinc-600 font-medium">
                                                        <th className="p-2">Component</th>
                                                        <th className="p-2 text-right">Qty (1x craft)</th>
                                                        <th className="p-2 text-right">Qty (1x product)</th>
                                                        <th className="p-2 text-right">Batch Qty</th>
                                                        <th className="p-2 text-right">Unit Price</th>
                                                        <th className="p-2 text-right">Batch Cost</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-800/30">
                                                      {ing.subIngredients?.map((sub, si) => {
                                                        const outputCount = ing.subRecipeOutputCount || 1;
                                                        const qtyPerProduct = (sub.count * ing.count) / outputCount;
                                                        const batchQty = qtyPerProduct * (item.maxBatchCraftsMultiplier ?? item.batchSize ?? 1);
                                                        const batchCost = batchQty * sub.unitPrice;
                                                        return (
                                                          <tr key={`sub-ing-${ingKey}-${si}`} className="text-zinc-500 hover:bg-zinc-900/30">
                                                            <td className="p-2 font-sans uppercase tracking-tight text-zinc-400">{cleanColorCodes(sub.name)}</td>
                                                            <td className="p-2 text-right">×{Number(sub.count.toFixed(2)).toLocaleString()}</td>
                                                            <td className="p-2 text-right text-zinc-400">×{Number(qtyPerProduct.toFixed(2)).toLocaleString()}</td>
                                                            <td className="p-2 text-right font-bold text-zinc-200">×{Math.round(batchQty).toLocaleString()}</td>
                                                            <td className="p-2 text-right">{Math.round(sub.unitPrice).toLocaleString()} c</td>
                                                            <td className="p-2 text-right text-zinc-300">{formatNum(batchCost)}</td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                  <div className="mt-2 pt-2 border-t border-zinc-800/40 flex flex-wrap gap-6 text-[10px]">
                                                    <div>
                                                      <span className="text-zinc-600">Raw needed (1x product): </span>
                                                      <span className="font-mono text-zinc-300">
                                                        ×{ing.subIngredients?.reduce((acc, sub) => {
                                                          const outputCount = ing.subRecipeOutputCount || 1;
                                                          return acc + (sub.count * ing.count) / outputCount;
                                                        }, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                      </span>
                                                    </div>
                                                    <div>
                                                      <span className="text-zinc-600">Max batch from 71,680 raw: </span>
                                                      <span className="font-mono text-emerald-400">
                                                        ×{ing.subIngredients?.length > 0 ? Math.floor(
                                                          71680 / Math.max(...ing.subIngredients.map(sub => {
                                                            const outputCount = ing.subRecipeOutputCount || 1;
                                                            return (sub.count * ing.count) / outputCount;
                                                          }))
                                                        ).toLocaleString() : '—'}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan="12" className="p-8 text-center text-zinc-600 text-xs">
                      No NPC flip opportunities found with current filters.
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
