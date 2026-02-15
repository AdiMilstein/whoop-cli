import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {Config} from '@oclif/core';
import {loadAuth} from '../../../../src/lib/auth.js';

vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => ({access_token: 'test-token', expires_at: Date.now() + 3_600_000})),
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

import AuthStatus from '../../../../src/commands/auth/status.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('AuthStatus', () => {
  let stdout: string[];
  const originalEnv = process.env.WHOOP_ACCESS_TOKEN;

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
    delete process.env.WHOOP_ACCESS_TOKEN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WHOOP_ACCESS_TOKEN = originalEnv;
    } else {
      delete process.env.WHOOP_ACCESS_TOKEN;
    }
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new AuthStatus(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('shows "Not authenticated" when no auth data exists', async () => {
    vi.mocked(loadAuth).mockReturnValue(null);

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('Not authenticated');
  });

  it('shows WHOOP_ACCESS_TOKEN environment variable source', async () => {
    process.env.WHOOP_ACCESS_TOKEN = 'env-test-token';
    vi.mocked(loadAuth).mockReturnValue({
      access_token: 'env-test-token',
      expires_at: Number.MAX_SAFE_INTEGER,
    });

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('WHOOP_ACCESS_TOKEN environment variable');
  });

  it('shows time remaining for a valid token', async () => {
    vi.mocked(loadAuth).mockReturnValue({
      access_token: 'test-token',
      expires_at: Date.now() + 3_600_000, // 1 hour from now
    });

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('Authenticated');
    expect(joined).toContain('remaining');
  });

  it('shows EXPIRED for an expired token', async () => {
    vi.mocked(loadAuth).mockReturnValue({
      access_token: 'test-token',
      expires_at: Date.now() - 60_000, // 1 minute ago
    });

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('EXPIRED');
  });
});
