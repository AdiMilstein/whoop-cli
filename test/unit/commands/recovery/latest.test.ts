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
  listRecoveries: vi.fn(),
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

import RecoveryLatest from '../../../../src/commands/recovery/latest.js';
import {makeRecovery, makePendingRecovery, paginated} from '../../../helpers/fixtures.js';

describe('recovery latest', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new RecoveryLatest(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display no data message when no recoveries exist', async () => {
    mockApi.listRecoveries.mockResolvedValue(paginated([]));

    const output = await runCommand();
    const text = output.join('\n');

    expect(text).toContain('No recovery data found.');
    expect(mockApi.listRecoveries).toHaveBeenCalledWith({limit: 1});
  });

  it('should output recovery score number in quiet mode', async () => {
    const recovery = makeRecovery();
    mockApi.listRecoveries.mockResolvedValue(paginated([recovery]));

    const output = await runCommand(['--quiet']);
    const text = output.join('\n');

    // quiet mode outputs Math.round(recovery_score) = 78
    expect(text).toBe('78');
  });

  it('should output score_state in quiet mode for pending recovery', async () => {
    const pending = makePendingRecovery();
    mockApi.listRecoveries.mockResolvedValue(paginated([pending]));

    const output = await runCommand(['--quiet']);
    const text = output.join('\n');

    expect(text).toBe('PENDING_SCORE');
  });

  it('should display scored recovery in CSV format (delegates to RecoveryGet)', async () => {
    const recovery = makeRecovery();
    mockApi.listRecoveries.mockResolvedValue(paginated([recovery]));

    const output = await runCommand(['--csv']);
    const text = output.join('\n');

    // CSV uses this.printFormatted which calls this.log on the original command
    expect(text).toContain('Date,Cycle ID,Recovery');
    expect(text).toContain('2024-06-15');
    expect(text).toContain('78%');
  });

  it('should output JSON format', async () => {
    const recovery = makeRecovery();
    mockApi.listRecoveries.mockResolvedValue(paginated([recovery]));

    const output = await runCommand(['--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.cycle_id).toBe(10001);
    expect(parsed.score.recovery_score).toBe(78);
  });
});
