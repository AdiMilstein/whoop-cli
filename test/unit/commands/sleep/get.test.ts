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
  getSleep: vi.fn(),
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

import SleepGet from '../../../../src/commands/sleep/get.js';
import {makeSleep, makePendingSleep, makeUnscorableSleep} from '../../../helpers/fixtures.js';

describe('sleep get', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new SleepGet(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored sleep detail with stage breakdown', async () => {
    const sleep = makeSleep();
    mockApi.getSleep.mockResolvedValue(sleep);

    const output = await runCommand(['b2c3d4e5-f6a7-8901-bcde-f12345678901', '--no-color']);
    const text = output.join('\n');

    // Total sleep: light(11520000) + sws(6480000) + rem(7500000) = 25500000 ms = 7h 05m
    expect(text).toContain('Sleep: 7h 05m');
    expect(text).toContain('Performance: 94%');
    // Stage breakdown
    expect(text).toContain('Light: 3h 12m');
    expect(text).toContain('SWS: 1h 48m');
    expect(text).toContain('REM: 2h 05m');
    expect(text).toContain('Awake: 37m');
    // Efficiency and consistency
    expect(text).toContain('Efficiency: 91.7%');
    expect(text).toContain('Consistency: 88.0%');
    expect(text).toContain('Resp Rate: 15.8');
    expect(text).toContain('Disturbances: 3');
    expect(text).toContain('Sleep Cycles: 4');
    expect(mockApi.getSleep).toHaveBeenCalledWith('b2c3d4e5-f6a7-8901-bcde-f12345678901');
  });

  it('should display sleep needed breakdown', async () => {
    const sleep = makeSleep();
    mockApi.getSleep.mockResolvedValue(sleep);

    const output = await runCommand(['b2c3d4e5-f6a7-8901-bcde-f12345678901', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Sleep Needed:');
    // Baseline: 27000000 ms = 7h 30m
    expect(text).toContain('Baseline:');
    expect(text).toContain('7h 30m');
    // Sleep debt: 1800000 ms = 30m
    expect(text).toContain('Sleep debt:');
    expect(text).toContain('30m');
    // Recent strain: 900000 ms = 15m
    expect(text).toContain('Recent strain:');
    expect(text).toContain('15m');
    // Nap reduction: 1800000 ms = 30m (shown because need_from_recent_nap_milli < 0)
    expect(text).toContain('Nap reduction:');
  });

  it('should display pending sleep', async () => {
    const pending = makePendingSleep();
    mockApi.getSleep.mockResolvedValue(pending);

    const output = await runCommand(['test-sleep-id', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Sleep: (Pending)');
  });

  it('should output JSON format', async () => {
    const sleep = makeSleep();
    mockApi.getSleep.mockResolvedValue(sleep);

    const output = await runCommand(['test-sleep-id', '--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.id).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(parsed.score_state).toBe('SCORED');
    expect(parsed.score.sleep_performance_percentage).toBe(94);
  });

  it('should output CSV format', async () => {
    const sleep = makeSleep();
    mockApi.getSleep.mockResolvedValue(sleep);

    const output = await runCommand(['test-sleep-id', '--csv']);
    const text = output.join('\n');

    // CSV header
    expect(text).toContain('Date,Sleep ID,Cycle ID');
    // CSV data
    expect(text).toContain('2024-06-14');
    expect(text).toContain('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    expect(text).toContain('7h 05m');
  });
});
