import {BaseCommand} from '../../lib/base-command.js';
import SleepGet from './get.js';

export default class SleepLatest extends BaseCommand {
  static override description = 'Get your latest sleep session';

  static override examples = [
    '<%= config.bin %> sleep latest',
    '<%= config.bin %> sleep latest --json',
    '<%= config.bin %> sleep latest -q',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(SleepLatest);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    const response = await this.api.listSleeps({limit: 1});
    if (response.records.length === 0) {
      this.log('No sleep data found.');
      return;
    }

    const sleep = response.records[0];

    if (flags.quiet) {
      if (sleep.score_state === 'SCORED' && sleep.score?.sleep_performance_percentage !== undefined) {
        this.log(String(Math.round(sleep.score.sleep_performance_percentage)));
      } else {
        this.log(sleep.score_state);
      }
      return;
    }

    if (format === 'json') {
      this.log(JSON.stringify(sleep, null, 2));
      return;
    }

    const getCmd = new SleepGet(this.argv, this.config);
    if (format === 'csv') {
      this.printFormatted(
        [getCmd.toSleepRow(sleep)],
        getCmd.getSleepColumns(),
        {format, noColor},
      );
      return;
    }

    getCmd.printSleepDetail(sleep, noColor);
  }
}
