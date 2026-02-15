import {BaseListCommand} from '../../lib/base-list-command.js';
import {colorRecovery} from '../../lib/formatter.js';
import {formatFloat} from '../../lib/units.js';
import type {Column} from '../../lib/formatter.js';
import type {PaginatedResponse, ListParams, Recovery} from '../../lib/types.js';

export default class RecoveryList extends BaseListCommand {
  static override description = 'List recent recoveries';

  static override examples = [
    '<%= config.bin %> recovery',
    '<%= config.bin %> recovery --limit 20',
    '<%= config.bin %> recovery --start 7d --json',
    '<%= config.bin %> recovery --all --csv',
  ];

  static override flags = {
    ...BaseListCommand.baseFlags,
  };

  protected async fetchPage(params: ListParams): Promise<PaginatedResponse<unknown>> {
    return this.api.listRecoveries(params);
  }

  protected getColumns(): Column[] {
    return [
      {key: 'date', header: 'Date'},
      {key: 'recovery', header: 'Recovery'},
      {key: 'hrv', header: 'HRV (ms)'},
      {key: 'rhr', header: 'RHR (bpm)'},
      {key: 'spo2', header: 'SpO2 (%)'},
      {key: 'skinTemp', header: 'Skin Temp (°C)'},
    ];
  }

  protected mapToRow(record: unknown, _units: 'metric' | 'imperial', noColor: boolean): Record<string, unknown> {
    const r = record as Recovery;

    if (r.score_state === 'PENDING_SCORE') {
      return {date: r.created_at.split('T')[0], recovery: '(Pending)', hrv: '—', rhr: '—', spo2: '—', skinTemp: '—'};
    }

    if (r.score_state === 'UNSCORABLE') {
      return {date: r.created_at.split('T')[0], recovery: '(Unscorable)', hrv: '—', rhr: '—', spo2: '—', skinTemp: '—'};
    }

    const s = r.score!;
    return {
      date: r.created_at.split('T')[0],
      recovery: colorRecovery(s.recovery_score, noColor),
      hrv: formatFloat(s.hrv_rmssd_milli),
      rhr: formatFloat(s.resting_heart_rate),
      spo2: formatFloat(s.spo2_percentage),
      skinTemp: formatFloat(s.skin_temp_celsius),
    };
  }

  protected getQuietKey(): string {
    return 'recovery';
  }
}
