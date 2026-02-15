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

import CycleList from '../../../../src/commands/cycle/index.js';
import {paginate} from '../../../../src/lib/pagination.js';
import {makeCycle, makeActiveCycle, makePendingCycle} from '../../../helpers/fixtures.js';

describe('cycle list', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new CycleList(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored cycle rows', async () => {
    const cycle = makeCycle();
    vi.mocked(paginate).mockResolvedValue([cycle]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('10001');
    expect(text).toContain('2024-06-15');
    expect(text).toContain('2024-06-16');
    expect(text).toContain('12.4');
    expect(text).toContain('72');
    expect(text).toContain('168');
    expect(text).toContain('Complete');
  });

  it('should display active cycle with no end date', async () => {
    const active = makeActiveCycle();
    vi.mocked(paginate).mockResolvedValue([active]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(active)');
    expect(text).toContain('Active');
  });

  it('should display pending cycle', async () => {
    const pending = makePendingCycle();
    vi.mocked(paginate).mockResolvedValue([pending]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(Pending)');
    expect(text).toContain('Pending');
  });

  it('should handle empty results', async () => {
    vi.mocked(paginate).mockResolvedValue([]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('No data found.');
  });
});
