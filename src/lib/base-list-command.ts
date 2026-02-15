import {Flags} from '@oclif/core';
import {BaseCommand} from './base-command.js';
import {paginate, parseDate} from '../lib/pagination.js';
import type {PaginatedResponse, ListParams} from '../lib/types.js';
import type {Column, FormatOptions} from '../lib/formatter.js';

export abstract class BaseListCommand extends BaseCommand {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    start: Flags.string({
      description: 'Start date (ISO 8601 or relative: 7d, 2w, 1m, today, yesterday)',
    }),
    end: Flags.string({
      description: 'End date (ISO 8601 or relative: 7d, 2w, 1m, today, yesterday)',
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Number of records to fetch',
      min: 1,
    }),
    all: Flags.boolean({
      description: 'Fetch all pages',
      exclusive: ['limit', 'pages'],
    }),
    pages: Flags.integer({
      description: 'Number of pages to fetch',
      min: 1,
      exclusive: ['all'],
    }),
  };

  /**
   * Fetch a single page of data from the API.
   */
  protected abstract fetchPage(params: ListParams): Promise<PaginatedResponse<unknown>>;

  /**
   * Define table columns for this resource.
   */
  protected abstract getColumns(): Column[];

  /**
   * Map a single API record to a table row.
   */
  protected abstract mapToRow(record: unknown, units: 'metric' | 'imperial', noColor: boolean): Record<string, unknown>;

  /**
   * Key to output in quiet mode.
   */
  protected abstract getQuietKey(): string;

  async run(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {flags} = await this.parse(this.constructor as any) as {flags: Record<string, any>};
    const format = this.getOutputFormat(flags as any);
    const units = this.getUnits(flags as any);
    const noColor = this.isNoColor(flags as any);
    const columns = this.getColumns();

    const baseParams: ListParams = {};
    if (flags.start) baseParams.start = parseDate(flags.start as string);
    if (flags.end) baseParams.end = parseDate(flags.end as string);
    if (!flags.all && !flags.limit && !flags.pages) {
      baseParams.limit = this.cliConfig.default_limit ?? 10;
    }

    const records = await paginate(
      (params) => this.fetchPage(params),
      baseParams,
      {
        limit: flags.limit as number | undefined,
        all: flags.all as boolean | undefined,
        pages: flags.pages as number | undefined,
        onPage: (_pageRecords, pageNumber, hasMore) => {
          if (hasMore && (flags.all || (flags.pages && (flags.pages as number) > 1))) {
            process.stderr.write(`\rFetching page ${pageNumber}...`);
          }
        },
      },
    );

    // Clear progress indicator
    if (flags.all || (flags.pages && (flags.pages as number) > 1)) {
      process.stderr.write('\r' + ' '.repeat(60) + '\r');
    }

    if (format === 'json') {
      this.log(JSON.stringify(records, null, 2));
      return;
    }

    const rows = records.map((r) => this.mapToRow(r, units, noColor));
    const options: FormatOptions = {
      format,
      noColor,
      quiet: flags.quiet as boolean | undefined,
      quietKey: this.getQuietKey(),
    };

    this.printFormatted(rows, columns, options);
  }
}
