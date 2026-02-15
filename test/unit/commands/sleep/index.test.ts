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
vi.mock('../../../../src/lib/pagination.js', () => ({
  paginate: vi.fn(),
  parseDate: vi.fn((d: string) => d),
}));
vi.mock('../../../../src/lib/api.js', () => ({
  getApi: vi.fn(() => ({})),
  WhoopApiError: class WhoopApiError extends Error {
    constructor(message: string, public statusCode: number, public retryAfter?: number) {
      super(message); this.name = 'WhoopApiError';
    }
  },
  resetApi: vi.fn(),
}));

import SleepList from '../../../../src/commands/sleep/index.js';
import {paginate} from '../../../../src/lib/pagination.js';
import {makeSleep, makePendingSleep, makeUnscorableSleep} from '../../../helpers/fixtures.js';

describe('sleep list', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new SleepList(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored sleep rows with duration and nap flag', async () => {
    const sleep = makeSleep();
    vi.mocked(paginate).mockResolvedValue([sleep]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('2024-06-14');
    // totalSleepTimeMs = light(11520000) + sws(6480000) + rem(7500000) = 25500000 ms = 7h 05m
    expect(text).toContain('7h 05m');
    // Performance: 94%
    expect(text).toContain('94%');
    // Efficiency: 91.7%
    expect(text).toContain('91.7%');
    // Nap: No
    expect(text).toContain('No');
  });

  it('should show nap flag as Yes for nap sleep', async () => {
    const napSleep = makeSleep({nap: true});
    vi.mocked(paginate).mockResolvedValue([napSleep]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Yes');
  });

  it('should display pending sleep with dashes', async () => {
    const pending = makePendingSleep();
    vi.mocked(paginate).mockResolvedValue([pending]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(Pending)');
  });

  it('should display unscorable sleep', async () => {
    const unscorable = makeUnscorableSleep();
    vi.mocked(paginate).mockResolvedValue([unscorable]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(Unscorable)');
  });

  it('should handle pagination with multiple records', async () => {
    const sleep1 = makeSleep();
    const sleep2 = makeSleep({
      id: 'second-sleep-id',
      start: '2024-06-13T23:00:00.000Z',
      end: '2024-06-14T06:00:00.000Z',
    });
    vi.mocked(paginate).mockResolvedValue([sleep1, sleep2]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('2024-06-14');
    expect(text).toContain('2024-06-13');
  });
});
