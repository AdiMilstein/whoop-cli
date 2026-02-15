import chalk from 'chalk';
import {BaseCommand} from '../lib/base-command.js';
import {colorRecovery, recoveryEmoji, colorStrain, colorSleepPerformance} from '../lib/formatter.js';
import {msToHuman, kjToKcal, formatNumber, formatFloat, formatPercent} from '../lib/units.js';
import type {Cycle, Recovery, Sleep, Workout} from '../lib/types.js';

export default class Dashboard extends BaseCommand {
  static override description = 'Show today\'s WHOOP overview (recovery, strain, sleep, workout)';

  static override examples = [
    '<%= config.bin %> dashboard',
    '<%= config.bin %> dashboard --json',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Dashboard);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    // Step 1: Fetch latest cycle
    const cyclesResponse = await this.api.listCycles({limit: 1});
    const cycle: Cycle | undefined = cyclesResponse.records[0];

    if (!cycle) {
      this.log('No cycle data found.');
      return;
    }

    // Step 2: Fan out — recovery (needs cycle_id), sleep, workout in parallel
    const [recoveryResult, sleepResult, workoutResult] = await Promise.allSettled([
      this.api.getCycleRecovery(cycle.id),
      this.api.listSleeps({limit: 1}),
      this.api.listWorkouts({limit: 1}),
    ]);

    const recovery: Recovery | undefined = recoveryResult.status === 'fulfilled' ? recoveryResult.value : undefined;
    const sleep: Sleep | undefined = sleepResult.status === 'fulfilled' ? sleepResult.value.records[0] : undefined;
    const workout: Workout | undefined = workoutResult.status === 'fulfilled' ? workoutResult.value.records[0] : undefined;

    if (format === 'json') {
      this.log(JSON.stringify({cycle, recovery, sleep, workout}, null, 2));
      return;
    }

    // --- Recovery ---
    this.printRecoverySection(recovery, noColor);
    this.log('');

    // --- Strain (from cycle) ---
    this.printStrainSection(cycle, noColor);
    this.log('');

    // --- Sleep ---
    this.printSleepSection(sleep, noColor);
    this.log('');

    // --- Workout ---
    this.printWorkoutSection(workout, noColor);
  }

  private printRecoverySection(recovery: Recovery | undefined, noColor: boolean): void {
    if (!recovery) {
      this.log(`${recoveryEmoji(50)} Recovery: No data`);
      return;
    }

    if (recovery.score_state !== 'SCORED' || !recovery.score) {
      this.log(`${recoveryEmoji(50)} Recovery: (${recovery.score_state === 'PENDING_SCORE' ? 'Pending' : 'Unscorable'})`);
      return;
    }

    const s = recovery.score;
    const label = s.recovery_score >= 67 ? 'Green' : s.recovery_score >= 34 ? 'Yellow' : 'Red';

    this.log(`${recoveryEmoji(s.recovery_score)} Recovery: ${colorRecovery(s.recovery_score, noColor)} (${label})`);

    const details = [`HRV: ${formatFloat(s.hrv_rmssd_milli, 'ms')}`, `RHR: ${formatFloat(s.resting_heart_rate, 'bpm')}`];
    if (s.spo2_percentage !== undefined) details.push(`SpO2: ${formatFloat(s.spo2_percentage, '%')}`);
    if (s.skin_temp_celsius !== undefined) details.push(`Skin Temp: ${formatFloat(s.skin_temp_celsius, '°C')}`);
    this.log(`   ${details.join(' | ')}`);
  }

  private printStrainSection(cycle: Cycle, noColor: boolean): void {
    if (cycle.score_state !== 'SCORED' || !cycle.score) {
      this.log(`\u{1F4CA} Today's Strain: (${cycle.score_state === 'PENDING_SCORE' ? 'Pending' : 'Unscorable'})`);
      return;
    }

    const s = cycle.score;
    this.log(`\u{1F4CA} Today's Strain: ${colorStrain(s.strain, noColor)} / 21`);
    this.log(`   Calories: ${formatNumber(kjToKcal(s.kilojoule))} kcal | Avg HR: ${s.average_heart_rate}bpm | Max HR: ${s.max_heart_rate}bpm`);
  }

  private printSleepSection(sleep: Sleep | undefined, noColor: boolean): void {
    if (!sleep) {
      this.log('\u{1F634} Last Sleep: No data');
      return;
    }

    if (sleep.score_state !== 'SCORED' || !sleep.score) {
      this.log(`\u{1F634} Last Sleep: (${sleep.score_state === 'PENDING_SCORE' ? 'Pending' : 'Unscorable'})`);
      return;
    }

    const sc = sleep.score;
    const stages = sc.stage_summary;
    const totalSleep = stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli;

    const perfStr = sc.sleep_performance_percentage !== undefined
      ? ` (Performance: ${colorSleepPerformance(sc.sleep_performance_percentage, noColor)})`
      : '';

    this.log(`\u{1F634} Last Sleep: ${msToHuman(totalSleep)}${perfStr}`);
    this.log(`   Light: ${msToHuman(stages.total_light_sleep_time_milli)} | SWS: ${msToHuman(stages.total_slow_wave_sleep_time_milli)} | REM: ${msToHuman(stages.total_rem_sleep_time_milli)} | Awake: ${msToHuman(stages.total_awake_time_milli)}`);

    const sleepDetails = [];
    if (sc.sleep_efficiency_percentage !== undefined) sleepDetails.push(`Efficiency: ${formatPercent(sc.sleep_efficiency_percentage)}`);
    if (sc.sleep_consistency_percentage !== undefined) sleepDetails.push(`Consistency: ${formatPercent(sc.sleep_consistency_percentage)}`);
    if (sc.respiratory_rate !== undefined) sleepDetails.push(`Resp Rate: ${formatFloat(sc.respiratory_rate)}`);
    if (sleepDetails.length > 0) {
      this.log(`   ${sleepDetails.join(' | ')}`);
    }
  }

  private printWorkoutSection(workout: Workout | undefined, noColor: boolean): void {
    if (!workout) {
      this.log('\u{1F3CB}\u{FE0F} Last Workout: No data');
      return;
    }

    if (workout.score_state !== 'SCORED' || !workout.score) {
      this.log(`\u{1F3CB}\u{FE0F} Last Workout: ${workout.sport_name} (${workout.score_state === 'PENDING_SCORE' ? 'Pending' : 'Unscorable'})`);
      return;
    }

    const s = workout.score;
    const start = new Date(workout.start).getTime();
    const end = new Date(workout.end).getTime();
    const durationMs = end - start;

    this.log(`\u{1F3CB}\u{FE0F} Last Workout: ${workout.sport_name} \u2014 Strain ${colorStrain(s.strain, noColor)}`);
    this.log(`   Duration: ${msToHuman(durationMs)} | Avg HR: ${s.average_heart_rate}bpm | Max HR: ${s.max_heart_rate}bpm | ${formatNumber(kjToKcal(s.kilojoule))} kcal`);
  }
}
