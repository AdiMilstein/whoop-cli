import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';

// Mock modules BEFORE importing the command
vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => ({access_token: 'test-token', expires_at: Date.now() + 3_600_000})),
  getValidToken: vi.fn(async () => 'test-token'),
  resetAuthCache: vi.fn(),
}));
vi.mock('../../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(() => ({})),
  resetConfigCache: vi.fn(),
}));

const mockApi = {
  getCycleRecovery: vi.fn(),
};
vi.mock('../../../../src/lib/api.js', () => ({
  getApi: vi.fn(() => mockApi),
  WhoopApiError: class WhoopApiError extends Error {
    constructor(message: string, public statusCode: number, public retryAfter?: number) {
      super(message); this.name = 'WhoopApiError';
    }
  },
  resetApi: vi.fn(),
}));

import RecoveryGet from '../../../../src/commands/recovery/get.js';
import {makeRecovery, makePendingRecovery, makeUnscorableRecovery} from '../../../helpers/fixtures.js';

describe('recovery get', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new RecoveryGet(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored recovery detail with emoji', async () => {
    const recovery = makeRecovery();
    mockApi.getCycleRecovery.mockResolvedValue(recovery);

    const output = await runCommand(['10001', '--no-color']);
    const text = output.join('\n');

    // Score is 78%, which is green (>= 67), emoji should be green circle
    expect(text).toContain('Recovery: 78%');
    expect(text).toContain('HRV: 45.2ms');
    expect(text).toContain('RHR: 52.0bpm');
    expect(text).toContain('SpO2: 97.1%');
    expect(text).toContain('Skin Temp: 33.4');
    expect(mockApi.getCycleRecovery).toHaveBeenCalledWith(10001);
  });

  it('should display pending recovery', async () => {
    const pending = makePendingRecovery();
    mockApi.getCycleRecovery.mockResolvedValue(pending);

    const output = await runCommand(['10001', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Recovery: (Pending)');
  });

  it('should display unscorable recovery', async () => {
    const unscorable = makeUnscorableRecovery();
    mockApi.getCycleRecovery.mockResolvedValue(unscorable);

    const output = await runCommand(['10001', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Recovery: (Unscorable)');
  });

  it('should output JSON format', async () => {
    const recovery = makeRecovery();
    mockApi.getCycleRecovery.mockResolvedValue(recovery);

    const output = await runCommand(['10001', '--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.cycle_id).toBe(10001);
    expect(parsed.score_state).toBe('SCORED');
    expect(parsed.score.recovery_score).toBe(78);
  });

  it('should output CSV format', async () => {
    const recovery = makeRecovery();
    mockApi.getCycleRecovery.mockResolvedValue(recovery);

    const output = await runCommand(['10001', '--csv']);
    const text = output.join('\n');

    // CSV header
    expect(text).toContain('Date,Cycle ID,Recovery');
    // CSV data row
    expect(text).toContain('2024-06-15');
    expect(text).toContain('10001');
    expect(text).toContain('78%');
  });
});
