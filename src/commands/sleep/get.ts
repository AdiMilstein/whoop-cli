import {Args} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';
import {colorSleepPerformance} from '../../lib/formatter.js';
import {msToHuman, formatPercent, formatFloat} from '../../lib/units.js';
import type {Sleep} from '../../lib/types.js';

export default class SleepGet extends BaseCommand {
  static override description = 'Get a specific sleep session';

  static override examples = [
    '<%= config.bin %> sleep get <sleepId>',
  ];

  static override args = {
    sleepId: Args.string({description: 'Sleep ID (UUID)', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SleepGet);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    const sleep = await this.api.getSleep(args.sleepId);

    if (format === 'json') {
      this.log(JSON.stringify(sleep, null, 2));
      return;
    }

    this.printSleepDetail(sleep, noColor);
  }

  printSleepDetail(sleep: Sleep, noColor: boolean): void {
    if (sleep.score_state === 'PENDING_SCORE') {
      this.log('Sleep: (Pending)');
      return;
    }

    if (sleep.score_state === 'UNSCORABLE') {
      this.log('Sleep: (Unscorable)');
      return;
    }

    const sc = sleep.score!;
    const stages = sc.stage_summary;
    const totalSleep = stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli;

    const perfStr = sc.sleep_performance_percentage !== undefined
      ? colorSleepPerformance(sc.sleep_performance_percentage, noColor)
      : '—';

    this.log(`\u{1F634} Sleep: ${msToHuman(totalSleep)} (Performance: ${perfStr})`);
    this.log(`   Light: ${msToHuman(stages.total_light_sleep_time_milli)} | SWS: ${msToHuman(stages.total_slow_wave_sleep_time_milli)} | REM: ${msToHuman(stages.total_rem_sleep_time_milli)} | Awake: ${msToHuman(stages.total_awake_time_milli)}`);
    this.log(`   Efficiency: ${formatPercent(sc.sleep_efficiency_percentage)} | Consistency: ${formatPercent(sc.sleep_consistency_percentage)} | Resp Rate: ${formatFloat(sc.respiratory_rate)}`);
    this.log(`   Disturbances: ${stages.disturbance_count} | Sleep Cycles: ${stages.sleep_cycle_count}${sleep.nap ? ' | NAP' : ''}`);

    // Sleep needed breakdown
    const need = sc.sleep_needed;
    this.log('');
    this.log('   Sleep Needed:');
    this.log(`     Baseline:          ${msToHuman(need.baseline_milli)}`);
    this.log(`     + Sleep debt:      ${msToHuman(need.need_from_sleep_debt_milli)}`);
    this.log(`     + Recent strain:   ${msToHuman(need.need_from_recent_strain_milli)}`);
    if (need.need_from_recent_nap_milli < 0) {
      this.log(`     - Nap reduction:   ${msToHuman(Math.abs(need.need_from_recent_nap_milli))}`);
    }
  }
}
