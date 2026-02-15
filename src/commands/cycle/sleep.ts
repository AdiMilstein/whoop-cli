import {Args} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';
import SleepGet from '../sleep/get.js';

export default class CycleSleep extends BaseCommand {
  static override description = 'Get sleep data for a specific cycle';

  static override examples = [
    '<%= config.bin %> cycle sleep 12345',
  ];

  static override args = {
    cycleId: Args.integer({description: 'Cycle ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(CycleSleep);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    const sleep = await this.api.getCycleSleep(args.cycleId);

    if (format === 'json') {
      this.log(JSON.stringify(sleep, null, 2));
      return;
    }

    const getCmd = new SleepGet(this.argv, this.config);
    getCmd.printSleepDetail(sleep, noColor);
  }
}
