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
  getCycle: vi.fn(),
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

import CycleGet from '../../../../src/commands/cycle/get.js';
import {makeCycle, makePendingCycle, makeActiveCycle} from '../../../helpers/fixtures.js';

describe('cycle get', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new CycleGet(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored cycle detail', async () => {
    const cycle = makeCycle();
    mockApi.getCycle.mockResolvedValue(cycle);

    const output = await runCommand(['10001', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Cycle 10001');
    expect(text).toContain('Start:');
    expect(text).toContain('2024-06-15T04:00:00.000Z');
    expect(text).toContain('End:');
    expect(text).toContain('2024-06-16T04:00:00.000Z');
    expect(text).toContain('Strain:');
    expect(text).toContain('12.4');
    expect(text).toContain('/ 21');
    expect(text).toContain('Calories:');
    expect(text).toContain('kcal');
    expect(text).toContain('Avg HR:');
    expect(text).toContain('72 bpm');
    expect(text).toContain('Max HR:');
    expect(text).toContain('168 bpm');
    expect(mockApi.getCycle).toHaveBeenCalledWith(10001);
  });

  it('should display pending/unscorable cycle', async () => {
    const pending = makePendingCycle();
    mockApi.getCycle.mockResolvedValue(pending);

    const output = await runCommand(['10001', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Cycle 10001: (Pending)');
    expect(text).toContain('Start:');
    expect(text).toContain('End:');
  });

  it('should display active cycle with no end date', async () => {
    const active = makeActiveCycle();
    mockApi.getCycle.mockResolvedValue(active);

    const output = await runCommand(['10001', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(active');
  });

  it('should output CSV format for scored cycle', async () => {
    const cycle = makeCycle();
    mockApi.getCycle.mockResolvedValue(cycle);

    const output = await runCommand(['10001', '--csv']);
    const text = output.join('\n');

    // CSV header
    expect(text).toContain('ID,Start,End,Strain,Calories,Avg HR,Max HR,State');
    // CSV data row
    expect(text).toContain('10001');
    expect(text).toContain('12.4');
    expect(text).toContain('SCORED');
  });

  it('should output JSON format', async () => {
    const cycle = makeCycle();
    mockApi.getCycle.mockResolvedValue(cycle);

    const output = await runCommand(['10001', '--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.id).toBe(10001);
    expect(parsed.score_state).toBe('SCORED');
    expect(parsed.score.strain).toBe(12.4);
  });
});
