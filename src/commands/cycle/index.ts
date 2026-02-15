import {BaseListCommand} from '../../lib/base-list-command.js';
import {colorStrain} from '../../lib/formatter.js';
import {kjToKcal, formatNumber} from '../../lib/units.js';
import type {Column} from '../../lib/formatter.js';
import type {PaginatedResponse, ListParams, Cycle} from '../../lib/types.js';

export default class CycleList extends BaseListCommand {
  static override description = 'List physiological cycles';

  static override examples = [
    '<%= config.bin %> cycle',
    '<%= config.bin %> cycle --limit 20',
    '<%= config.bin %> cycle --start 7d --json',
  ];

  static override flags = {
    ...BaseListCommand.baseFlags,
  };

  protected async fetchPage(params: ListParams): Promise<PaginatedResponse<unknown>> {
    return this.api.listCycles(params);
  }

  protected getColumns(): Column[] {
    return [
      {key: 'id', header: 'ID'},
      {key: 'start', header: 'Start'},
      {key: 'end', header: 'End'},
      {key: 'strain', header: 'Strain'},
      {key: 'calories', header: 'Calories'},
      {key: 'avgHr', header: 'Avg HR'},
      {key: 'maxHr', header: 'Max HR'},
      {key: 'status', header: 'Status'},
    ];
  }

  protected mapToRow(record: unknown, _units: 'metric' | 'imperial', noColor: boolean): Record<string, unknown> {
    const c = record as Cycle;

    if (c.score_state === 'PENDING_SCORE') {
      return {id: c.id, start: c.start.split('T')[0], end: c.end?.split('T')[0] ?? '(active)', strain: '(Pending)', calories: '—', avgHr: '—', maxHr: '—', status: 'Pending'};
    }

    if (c.score_state === 'UNSCORABLE') {
      return {id: c.id, start: c.start.split('T')[0], end: c.end?.split('T')[0] ?? '(active)', strain: '(Unscorable)', calories: '—', avgHr: '—', maxHr: '—', status: 'Unscorable'};
    }

    const s = c.score!;
    return {
      id: c.id,
      start: c.start.split('T')[0],
      end: c.end?.split('T')[0] ?? '(active)',
      strain: colorStrain(s.strain, noColor),
      calories: formatNumber(kjToKcal(s.kilojoule)),
      avgHr: `${s.average_heart_rate}`,
      maxHr: `${s.max_heart_rate}`,
      status: c.end ? 'Complete' : 'Active',
    };
  }

  protected getQuietKey(): string {
    return 'strain';
  }
}
