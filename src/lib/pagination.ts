import type {PaginatedResponse, ListParams} from './types.js';

export interface PaginateOptions {
  /** Maximum total records to fetch. */
  limit?: number;
  /** Fetch all pages until exhausted. */
  all?: boolean;
  /** Maximum number of pages to fetch. */
  pages?: number;
  /** Called after each page is fetched (for streaming output). */
  onPage?: (records: unknown[], pageNumber: number, hasMore: boolean) => void;
  /** Delay between page fetches in ms (rate-limit protection). */
  interPageDelayMs?: number;
}

/**
 * Generic auto-pagination helper.
 *
 * @param fetchPage - Function that fetches a single page given ListParams.
 * @param baseParams - Base query params (start, end, etc.).
 * @param options - Pagination options (limit, all, pages, onPage callback).
 * @returns All fetched records.
 */
export async function paginate<T>(
  fetchPage: (params: ListParams) => Promise<PaginatedResponse<T>>,
  baseParams: ListParams = {},
  options: PaginateOptions = {},
): Promise<T[]> {
  const allRecords: T[] = [];
  let nextToken: string | undefined;
  let pageCount = 0;
  const maxPages = options.pages ?? (options.all || options.limit ? Infinity : 1);
  const maxRecords = options.limit ?? (options.all ? Infinity : undefined);
  const delay = options.interPageDelayMs ?? 75;

  const pageSize = baseParams.limit ?? 10;

  do {
    const params: ListParams = {
      ...baseParams,
      limit: maxRecords !== undefined
        ? Math.min(maxRecords - allRecords.length, 25)
        : pageSize,
      nextToken,
    };

    const response = await fetchPage(params);
    const records = response.records;
    allRecords.push(...records);
    nextToken = response.next_token;
    pageCount++;

    const hasMore = !!nextToken && pageCount < maxPages &&
      (maxRecords === undefined || allRecords.length < maxRecords);

    if (options.onPage) {
      options.onPage(records as unknown[], pageCount, hasMore);
    }

    // Stop conditions
    if (!nextToken) break;
    if (pageCount >= maxPages) break;
    if (maxRecords !== undefined && allRecords.length >= maxRecords) break;

    // Inter-page delay to avoid rate limiting
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  } while (true);

  // Trim to exact limit if we over-fetched
  if (maxRecords !== undefined && allRecords.length > maxRecords) {
    return allRecords.slice(0, maxRecords);
  }

  return allRecords;
}

/**
 * Parse a relative date string (7d, 2w, 1m, today, yesterday) or ISO 8601
 * into an ISO 8601 datetime string in the local timezone.
 */
export function parseDate(input: string): string {
  const lower = input.toLowerCase().trim();

  if (lower === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  if (lower === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  // Relative: Nd, Nw, Nm
  const relMatch = lower.match(/^(\d+)([dwm])$/);
  if (relMatch) {
    const amount = Number.parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    const d = new Date();
    d.setHours(0, 0, 0, 0);

    switch (unit) {
      case 'd':
        d.setDate(d.getDate() - amount);
        break;
      case 'w':
        d.setDate(d.getDate() - (amount * 7));
        break;
      case 'm':
        d.setMonth(d.getMonth() - amount);
        break;
    }

    return d.toISOString();
  }

  // ISO 8601: if it looks like a date-only string, add midnight local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(input + 'T00:00:00');
    return d.toISOString();
  }

  // Otherwise, assume full ISO 8601
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: "${input}". Use ISO 8601 (2024-01-15) or relative (7d, 2w, 1m, today, yesterday).`);
  }

  return d.toISOString();
}
