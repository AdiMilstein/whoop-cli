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

import RecoveryList from '../../../../src/commands/recovery/index.js';
import {paginate} from '../../../../src/lib/pagination.js';
import {makeRecovery, makePendingRecovery, makeUnscorableRecovery} from '../../../helpers/fixtures.js';

describe('recovery list', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new RecoveryList(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored recovery rows in table format', async () => {
    const recovery = makeRecovery();
    vi.mocked(paginate).mockResolvedValue([recovery]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('2024-06-15');
    expect(text).toContain('78%');
    expect(text).toContain('45.2');
    expect(text).toContain('52.0');
    expect(text).toContain('97.1');
    expect(text).toContain('33.4');
  });

  it('should display pending recovery with dashes', async () => {
    const pending = makePendingRecovery();
    vi.mocked(paginate).mockResolvedValue([pending]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(Pending)');
    // All score fields should show em-dash
    const dashCount = (text.match(/\u2014/g) || []).length;
    expect(dashCount).toBeGreaterThanOrEqual(4);
  });

  it('should display unscorable recovery with dashes', async () => {
    const unscorable = makeUnscorableRecovery();
    vi.mocked(paginate).mockResolvedValue([unscorable]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(Unscorable)');
  });

  it('should output recovery scores in quiet mode', async () => {
    const recovery = makeRecovery();
    vi.mocked(paginate).mockResolvedValue([recovery]);

    const output = await runCommand(['--quiet', '--no-color']);
    const text = output.join('\n');

    // quiet mode outputs the quietKey which is 'recovery' -> the recovery score value
    expect(text).toContain('78%');
  });

  it('should handle empty results', async () => {
    vi.mocked(paginate).mockResolvedValue([]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('No data found.');
  });
});
