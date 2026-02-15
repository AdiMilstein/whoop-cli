import {describe, it, expect} from 'vitest';
import {
  msToHuman, kjToKcal, metersToFeetInches, kgToLbs,
  celsiusToFahrenheit, metersToMiles, metersToKm,
  formatNumber, formatPercent, formatFloat,
} from '../../../src/lib/units.js';

describe('msToHuman', () => {
  it('converts hours and minutes (short)', () => {
    expect(msToHuman(27_720_000)).toBe('7h 42m');
  });

  it('converts minutes and seconds (short)', () => {
    expect(msToHuman(185_000)).toBe('3m 05s');
  });

  it('converts seconds only', () => {
    expect(msToHuman(45_000)).toBe('45s');
  });

  it('handles zero', () => {
    expect(msToHuman(0)).toBe('0s');
  });

  it('handles negative values', () => {
    expect(msToHuman(-1000)).toBe('0s');
  });

  it('includes seconds in long form', () => {
    expect(msToHuman(3_723_000, false)).toBe('1h 02m 03s');
  });

  it('handles large durations', () => {
    expect(msToHuman(86_400_000)).toBe('24h 00m');
  });
});

describe('kjToKcal', () => {
  it('converts kilojoules to kilocalories', () => {
    expect(kjToKcal(4184)).toBe(1000);
  });

  it('rounds to nearest integer', () => {
    expect(kjToKcal(5210)).toBe(1245);
  });

  it('handles zero', () => {
    expect(kjToKcal(0)).toBe(0);
  });
});

describe('metersToFeetInches', () => {
  it('converts 1.83m', () => {
    expect(metersToFeetInches(1.83)).toBe("6'0\"");
  });

  it('converts 1.52m', () => {
    expect(metersToFeetInches(1.52)).toBe("5'0\"");
  });

  it('converts 1.70m', () => {
    const result = metersToFeetInches(1.70);
    expect(result).toMatch(/5'\d+"/);
  });
});

describe('kgToLbs', () => {
  it('converts 90.7kg', () => {
    expect(kgToLbs(90.7)).toBe(200);
  });

  it('handles zero', () => {
    expect(kgToLbs(0)).toBe(0);
  });
});

describe('celsiusToFahrenheit', () => {
  it('converts 0°C', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it('converts 100°C', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it('converts 33.4°C', () => {
    expect(celsiusToFahrenheit(33.4)).toBe(92.1);
  });
});

describe('metersToMiles', () => {
  it('converts 8047m to ~5 miles', () => {
    expect(metersToMiles(8047)).toBe(5);
  });

  it('handles zero', () => {
    expect(metersToMiles(0)).toBe(0);
  });
});

describe('metersToKm', () => {
  it('converts 8047m to ~8.05km', () => {
    expect(metersToKm(8047)).toBe(8.05);
  });
});

describe('formatNumber', () => {
  it('formats with commas', () => {
    expect(formatNumber(2847)).toBe('2,847');
  });

  it('handles small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('formatPercent', () => {
  it('formats percentage', () => {
    expect(formatPercent(94.123)).toBe('94.1%');
  });

  it('returns dash for undefined', () => {
    expect(formatPercent(undefined)).toBe('—');
  });
});

describe('formatFloat', () => {
  it('formats with suffix', () => {
    expect(formatFloat(45.23, 'ms')).toBe('45.2ms');
  });

  it('returns dash for undefined', () => {
    expect(formatFloat(undefined)).toBe('—');
  });
});
