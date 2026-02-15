import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';
import {loadAuth, clearAuth} from '../../../../src/lib/auth.js';
import {WhoopApiError} from '../../../../src/lib/api.js';

vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => ({access_token: 'test-token', expires_at: Date.now() + 3_600_000})),
  clearAuth: vi.fn(),
  getValidToken: vi.fn(async () => 'test-token'),
  resetAuthCache: vi.fn(),
}));

vi.mock('../../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(() => ({})),
  resetConfigCache: vi.fn(),
}));

const mockApi = {
  revokeAccess: vi.fn(),
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

import AuthLogout from '../../../../src/commands/auth/logout.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('AuthLogout', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new AuthLogout(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('revokes token and clears auth on success', async () => {
    vi.mocked(loadAuth).mockReturnValue({access_token: 'test-token', expires_at: Date.now() + 3_600_000});
    mockApi.revokeAccess.mockResolvedValue(undefined);

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('Revoked WHOOP access token');
    expect(clearAuth).toHaveBeenCalled();
  });

  it('shows "Not currently authenticated." when no auth data', async () => {
    vi.mocked(loadAuth).mockReturnValue(null);

    const output = await runCommand([]);
    const joined = output.join('\n');

    expect(joined).toContain('Not currently authenticated.');
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it('shows network error message for WhoopApiError with statusCode 0', async () => {
    vi.mocked(loadAuth).mockReturnValue({access_token: 'test-token', expires_at: Date.now() + 3_600_000});
    mockApi.revokeAccess.mockRejectedValue(new WhoopApiError('Network error', 0));

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('Could not reach WHOOP API to revoke token');
    expect(joined).toContain('Local credentials will still be cleared');
    // Still clears local auth
    expect(clearAuth).toHaveBeenCalled();
  });
});
