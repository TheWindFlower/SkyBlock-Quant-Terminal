/**
 * TrendArrow Component
 * 
 * Displays a visual indicator of price trend direction.
 * Shows an up arrow (▲) in emerald green for rising prices,
 * down arrow (▼) in red for falling prices, or nothing for flat/no trend.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.trend - The trend direction ('up', 'down', or any other value for flat)
 * @returns {JSX.Element|null} - Span element with arrow or null
 * 
 * @file utils/TrendArrow.jsx
 */
export function TrendArrow({ trend }) {
  // Up trend: emerald green up arrow
  if (trend === 'up') return <span className="text-emerald-400 text-[10px] ml-0.5">▲</span>;
  // Down trend: red down arrow
  if (trend === 'down') return <span className="text-red-400 text-[10px] ml-0.5">▼</span>;
  // Flat or no trend: return null (nothing displayed)
  return null;
}
