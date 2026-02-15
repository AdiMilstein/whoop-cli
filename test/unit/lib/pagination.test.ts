import {describe, it, expect} from 'vitest';
import {paginate, parseDate} from '../../../src/lib/pagination.js';
import type {PaginatedResponse} from '../../../src/lib/types.js';

describe('paginate', () => {
  it('fetches a single page by default', async () => {
    const fetchPage = async (): Promise<PaginatedResponse<number>> => ({
      records: [1, 2, 3],
      next_token: 'token2',
    });

    const result = await paginate(fetchPage, {limit: 10});
    expect(result).toEqual([1, 2, 3]);
  });

  it('stops when no next_token', async () => {
    const fetchPage = async (): Promise<PaginatedResponse<number>> => ({
      records: [1, 2, 3],
    });

    const result = await paginate(fetchPage, {}, {all: true});
    expect(result).toEqual([1, 2, 3]);
  });

  it('fetches all pages with --all', async () => {
    let call = 0;
    const fetchPage = async (): Promise<PaginatedResponse<number>> => {
      call++;
      if (call === 1) return {records: [1, 2], next_token: 'page2'};
      if (call === 2) return {records: [3, 4], next_token: 'page3'};
      return {records: [5]};
    };

    const result = await paginate(fetchPage, {}, {all: true, interPageDelayMs: 0});
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('respects limit across pages', async () => {
    let call = 0;
    const fetchPage = async (): Promise<PaginatedResponse<number>> => {
      call++;
      if (call === 1) return {records: [1, 2, 3], next_token: 'page2'};
      return {records: [4, 5, 6]};
    };

    const result = await paginate(fetchPage, {}, {limit: 4, interPageDelayMs: 0});
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('respects pages option', async () => {
    let call = 0;
    const fetchPage = async (): Promise<PaginatedResponse<number>> => {
      call++;
      return {records: [call * 10], next_token: `page${call + 1}`};
    };

    const result = await paginate(fetchPage, {}, {pages: 2, interPageDelayMs: 0});
    expect(result).toEqual([10, 20]);
  });

  it('handles empty records', async () => {
    const fetchPage = async (): Promise<PaginatedResponse<number>> => ({records: []});
    const result = await paginate(fetchPage);
    expect(result).toEqual([]);
  });

  it('calls onPage callback', async () => {
    const pages: number[][] = [];
    const fetchPage = async (): Promise<PaginatedResponse<number>> => ({records: [1, 2, 3]});

    await paginate(fetchPage, {}, {
      onPage: (records) => {
        pages.push(records as number[]);
      },
    });

    expect(pages).toEqual([[1, 2, 3]]);
  });
});

describe('parseDate', () => {
  it('parses "today"', () => {
    const result = parseDate('today');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(result).toBe(today.toISOString());
  });

  it('parses "yesterday"', () => {
    const result = parseDate('yesterday');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    expect(result).toBe(yesterday.toISOString());
  });

  it('parses "7d"', () => {
    const result = parseDate('7d');
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expected.setHours(0, 0, 0, 0);
    expect(result).toBe(expected.toISOString());
  });

  it('parses "2w"', () => {
    const result = parseDate('2w');
    const expected = new Date();
    expected.setDate(expected.getDate() - 14);
    expected.setHours(0, 0, 0, 0);
    expect(result).toBe(expected.toISOString());
  });

  it('parses "1m"', () => {
    const result = parseDate('1m');
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 1);
    expected.setHours(0, 0, 0, 0);
    expect(result).toBe(expected.toISOString());
  });

  it('parses date-only ISO 8601', () => {
    const result = parseDate('2024-06-15');
    // The date is parsed as midnight local time, so the UTC ISO string
    // may differ depending on timezone. Verify the Date object is correct.
    const parsed = new Date(result);
    expect(parsed.getFullYear()).toBe(2024);
    expect(parsed.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(parsed.getDate()).toBe(15);
  });

  it('parses full ISO 8601', () => {
    const result = parseDate('2024-06-15T12:00:00Z');
    expect(new Date(result).toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('throws on invalid input', () => {
    expect(() => parseDate('not-a-date')).toThrow('Invalid date');
  });

  it('is case-insensitive', () => {
    const result = parseDate('TODAY');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(result).toBe(today.toISOString());
  });
});
