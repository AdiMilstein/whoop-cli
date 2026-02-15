/**
 * Convert milliseconds to human-readable duration.
 * @param ms - Duration in milliseconds
 * @param short - If true, use compact format (e.g., "7h 42m"). If false, include seconds.
 */
export function msToHuman(ms: number, short = true): string {
  if (ms < 0) ms = 0;

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (short) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  if (minutes > 0) {
    if (short) {
      return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${seconds}s`;
}

/**
 * Convert kilojoules to kilocalories.
 */
export function kjToKcal(kj: number): number {
  return Math.round(kj / 4.184);
}

/**
 * Convert meters to feet and inches string (e.g., "6'0\"").
 */
export function metersToFeetInches(m: number): string {
  const totalInches = m * 39.3701;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  // Handle rounding to 12 inches
  if (inches === 12) {
    return `${feet + 1}'0"`;
  }
  return `${feet}'${inches}"`;
}

/**
 * Convert kilograms to pounds.
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

/**
 * Convert Celsius to Fahrenheit.
 */
export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

/**
 * Convert meters to miles.
 */
export function metersToMiles(m: number): number {
  return Math.round(m / 1609.344 * 100) / 100;
}

/**
 * Convert meters to kilometers.
 */
export function metersToKm(m: number): number {
  return Math.round(m / 1000 * 100) / 100;
}

/**
 * Format a number with commas (e.g., 2847 → "2,847").
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format a percentage with one decimal place.
 */
export function formatPercent(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return `${n.toFixed(1)}%`;
}

/**
 * Format a float with one decimal place.
 */
export function formatFloat(n: number | undefined, suffix = ''): string {
  if (n === undefined || n === null) return '—';
  return `${n.toFixed(1)}${suffix}`;
}
