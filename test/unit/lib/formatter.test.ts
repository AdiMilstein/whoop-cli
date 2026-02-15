import {describe, it, expect} from 'vitest';
import {
  formatOutput, formatCsv, colorRecovery, recoveryEmoji,
  colorStrain, colorSleepPerformance, renderBar,
} from '../../../src/lib/formatter.js';
import type {Column, FormatOptions} from '../../../src/lib/formatter.js';

const testColumns: Column[] = [
  {key: 'name', header: 'Name'},
  {key: 'value', header: 'Value'},
];

const testData = [
  {name: 'Alpha', value: 42},
  {name: 'Beta', value: 99},
];

describe('formatOutput', () => {
  it('outputs JSON', () => {
    const options: FormatOptions = {format: 'json'};
    const result = formatOutput(testData, testColumns, options);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(testData);
  });

  it('outputs CSV', () => {
    const options: FormatOptions = {format: 'csv'};
    const result = formatOutput(testData, testColumns, options);
    const lines = result.split('\n');
    expect(lines[0]).toBe('Name,Value');
    expect(lines[1]).toBe('Alpha,42');
    expect(lines[2]).toBe('Beta,99');
  });

  it('outputs quiet mode', () => {
    const options: FormatOptions = {format: 'table', quiet: true, quietKey: 'value'};
    const result = formatOutput(testData, testColumns, options);
    expect(result).toBe('42\n99');
  });

  it('outputs table', () => {
    const options: FormatOptions = {format: 'table', noColor: true};
    const result = formatOutput(testData, testColumns, options);
    expect(result).toContain('Name');
    expect(result).toContain('Alpha');
    expect(result).toContain('42');
  });

  it('handles empty data in table', () => {
    const options: FormatOptions = {format: 'table', noColor: true};
    const result = formatOutput([], testColumns, options);
    expect(result).toBe('No data found.');
  });

  it('handles undefined values in table', () => {
    const options: FormatOptions = {format: 'table', noColor: true};
    const data = [{name: 'Test', value: undefined}];
    const result = formatOutput(data as any, testColumns, options);
    expect(result).toContain('—');
  });
});

describe('formatCsv', () => {
  it('escapes commas', () => {
    const data = [{name: 'Hello, World', value: '42'}];
    const result = formatCsv(data, testColumns);
    expect(result).toContain('"Hello, World"');
  });

  it('escapes quotes', () => {
    const data = [{name: 'He said "hi"', value: '42'}];
    const result = formatCsv(data, testColumns);
    expect(result).toContain('"He said ""hi"""');
  });

  it('handles empty data', () => {
    const result = formatCsv([], testColumns);
    expect(result).toBe('Name,Value');
  });
});

describe('colorRecovery', () => {
  it('returns green for >= 67', () => {
    const result = colorRecovery(78, true);
    expect(result).toBe('78%');
  });

  it('returns yellow for 34-66', () => {
    const result = colorRecovery(50, true);
    expect(result).toBe('50%');
  });

  it('returns red for < 34', () => {
    const result = colorRecovery(20, true);
    expect(result).toBe('20%');
  });
});

describe('recoveryEmoji', () => {
  it('returns green for >= 67', () => {
    expect(recoveryEmoji(78)).toBe('\u{1F7E2}');
  });

  it('returns yellow for 34-66', () => {
    expect(recoveryEmoji(50)).toBe('\u{1F7E1}');
  });

  it('returns red for < 34', () => {
    expect(recoveryEmoji(20)).toBe('\u{1F534}');
  });
});

describe('colorStrain', () => {
  it('returns noColor string', () => {
    expect(colorStrain(14.2, true)).toBe('14.2');
  });
});

describe('colorSleepPerformance', () => {
  it('returns noColor string', () => {
    expect(colorSleepPerformance(94, true)).toBe('94%');
  });
});

describe('renderBar', () => {
  it('renders a bar with noColor', () => {
    const result = renderBar(0.5, 10, true);
    expect(result).toContain('50%');
    // 5 filled + 5 empty
    expect(result).toContain('\u2588'.repeat(5));
    expect(result).toContain('\u2591'.repeat(5));
  });

  it('handles 0%', () => {
    const result = renderBar(0, 10, true);
    expect(result).toContain('0%');
  });

  it('handles 100%', () => {
    const result = renderBar(1, 10, true);
    expect(result).toContain('100%');
  });
});
