import chalk from 'chalk';
import Table from 'cli-table3';

export type OutputFormat = 'table' | 'json' | 'csv';

export interface Column {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
}

export interface FormatOptions {
  format: OutputFormat;
  noColor?: boolean;
  quiet?: boolean;
  /** For quiet mode: which key to output */
  quietKey?: string;
}

/**
 * Format data according to the chosen output format.
 */
export function formatOutput(
  data: Record<string, unknown>[],
  columns: Column[],
  options: FormatOptions,
): string {
  if (options.quiet && options.quietKey) {
    return data.map((row) => String(row[options.quietKey!] ?? '')).join('\n');
  }

  switch (options.format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'csv':
      return formatCsv(data, columns);
    case 'table':
    default:
      return formatTable(data, columns, options.noColor);
  }
}

/**
 * Format as a pretty table using cli-table3.
 */
export function formatTable(
  data: Record<string, unknown>[],
  columns: Column[],
  noColor = false,
): string {
  if (data.length === 0) {
    return noColor ? 'No data found.' : chalk.dim('No data found.');
  }

  const table = new Table({
    head: columns.map((c) =>
      noColor ? c.header : chalk.bold(c.header),
    ),
    style: {
      head: noColor ? [] : ['cyan'],
      border: noColor ? [] : ['dim'],
    },
  });

  for (const row of data) {
    table.push(columns.map((col) => {
      const val = row[col.key];
      return val === undefined || val === null ? '—' : String(val);
    }));
  }

  return table.toString();
}

/**
 * Format as CSV.
 */
export function formatCsv(
  data: Record<string, unknown>[],
  columns: Column[],
): string {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      return csvEscape(val === undefined || val === null ? '' : String(val));
    }).join(','),
  );
  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// --- Color helpers ---

/**
 * Color-code a recovery score: green (67+), yellow (34-66), red (0-33).
 */
export function colorRecovery(score: number, noColor = false): string {
  const text = `${score.toFixed(0)}%`;
  if (noColor) return text;
  if (score >= 67) return chalk.green(text);
  if (score >= 34) return chalk.yellow(text);
  return chalk.red(text);
}

/**
 * Get recovery emoji based on score.
 */
export function recoveryEmoji(score: number): string {
  if (score >= 67) return '\u{1F7E2}'; // green circle
  if (score >= 34) return '\u{1F7E1}'; // yellow circle
  return '\u{1F534}'; // red circle
}

/**
 * Color-code a strain value (0-21 scale).
 */
export function colorStrain(strain: number, noColor = false): string {
  const text = strain.toFixed(1);
  if (noColor) return text;
  if (strain >= 18) return chalk.red(text);
  if (strain >= 14) return chalk.yellow(text);
  if (strain >= 10) return chalk.cyan(text);
  return chalk.green(text);
}

/**
 * Color-code sleep performance: green (85+), yellow (70-84), red (<70).
 */
export function colorSleepPerformance(pct: number, noColor = false): string {
  const text = `${pct.toFixed(0)}%`;
  if (noColor) return text;
  if (pct >= 85) return chalk.green(text);
  if (pct >= 70) return chalk.yellow(text);
  return chalk.red(text);
}

/**
 * Render a simple bar chart (for HR zone visualization).
 */
export function renderBar(fraction: number, width = 20, noColor = false): string {
  const filled = Math.round(fraction * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const pct = `${(fraction * 100).toFixed(0)}%`;

  if (noColor) return `${bar}  ${pct}`;
  return `${chalk.cyan(bar)}  ${pct}`;
}
