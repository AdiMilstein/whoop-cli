import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';
import {saveAuth, clearAuth} from '../../../../src/lib/auth.js';
import {WhoopApiError} from '../../../../src/lib/api.js';

vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => null),
  getValidToken: vi.fn(async () => 'test-token'),
  saveAuth: vi.fn(),
  clearAuth: vi.fn(),
  resetAuthCache: vi.fn(),
}));

vi.mock('../../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(() => ({})),
  resetConfigCache: vi.fn(),
}));

const mockGetProfile = vi.fn();
const mockApiInstance = {
  getProfile: mockGetProfile,
};

vi.mock('../../../../src/lib/api.js', () => ({
  getApi: vi.fn(() => mockApiInstance),
  WhoopApiError: class WhoopApiError extends Error {
    constructor(message: string, public statusCode: number, public retryAfter?: number) {
      super(message);
      this.name = 'WhoopApiError';
    }
  },
  resetApi: vi.fn(),
}));

import AuthToken from '../../../../src/commands/auth/token.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('AuthToken', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new AuthToken(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApiInstance;
    await cmd.run();
    return stdout;
  }

  it('clears auth when token validation returns 401', async () => {
    mockGetProfile.mockRejectedValue(new WhoopApiError('Unauthorized', 401));

    await expect(runCommand(['--access-token', 'bad-token'])).rejects.toThrow('invalid or expired');

    expect(saveAuth).toHaveBeenCalled();
    expect(clearAuth).toHaveBeenCalled();
  });

  it('keeps auth saved when network error occurs (statusCode 0)', async () => {
    mockGetProfile.mockRejectedValue(new WhoopApiError('Network error', 0));

    await expect(runCommand(['--access-token', 'some-token'])).rejects.toThrow('could not reach WHOOP API');

    expect(saveAuth).toHaveBeenCalled();
    // clearAuth should NOT be called for network errors
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it('saves profile data on successful validation', async () => {
    mockGetProfile.mockResolvedValue({
      user_id: 10129,
      first_name: 'John',
      last_name: 'Smith',
      email: 'john@example.com',
    });

    const output = await runCommand(['--access-token', 'valid-token']);
    const joined = output.join('\n');

    expect(joined).toContain('Authenticated as John Smith');
    expect(saveAuth).toHaveBeenCalledTimes(2); // initial save + profile save
  });
});
