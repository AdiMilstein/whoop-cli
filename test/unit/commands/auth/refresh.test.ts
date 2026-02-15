import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';
import {loadAuth, refreshToken} from '../../../../src/lib/auth.js';

vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => ({
    access_token: 'test-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3_600_000,
  })),
  refreshToken: vi.fn(),
  getValidToken: vi.fn(async () => 'test-token'),
  resetAuthCache: vi.fn(),
}));

vi.mock('../../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(() => ({})),
  resetConfigCache: vi.fn(),
}));

const mockApi = {};

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

import AuthRefresh from '../../../../src/commands/auth/refresh.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('AuthRefresh', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new AuthRefresh(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('shows "Token refreshed" on success', async () => {
    vi.mocked(loadAuth).mockReturnValue({
      access_token: 'test-token',
      refresh_token: 'test-refresh-token',
      expires_at: Date.now() + 3_600_000,
    });
    vi.mocked(refreshToken).mockResolvedValue({
      access_token: 'new-token',
      refresh_token: 'new-refresh-token',
      expires_at: Date.now() + 7_200_000,
    });

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('Token refreshed');
  });

  it('errors when not authenticated', async () => {
    vi.mocked(loadAuth).mockReturnValue(null);

    await expect(runCommand([])).rejects.toThrow('Not authenticated');
  });

  it('errors when no refresh token is available', async () => {
    vi.mocked(loadAuth).mockReturnValue({
      access_token: 'test-token',
      expires_at: Date.now() + 3_600_000,
      // no refresh_token
    });

    await expect(runCommand([])).rejects.toThrow('refresh token');
  });
});
