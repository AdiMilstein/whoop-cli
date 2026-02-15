import {Command, Flags} from '@oclif/core';
import {loadAuth} from '../lib/auth.js';
import {loadConfig} from '../lib/config.js';
import {getApi, type WhoopApi} from '../lib/api.js';
import type {OutputFormat, Column, FormatOptions} from '../lib/formatter.js';
import {formatOutput} from '../lib/formatter.js';
import type {CliConfig} from '../lib/types.js';

export abstract class BaseCommand extends Command {
  static baseFlags = {
    json: Flags.boolean({
      description: 'Output raw JSON',
      exclusive: ['csv', 'format'],
    }),
    csv: Flags.boolean({
      description: 'Output as CSV',
      exclusive: ['json', 'format'],
    }),
    format: Flags.string({
      description: 'Output format (table, json, csv)',
      options: ['table', 'json', 'csv'],
      exclusive: ['json', 'csv'],
    }),
    'no-color': Flags.boolean({
      description: 'Disable colored output',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Minimal output (key value only, for scripting)',
    }),
    units: Flags.string({
      description: 'Unit system (metric, imperial)',
      options: ['metric', 'imperial'],
    }),
  };

  protected api!: WhoopApi;
  protected cliConfig!: CliConfig;

  /**
   * Whether this command requires authentication.
   * Override to false in auth/config commands.
   */
  protected requiresAuth = true;

  protected getOutputFormat(flags: {json?: boolean; csv?: boolean; format?: string}): OutputFormat {
    if (flags.json) return 'json';
    if (flags.csv) return 'csv';
    if (flags.format) return flags.format as OutputFormat;
    return this.cliConfig.default_format ?? 'table';
  }

  protected getUnits(flags: {units?: string}): 'metric' | 'imperial' {
    if (flags.units === 'metric' || flags.units === 'imperial') return flags.units;
    return this.cliConfig.units ?? 'metric';
  }

  protected isNoColor(flags: {'no-color'?: boolean}): boolean {
    return flags['no-color'] ?? this.cliConfig.color === false;
  }

  protected printFormatted(
    data: Record<string, unknown>[],
    columns: Column[],
    options: FormatOptions,
  ): void {
    this.log(formatOutput(data, columns, options));
  }

  async init(): Promise<void> {
    await super.init();

    // Load config (lazy, cached)
    this.cliConfig = loadConfig();

    // Check auth if required
    if (this.requiresAuth) {
      const auth = loadAuth();
      if (!auth) {
        this.error('Not authenticated. Run "whoop auth login" to get started.');
      }
    }

    // Lazy API client
    this.api = getApi();
  }
}
