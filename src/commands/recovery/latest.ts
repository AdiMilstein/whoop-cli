import {BaseCommand} from '../../lib/base-command.js';
import RecoveryGet from './get.js';

export default class RecoveryLatest extends BaseCommand {
  static override description = 'Get your latest recovery';

  static override examples = [
    '<%= config.bin %> recovery latest',
    '<%= config.bin %> recovery latest --json',
    '<%= config.bin %> recovery latest -q',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(RecoveryLatest);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    const response = await this.api.listRecoveries({limit: 1});
    if (response.records.length === 0) {
      this.log('No recovery data found.');
      return;
    }

    const recovery = response.records[0];

    if (flags.quiet) {
      if (recovery.score_state === 'SCORED' && recovery.score) {
        this.log(String(Math.round(recovery.score.recovery_score)));
      } else {
        this.log(recovery.score_state);
      }
      return;
    }

    if (format === 'json') {
      this.log(JSON.stringify(recovery, null, 2));
      return;
    }

    const getCmd = new RecoveryGet(this.argv, this.config);
    if (format === 'csv') {
      this.printFormatted(
        [getCmd.toRecoveryRow(recovery)],
        getCmd.getRecoveryColumns(),
        {format, noColor},
      );
      return;
    }

    getCmd.printRecoveryDetail(recovery, noColor);
  }
}
