import {Flags} from '@oclif/core';
import {BaseListCommand} from '../../lib/base-list-command.js';
import {colorStrain} from '../../lib/formatter.js';
import {msToHuman, kjToKcal, metersToMiles, metersToKm, formatNumber} from '../../lib/units.js';
import type {Column} from '../../lib/formatter.js';
import type {PaginatedResponse, ListParams, Workout} from '../../lib/types.js';

export default class WorkoutList extends BaseListCommand {
  static override description = 'List recent workouts';

  static override examples = [
    '<%= config.bin %> workout',
    '<%= config.bin %> workout --limit 20',
    '<%= config.bin %> workout --start 30d --csv',
    '<%= config.bin %> workout --sport Running',
  ];

  static override flags = {
    ...BaseListCommand.baseFlags,
    sport: Flags.string({
      description: 'Filter by sport name (client-side)',
    }),
  };

  protected async fetchPage(params: ListParams): Promise<PaginatedResponse<unknown>> {
    return this.api.listWorkouts(params);
  }

  protected getColumns(): Column[] {
    return [
      {key: 'date', header: 'Date'},
      {key: 'sport', header: 'Sport'},
      {key: 'strain', header: 'Strain'},
      {key: 'duration', header: 'Duration'},
      {key: 'avgHr', header: 'Avg HR'},
      {key: 'maxHr', header: 'Max HR'},
      {key: 'calories', header: 'Calories'},
      {key: 'distance', header: 'Distance'},
    ];
  }

  protected mapToRow(record: unknown, units: 'metric' | 'imperial', noColor: boolean): Record<string, unknown> {
    const w = record as Workout;

    if (w.score_state === 'PENDING_SCORE') {
      return {date: w.start.split('T')[0], sport: w.sport_name, strain: '(Pending)', duration: '—', avgHr: '—', maxHr: '—', calories: '—', distance: '—'};
    }

    if (w.score_state === 'UNSCORABLE') {
      return {date: w.start.split('T')[0], sport: w.sport_name, strain: '(Unscorable)', duration: '—', avgHr: '—', maxHr: '—', calories: '—', distance: '—'};
    }

    const s = w.score!;
    const start = new Date(w.start).getTime();
    const end = new Date(w.end).getTime();
    const durationMs = end - start;

    let distance = '—';
    if (s.distance_meter !== undefined) {
      distance = units === 'imperial'
        ? `${metersToMiles(s.distance_meter)} mi`
        : `${metersToKm(s.distance_meter)} km`;
    }

    return {
      date: w.start.split('T')[0],
      sport: w.sport_name,
      strain: colorStrain(s.strain, noColor),
      duration: msToHuman(durationMs),
      avgHr: `${s.average_heart_rate}`,
      maxHr: `${s.max_heart_rate}`,
      calories: formatNumber(kjToKcal(s.kilojoule)),
      distance,
    };
  }

  protected getQuietKey(): string {
    return 'strain';
  }

  protected override applyFilter(records: unknown[], flags: Record<string, unknown>): unknown[] {
    const sport = flags.sport as string | undefined;
    if (!sport) return records;
    return (records as Workout[]).filter((w) =>
      w.sport_name.toLowerCase().includes(sport.toLowerCase()),
    );
  }
}
