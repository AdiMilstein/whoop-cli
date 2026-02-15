import {Args} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {setConfigValue} from '../../lib/config.js';

export default class ConfigSet extends BaseCommand {
  static override description = 'Set a configuration value';

  static override examples = [
    '<%= config.bin %> config set units imperial',
    '<%= config.bin %> config set default_format json',
    '<%= config.bin %> config set client_id your_id_here',
  ];

  static override args = {
    key: Args.string({description: 'Config key', required: true}),
    value: Args.string({description: 'Config value', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ConfigSet);
    const noColor = this.isNoColor(flags);

    try {
      setConfigValue(args.key, args.value);
      const display = args.key.includes('secret') ? '********' : args.value;
      this.log(noColor
        ? `Set ${args.key} = ${display}`
        : chalk.green(`Set ${args.key} = ${display}`));
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
