/**
 * Utility Helper Functions
 * 
 * Collection of pure utility functions used throughout the application for
 * text processing, number formatting, and parsing user input.
 * 
 * @file utils/helpers.js
 */

/**
 * Removes Minecraft color codes from text.
 * Minecraft uses § (section symbol) followed by a character for text coloring.
 * 
 * @function cleanColorCodes
 * @param {string} text - Input text potentially containing color codes
 * @returns {string} - Text with all color codes removed
 * @example
 * cleanColorCodes('§aGreen §cRed') // returns 'Green Red'
 */
export const cleanColorCodes = (text) => {
  if (!text) return '';
  return text.replace(/§./g, '');
};

/**
 * Parses compact number format (e.g., 1.5k, 2m, 1b) into actual numbers.
 * 
 * @function parseCompactNumber
 * @param {string|number} input - Input value, can be compact format or plain number
 * @returns {number} - Parsed numeric value
 * @example
 * parseCompactNumber('1.5k') // returns 1500
 * parseCompactNumber('2m')   // returns 2000000
 * parseCompactNumber('1b')   // returns 1000000000
 */
export const parseCompactNumber = (input) => {
  if (!input) return 0;
  const cleanInput = input.toString().trim().toLowerCase();
  const match = cleanInput.match(/^([0-9.]+)\s*([kmb]?)$/);
  if (!match) return parseFloat(cleanInput) || 0;
  const value = parseFloat(match[1]);
  const suffix = match[2];
  switch (suffix) {
    case 'k': return value * 1000;      // Thousand
    case 'm': return value * 1000000;   // Million
    case 'b': return value * 1000000000; // Billion
    default: return value;
  }
};

/**
 * Formats a number with appropriate suffix (K, M, B) for display.
 * Handles edge cases like undefined, null, and NaN.
 * 
 * @function formatNum
 * @param {number} num - Number to format
 * @returns {string} - Formatted string with suffix or locale formatting
 * @example
 * formatNum(1500)      // returns '1.5K'
 * formatNum(2000000)   // returns '2.0M'
 * formatNum(1000000000) // returns '1.0B'
 * formatNum(123456)    // returns '123,456'
 */
export const formatNum = (num) => {
  // --- SAFETY CHECK ---
  // Handle invalid inputs by returning '0'
  if (num === undefined || num === null || isNaN(num)) return '0';
  
  // Now proceed with your existing logic
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';    // Billions
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';    // Millions
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';    // Thousands
  
  // For numbers under 1000, use locale-aware formatting with max 1 decimal place
  return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

/**
 * Parses flip time input with units (hours, days, weeks) into hours.
 * 
 * @function parseFlipTime
 * @param {string|number} input - Time input with optional unit (h, d, w)
 * @returns {number} - Time in hours, or Infinity if invalid
 * @example
 * parseFlipTime('10')   // returns 10 (hours)
 * parseFlipTime('2h')   // returns 2 (hours)
 * parseFlipTime('3d')   // returns 72 (3 * 24 hours)
 * parseFlipTime('1w')   // returns 168 (7 * 24 hours)
 */
export const parseFlipTime = (input) => {
  if (!input) return Infinity;
  const clean = input.toString().trim().toLowerCase();
  const match = clean.match(/^([0-9.]+)\s*(h|d|w)?$/);
  if (!match) return Infinity;
  const value = parseFloat(match[1]);
  switch (match[2]) {
    case 'd': return value * 24;        // Days to hours
    case 'w': return value * 24 * 7;   // Weeks to hours
    default: return value; // hours (default)
  }
};
