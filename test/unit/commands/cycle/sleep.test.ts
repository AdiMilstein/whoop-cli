import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';

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
  getCycleSleep: vi.fn(),
};

vi.mock('../../../../src/lib/api.js', () => ({
  getApi: vi.fn(() => mockApi),
  WhoopApiError: class WhoopApiError extends Error {
    constructor(message: string, public statusCode: number, public retryAfter?: number) {
      super(message);
      this.name = 'WhoopApiError';
    }
  },
  resetApi: vi.fn(),
}));

import CycleSleep from '../../../../src/commands/cycle/sleep.js';
import {makeSleep} from '../../../helpers/fixtures.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('CycleSleep', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new CycleSleep(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    // Bypass init() — set required properties directly
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('outputs JSON when --json flag is used', async () => {
    const sleep = makeSleep();
    mockApi.getCycleSleep.mockResolvedValue(sleep);

    const output = await runCommand(['10001', '--json']);

    expect(mockApi.getCycleSleep).toHaveBeenCalledWith(10001);
    const parsed = JSON.parse(output.join('\n'));
    expect(parsed.id).toBe(sleep.id);
    expect(parsed.cycle_id).toBe(sleep.cycle_id);
    expect(parsed.score_state).toBe('SCORED');
  });

  it('delegates to SleepGet for table display', async () => {
    const sleep = makeSleep();
    mockApi.getCycleSleep.mockResolvedValue(sleep);

    // Table output is delegated to a new SleepGet instance whose log
    // is not captured by our stub, so we verify the API call succeeds
    // and the command completes without error.
    await runCommand(['10001', '--no-color']);

    expect(mockApi.getCycleSleep).toHaveBeenCalledWith(10001);
  });

  it('passes cycleId as integer argument', async () => {
    const sleep = makeSleep();
    mockApi.getCycleSleep.mockResolvedValue(sleep);

    await runCommand(['99999', '--json']);

    expect(mockApi.getCycleSleep).toHaveBeenCalledWith(99999);
  });
});
