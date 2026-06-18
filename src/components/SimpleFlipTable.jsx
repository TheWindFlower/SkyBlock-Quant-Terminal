//SimpleFlipeTable.jsx
import React, { useState, useEffect, useRef } from 'react';
import { formatNum } from '../utils/helpers';
import { TrendArrow } from '../utils/TrendArrow';

const MAX_ORDER = 71680;

function useSortableData(data, defaultKey = 'buyingScore') {
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
      className={`p-4 font-medium select-none cursor-pointer hover:text-zinc-200 transition-colors ${active ? 'text-zinc-100' : 'text-zinc-400'} ${className}`}
      onClick={() => toggle(colKey)}
    >
      {label} {active ? (sortConfig.dir === 'desc' ? '↓' : '↑') : <span className="text-zinc-700">↕</span>}
    </th>
  );
}

function MiniPriceChart({ buyPrice, sellPrice }) {
  const points = 20;
  const buyPoints = Array.from({ length: points }, (_, i) => buyPrice * (1 + (Math.sin(i * 0.8) * 0.012)));
  const sellPoints = Array.from({ length: points }, (_, i) => sellPrice * (1 + (Math.sin(i * 0.6 + 1) * 0.010)));

  const allPrices = [...buyPoints, ...sellPoints];
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;

  const W = 220, H = 80, padX = 8, padY = 8;

  const toSvg = (val, idx) => {
    const x = padX + (idx / (points - 1)) * (W - padX * 2);
    const y = padY + (1 - (val - minP) / range) * (H - padY * 2);
    return `${x},${y}`;
  };

  const buyPath = buyPoints.map((v, i) => toSvg(v, i)).join(' ');
  const sellPath = sellPoints.map((v, i) => toSvg(v, i)).join(' ');
  const lastBuy = toSvg(buyPoints[points - 1], points - 1).split(',');
  const lastSell = toSvg(sellPoints[points - 1], points - 1).split(',');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <polyline points={buyPath} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={sellPath} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lastBuy[0]} cy={lastBuy[1]} r="2.5" fill="#38bdf8" />
      <circle cx={lastSell[0]} cy={lastSell[1]} r="2.5" fill="#a78bfa" />
    </svg>
  );
}

function AssetCell({ item }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: true });

  useEffect(() => {
    if (hovered && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 180 < window.innerHeight });
    }
  }, [hovered]);

  return (
    <td
      ref={ref}
      className="p-4 font-medium text-zinc-100 uppercase relative cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="underline decoration-dashed decoration-zinc-600 underline-offset-2">{item.name}</span>
      {hovered && (
        <div className={`absolute left-0 z-50 w-[240px] bg-[#1c1c1e] border border-zinc-700 rounded-xl p-3 shadow-2xl pointer-events-none ${pos.top ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Price Chart (simulated curve)</div>
          <div className="w-full h-20">
            <MiniPriceChart buyPrice={item.buyPrice} sellPrice={item.sellPrice} />
          </div>
          <div className="flex justify-between mt-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-sky-400 inline-block rounded" /> Buy {formatNum(item.buyPrice)}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-violet-400 inline-block rounded" /> Sell {formatNum(item.sellPrice)}</span>
          </div>
        </div>
      )}
    </td>
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
        {formatNum(item.volume || 0)}
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

export default function SimpleFlipTable({ displayedData }) {
  const { sorted, sortConfig, toggle } = useSortableData(displayedData, 'buyingScore');
  const sh = { sortConfig, toggle };

  return (
    <div className="bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-[#18181b]/40">
            <th
              className={`p-4 font-medium select-none cursor-pointer hover:text-zinc-200 transition-colors ${sortConfig.key === 'name' ? 'text-zinc-100' : 'text-zinc-400'}`}
              onClick={() => toggle('name')}
            >
              Asset Identifier {sortConfig.key === 'name' ? (sortConfig.dir === 'desc' ? '↓' : '↑') : <span className="text-zinc-700">↕</span>}
            </th>
            <SortTh label="Margin (Spread)" colKey="margin" {...sh} className="text-right" />
            <SortTh label="Buying Score" colKey="buyingScore" {...sh} className="text-right" />
            <SortTh label="Volume ⓘ" colKey="volume" title="Total 7d volume — hover for buy/sell split" {...sh} className="text-right" />
            <SortTh label="Vol Δ ⓘ" colKey="volumeDelta" title="Buy minus sell volume. Positive = more buyers." {...sh} className="text-right" />
            <SortTh label="Flip Time" colKey="flipTimeHours" {...sh} className="text-right" />
            <SortTh label="Batch Profit (71K) ⓘ" colKey="batchProfit" title="Expected profit buying 71,680 units" {...sh} className="text-right" />
            <SortTh label="Batch Cost (71K) ⓘ" colKey="batchCost" title="Total capital needed to buy 71,680 units" {...sh} className="text-right" />
            <SortTh label="Buy Order Price" colKey="buyPrice" {...sh} className="text-right" />
            <SortTh label="Sell Offer Price" colKey="sellPrice" {...sh} className="text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {sorted.map((item, i) => {
            const batchProfit = (item.margin || 0) * MAX_ORDER;
            const batchCost = (item.buyPrice || 0) * MAX_ORDER;

            const weeklyVol = item.volume || 1;
            const hourlyVol = weeklyVol / (7 * 24);
            const flipTimeHours = MAX_ORDER / hourlyVol;
            const flipLabel = flipTimeHours < 1 ? '<1h'
              : flipTimeHours < 24 ? `${Math.round(flipTimeHours)}h`
              : `${(flipTimeHours / 24).toFixed(1)}d`;

            let flipColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
            if (flipTimeHours > 168) flipColor = 'text-red-400 bg-red-950/40 border-red-800/60';
            else if (flipTimeHours > 24) flipColor = 'text-amber-400 bg-amber-950/40 border-amber-800/60';

            const delta = (item.buy7dVolume || 0) - (item.sell7dVolume || 0);
            const deltaColor = delta > 0 ? 'text-sky-400' : delta < 0 ? 'text-violet-400' : 'text-zinc-500';

            return (
              <tr key={`simple-${item.id}-${i}`} className="hover:bg-zinc-900/40 transition-colors">
                <AssetCell item={item} />
                <td className="p-4 text-right font-mono text-emerald-400 font-bold">{formatNum(item.margin || 0)}</td>
                <td className="p-4 text-right font-mono text-amber-400">{formatNum(item.buyingScore || 0)}</td>
                <VolumeCell item={item} />
                <td className="p-4 text-right font-mono">
                  <span className={deltaColor}>{delta > 0 ? '+' : ''}{formatNum(delta)}</span>
                </td>
                <td className="p-4 text-right">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-medium inline-block ${flipColor}`}>
                    {flipLabel}
                  </span>
                </td>
                <td className={`p-4 text-right font-mono font-bold ${batchProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatNum(batchProfit)}
                </td>
                <td className="p-4 text-right font-mono text-zinc-300">{formatNum(batchCost)}</td>
                <td className="p-4 text-right font-mono text-zinc-400">
                  {formatNum(item.buyPrice || 0)}<TrendArrow trend={item.buyTrend} />
                </td>
                <td className="p-4 text-right font-mono text-zinc-400">
                  {formatNum(item.sellPrice || 0)}<TrendArrow trend={item.sellTrend} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
