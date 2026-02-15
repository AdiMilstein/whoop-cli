import {BaseListCommand} from '../../lib/base-list-command.js';
import {colorSleepPerformance} from '../../lib/formatter.js';
import {msToHuman, formatPercent} from '../../lib/units.js';
import type {Column} from '../../lib/formatter.js';
import type {PaginatedResponse, ListParams, Sleep} from '../../lib/types.js';

export default class SleepList extends BaseListCommand {
  static override description = 'List recent sleep sessions';

  static override examples = [
    '<%= config.bin %> sleep',
    '<%= config.bin %> sleep --limit 20',
    '<%= config.bin %> sleep --start 7d --json',
  ];

  static override flags = {
    ...BaseListCommand.baseFlags,
  };

  protected async fetchPage(params: ListParams): Promise<PaginatedResponse<unknown>> {
    return this.api.listSleeps(params);
  }

  protected getColumns(): Column[] {
    return [
      {key: 'date', header: 'Date'},
      {key: 'duration', header: 'Duration'},
      {key: 'performance', header: 'Performance'},
      {key: 'efficiency', header: 'Efficiency'},
      {key: 'light', header: 'Light'},
      {key: 'sws', header: 'SWS'},
      {key: 'rem', header: 'REM'},
      {key: 'awake', header: 'Awake'},
      {key: 'disturbances', header: 'Dist.'},
      {key: 'nap', header: 'Nap?'},
    ];
  }

  protected mapToRow(record: unknown, _units: 'metric' | 'imperial', noColor: boolean): Record<string, unknown> {
    const s = record as Sleep;

    if (s.score_state === 'PENDING_SCORE') {
      return {date: s.start.split('T')[0], duration: '(Pending)', performance: '—', efficiency: '—', light: '—', sws: '—', rem: '—', awake: '—', disturbances: '—', nap: s.nap ? 'Yes' : 'No'};
    }

    if (s.score_state === 'UNSCORABLE') {
      return {date: s.start.split('T')[0], duration: '(Unscorable)', performance: '—', efficiency: '—', light: '—', sws: '—', rem: '—', awake: '—', disturbances: '—', nap: s.nap ? 'Yes' : 'No'};
    }

    const sc = s.score!;
    const stages = sc.stage_summary;
    const totalSleep = stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli;

    return {
      date: s.start.split('T')[0],
      duration: msToHuman(totalSleep),
      performance: sc.sleep_performance_percentage !== undefined
        ? colorSleepPerformance(sc.sleep_performance_percentage, noColor)
        : '—',
      efficiency: formatPercent(sc.sleep_efficiency_percentage),
      light: msToHuman(stages.total_light_sleep_time_milli),
      sws: msToHuman(stages.total_slow_wave_sleep_time_milli),
      rem: msToHuman(stages.total_rem_sleep_time_milli),
      awake: msToHuman(stages.total_awake_time_milli),
      disturbances: stages.disturbance_count,
      nap: s.nap ? 'Yes' : 'No',
    };
  }

  protected getQuietKey(): string {
    return 'performance';
  }
}
