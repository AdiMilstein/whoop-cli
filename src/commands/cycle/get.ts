import {Args} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';
import {colorStrain} from '../../lib/formatter.js';
import {kjToKcal, formatNumber} from '../../lib/units.js';

export default class CycleGet extends BaseCommand {
  static override description = 'Get a specific cycle';

  static override examples = [
    '<%= config.bin %> cycle get 12345',
  ];

  static override args = {
    cycleId: Args.integer({description: 'Cycle ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(CycleGet);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);

    const cycle = await this.api.getCycle(args.cycleId);

    if (format === 'json') {
      this.log(JSON.stringify(cycle, null, 2));
      return;
    }

    if (format === 'csv') {
      let row: Record<string, unknown>;
      if (cycle.score_state === 'SCORED' && cycle.score) {
        row = {
          id: cycle.id,
          start: cycle.start,
          end: cycle.end ?? '(active)',
          strain: cycle.score.strain.toFixed(1),
          calories: formatNumber(kjToKcal(cycle.score.kilojoule)),
          avgHr: cycle.score.average_heart_rate,
          maxHr: cycle.score.max_heart_rate,
          state: cycle.score_state,
        };
      } else {
        row = {
          id: cycle.id,
          start: cycle.start,
          end: cycle.end ?? '(active)',
          strain: '—',
          calories: '—',
          avgHr: '—',
          maxHr: '—',
          state: cycle.score_state,
        };
      }

      this.printFormatted(
        [row],
        [
          {key: 'id', header: 'ID'},
          {key: 'start', header: 'Start'},
          {key: 'end', header: 'End'},
          {key: 'strain', header: 'Strain'},
          {key: 'calories', header: 'Calories'},
          {key: 'avgHr', header: 'Avg HR'},
          {key: 'maxHr', header: 'Max HR'},
          {key: 'state', header: 'State'},
        ],
        {format, noColor},
      );
      return;
    }

    if (cycle.score_state !== 'SCORED' || !cycle.score) {
      this.log(`Cycle ${cycle.id}: (${cycle.score_state === 'PENDING_SCORE' ? 'Pending' : 'Unscorable'})`);
      this.log(`  Start: ${cycle.start}`);
      this.log(`  End:   ${cycle.end ?? '(active — current cycle)'}`);
      return;
    }

    const s = cycle.score;
    this.log(`Cycle ${cycle.id}`);
    this.log(`  Start:    ${cycle.start}`);
    this.log(`  End:      ${cycle.end ?? '(active — current cycle)'}`);
    this.log(`  Strain:   ${colorStrain(s.strain, noColor)} / 21`);
    this.log(`  Calories: ${formatNumber(kjToKcal(s.kilojoule))} kcal`);
    this.log(`  Avg HR:   ${s.average_heart_rate} bpm`);
    this.log(`  Max HR:   ${s.max_heart_rate} bpm`);
  }
}
