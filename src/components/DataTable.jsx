//dataTable.jsx
import React, { useState } from 'react';
import { formatNum, cleanColorCodes } from '../utils/helpers';
import { TrendArrow } from '../utils/TrendArrow';

function useSortableData(data, defaultKey = 'profit') {
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

function VolumeCell({ item }) {
  const [hovered, setHovered] = useState(false);
  return (
    <td
      className="p-4 text-right font-mono text-zinc-400 relative cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="underline decoration-dashed decoration-zinc-600 underline-offset-2">
        {formatNum(item.liquidity || 0)}
      </span>
      {hovered && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#1c1c1e] border border-zinc-700 rounded-lg p-3 shadow-xl text-left min-w-[160px] pointer-events-none">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">7d Volume Breakdown</div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-zinc-400">Buy vol</span>
            <span className="font-mono text-sky-400">{formatNum(item.buy7dVolume || 0)}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs mt-1">
            <span className="text-zinc-400">Sell vol</span>
            <span className="font-mono text-violet-400">{formatNum(item.sell7dVolume || 0)}</span>
          </div>
        </div>
      )}
    </td>
  );
}

export default function DataTable({
  displayedData,
  activeTab,
  expandedItem,
  setExpandedItem,
  hideItem
}) {
  const [expandedIngredient, setExpandedIngredient] = useState(null);
  const { sorted, sortConfig, toggle } = useSortableData(displayedData, 'profit');
  const sh = { sortConfig, toggle };

  return (
    <div className="bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-[#18181b]/40 select-none">
              <th
                className={`p-4 font-medium cursor-pointer hover:text-zinc-200 transition-colors whitespace-nowrap sticky left-0 bg-[#18181b] z-10 ${sortConfig.key === 'name' ? 'text-zinc-100' : 'text-zinc-400'}`}
                onClick={() => toggle('name')}
                title="The unique item code name."
              >
                Asset Identifier {sortConfig.key === 'name' ? (sortConfig.dir === 'desc' ? '↓' : '↑') : <span className="text-zinc-700">↕</span>}
              </th>
              <SortTh label="Profit (1x) ⓘ" colKey="profit" title="Net coins generated per crafted item." {...sh} className="text-right" />
              <SortTh label="Max Order Profit ⓘ" colKey="totalBatchProfit" title="Gains from a maximum constraint item buy cap order stack." {...sh} className="text-right" />
              <SortTh label="Execution Speed ⓘ" colKey="hoursToFill" title="Calculated turnover velocity rating pipeline." {...sh} className="text-right" />
              <SortTh label="Flip Time ⓘ" colKey="flipTimeHours" title="Expected time to flip max order based on volume." {...sh} className="text-right" />
              <SortTh label="Margin ⓘ" colKey="marginPct" title="Return on investment margin baseline." {...sh} className="text-right" />
              <SortTh label="Unit Capital ⓘ" colKey="craftCost" title="Capital outlays for structural layout components." {...sh} className="text-right" />
              <SortTh label="Exposure ⓘ" colKey="totalBatchCost" title="Total bankroll exposure required for max order configurations." {...sh} className="text-right" />
              <SortTh label="Volume ⓘ" colKey="liquidity" title="7d combined market volume — hover for split." {...sh} className="text-right" />
              <SortTh label="Vol Δ ⓘ" colKey="volumeDelta" title="Buy minus sell volume. Positive = more buyers than sellers." {...sh} className="text-right" />
              <SortTh label="NPC Price ⓘ" colKey="npcPrice" title="NPC sell price if available." {...sh} className="text-right" />
              <SortTh label="NPC Profit ⓘ" colKey="npcProfit" title="Profit if selling to NPC instead of bazaar (no tax)." {...sh} className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {sorted.map((item, rowIndex) => {
              const isExpanded = expandedItem === item.id;
              const isProfitable = item.profit > 0;

              let speedLabel = "FAST";
              let speedColor = "text-emerald-400 bg-emerald-950/40 border-emerald-800/60";
              if (item.hoursToFill > 12) {
                speedLabel = "STAGNANT";
                speedColor = "text-red-400 bg-red-950/40 border-red-800/60";
              } else if (item.hoursToFill > 3) {
                speedLabel = "MODERATE";
                speedColor = "text-amber-400 bg-amber-950/40 border-amber-800/60";
              }

              const ft = item.flipTimeHours ?? item.hoursToFill ?? 0;
              const flipLabel = ft < 1 ? '<1h' : ft < 24 ? `${Math.round(ft)}h` : `${(ft / 24).toFixed(1)}d`;
              let flipColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
              if (ft > 168) flipColor = 'text-red-400 bg-red-950/40 border-red-800/60';
              else if (ft > 24) flipColor = 'text-amber-400 bg-amber-950/40 border-amber-800/60';

              const delta = (item.buy7dVolume || 0) - (item.sell7dVolume || 0);
              const deltaColor = delta > 0 ? 'text-sky-400' : delta < 0 ? 'text-violet-400' : 'text-zinc-500';

              const uniqueRowKey = `row-${item.id}-${activeTab}-${rowIndex}`;

              return (
                <React.Fragment key={uniqueRowKey}>
                  <tr
                    onClick={() => activeTab === 'crafting' && setExpandedItem(isExpanded ? null : item.id)}
                    className={`hover:bg-zinc-900/60 transition-colors ${activeTab === 'crafting' ? 'cursor-pointer' : ''} group select-none ${isExpanded ? 'bg-zinc-900/40' : ''}`}
                  >
                    {/* Sticky name cell */}
                    <td className={`p-4 font-medium text-zinc-100 uppercase tracking-tight sticky left-0 z-10 ${isExpanded ? 'bg-zinc-900/40' : 'bg-[#121214]'} group-hover:bg-zinc-900/60 transition-colors`}>
                      <div className="flex items-center justify-between gap-4 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          {activeTab === 'crafting' && <span className="text-[9px] text-zinc-500 font-mono w-2 block">{isExpanded ? '▼' : '▶'}</span>}
                          {item.name}
                        </div>
                        <button
                          onClick={(e) => hideItem(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 font-medium px-2 py-0.5 rounded border border-zinc-800 bg-[#09090b] text-[10px] tracking-wide transition-all duration-100 shrink-0"
                        >
                          Hide
                        </button>
                      </div>
                    </td>

                    <td className={`p-4 text-right font-mono font-semibold whitespace-nowrap ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                      {Math.round(item.profit).toLocaleString()}
                      <TrendArrow trend={item.buyTrend} />
                      {item.bestSell === 'npc' && (
                        <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-400 font-mono">NPC</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-zinc-100 whitespace-nowrap">
                      {formatNum(item.totalBatchProfit)}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-medium font-sans inline-block ${speedColor}`}>
                        {speedLabel} ({item.hoursToFill < 1 ? '<1h' : `${Math.round(item.hoursToFill)}h`})
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-medium inline-block ${flipColor}`}>
                        {flipLabel}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-medium">
                        {item.marginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-zinc-400 whitespace-nowrap">{Math.round(item.craftCost).toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-zinc-300 whitespace-nowrap">
                      {formatNum(item.totalBatchCost)}
                    </td>
                    <VolumeCell item={item} />
                    <td className="p-4 text-right font-mono whitespace-nowrap">
                      <span className={deltaColor}>{delta > 0 ? '+' : ''}{formatNum(delta)}</span>
                    </td>
                    {/* NPC Price */}
                    <td className="p-4 text-right font-mono whitespace-nowrap">
                      {item.npcPrice
                        ? <span className="text-amber-400">{formatNum(item.npcPrice)}</span>
                        : <span className="text-zinc-700">—</span>
                      }
                    </td>
                    {/* NPC Profit */}
                    <td className="p-4 text-right font-mono whitespace-nowrap">
                      {item.npcProfit !== null && item.npcProfit !== undefined
                        ? <span className={item.npcProfit > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {item.npcProfit > 0 ? '+' : ''}{formatNum(item.npcProfit)}
                          </span>
                        : <span className="text-zinc-700">—</span>
                      }
                    </td>
                  </tr>

                  {activeTab === 'crafting' && isExpanded && (
                    <tr key={`expanded-${uniqueRowKey}`} className="bg-[#09090b]/60">
                      <td colSpan="12" className="p-6 border-l border-zinc-500 bg-zinc-950/20 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Capital curve */}
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
                            {/* Batch summary */}
                            <div className="pt-2 border-t border-zinc-800 space-y-1.5 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Max batch crafts</span>
                                <span className="font-mono text-zinc-300">×{item.maxBatchCraftsMultiplier?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Batch cost</span>
                                <span className="font-mono text-zinc-300">{formatNum(item.totalBatchCost)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Bazaar profit</span>
                                <span className={`font-mono font-bold ${item.totalBatchProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNum(item.totalBatchProfit)}</span>
                              </div>
                              {item.npcPrice && (
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">NPC profit</span>
                                  <span className={`font-mono font-bold ${item.npcBatchProfit > 0 ? 'text-amber-400' : 'text-red-400'}`}>{formatNum(item.npcBatchProfit)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ingredients table */}
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
                                            {ing.isCraftResolved && (
                                              <span className="text-[9px] text-zinc-500 font-mono w-2">{isIngExpanded ? '▼' : '▶'}</span>
                                            )}
                                            {cleanColorCodes(ing.name)}
                                            {ing.isCraftResolved && (
                                              <span className="text-[9px] px-1 py-0.5 rounded bg-violet-950/60 border border-violet-800/50 text-violet-400 font-mono tracking-wide">CRAFTED</span>
                                            )}
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
                                                    <th className="p-2 text-right" title="Qty needed to craft 1 unit of this sub-ingredient">Qty (1x craft)</th>
                                                    <th className="p-2 text-right" title="Qty needed per 1 final product">Qty (1x product)</th>
                                                    <th className="p-2 text-right" title="Total qty needed for the full batch">Batch Qty</th>
                                                    <th className="p-2 text-right">Unit Price</th>
                                                    <th className="p-2 text-right">Batch Cost</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800/30">
                                                  {ing.subIngredients?.map((sub, si) => {
                                                    const outputCount = ing.subRecipeOutputCount || 1;
                                                    const qtyPerProduct = (sub.count * ing.count) / outputCount;
                                                    const batchQty = qtyPerProduct * (item.maxBatchCraftsMultiplier ?? 1);
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
                                              {/* Raw leaf summary */}
                                              <div className="mt-2 pt-2 border-t border-zinc-800/40 flex gap-6 text-[10px]">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
