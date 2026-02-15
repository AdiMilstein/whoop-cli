import {Args} from '@oclif/core';
import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {colorRecovery, recoveryEmoji} from '../../lib/formatter.js';
import {formatFloat} from '../../lib/units.js';
import type {Recovery} from '../../lib/types.js';

export default class RecoveryGet extends BaseCommand {
  static override description = 'Get recovery for a specific cycle';

  static override examples = [
    '<%= config.bin %> recovery get 12345',
  ];

  static override args = {
    cycleId: Args.integer({description: 'Cycle ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(RecoveryGet);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    const recovery = await this.api.getCycleRecovery(args.cycleId);

    if (format === 'json') {
      this.log(JSON.stringify(recovery, null, 2));
      return;
    }

    this.printRecoveryDetail(recovery, noColor);
  }

  printRecoveryDetail(recovery: Recovery, noColor: boolean): void {
    if (recovery.score_state === 'PENDING_SCORE') {
      this.log('Recovery: (Pending)');
      return;
    }

    if (recovery.score_state === 'UNSCORABLE') {
      this.log('Recovery: (Unscorable)');
      return;
    }

    const s = recovery.score!;
    const emoji = recoveryEmoji(s.recovery_score);

    this.log(`${emoji} Recovery: ${colorRecovery(s.recovery_score, noColor)}`);
    this.log(`   HRV: ${formatFloat(s.hrv_rmssd_milli, 'ms')} | RHR: ${formatFloat(s.resting_heart_rate, 'bpm')}` +
      (s.spo2_percentage !== undefined ? ` | SpO2: ${formatFloat(s.spo2_percentage, '%')}` : '') +
      (s.skin_temp_celsius !== undefined ? ` | Skin Temp: ${formatFloat(s.skin_temp_celsius, '°C')}` : ''));

    if (s.user_calibrating) {
      this.log(noColor ? '   (User is calibrating)' : chalk.dim('   (User is calibrating)'));
    }
  }
}
