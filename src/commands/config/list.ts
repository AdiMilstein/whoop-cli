import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {loadConfig} from '../../lib/config.js';

export default class ConfigList extends BaseCommand {
  static override description = 'List all configuration values';

  static override examples = [
    '<%= config.bin %> config list',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {flags} = await this.parse(ConfigList);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);
    const config = loadConfig();

    if (format === 'json') {
      // Mask secrets in JSON output
      const masked = {...config};
      if (masked.client_secret) masked.client_secret = '********';
      this.log(JSON.stringify(masked, null, 2));
      return;
    }

    const entries: [string, string][] = [
      ['units', config.units ?? '(default: metric)'],
      ['default_format', config.default_format ?? '(default: table)'],
      ['default_limit', config.default_limit?.toString() ?? '(default: 10)'],
      ['color', config.color?.toString() ?? '(default: true)'],
      ['client_id', config.client_id ?? '(not set)'],
      ['client_secret', config.client_secret ? '********' : '(not set)'],
    ];

    for (const [key, value] of entries) {
      const keyStr = noColor ? key.padEnd(16) : chalk.cyan(key.padEnd(16));
      this.log(`  ${keyStr} ${value}`);
    }
  }
}
