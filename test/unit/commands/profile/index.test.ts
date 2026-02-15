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
  getProfile: vi.fn(),
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

import Profile from '../../../../src/commands/profile/index.js';
import {makeProfile} from '../../../helpers/fixtures.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('Profile', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new Profile(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('displays table output with Name, Email, and User ID', async () => {
    const profile = makeProfile();
    mockApi.getProfile.mockResolvedValue(profile);

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('John Smith');
    expect(joined).toContain('john@example.com');
    expect(joined).toContain('10129');
  });

  it('outputs JSON format', async () => {
    const profile = makeProfile();
    mockApi.getProfile.mockResolvedValue(profile);

    const output = await runCommand(['--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.user_id).toBe(10129);
    expect(parsed.email).toBe('john@example.com');
    expect(parsed.first_name).toBe('John');
    expect(parsed.last_name).toBe('Smith');
  });

  it('outputs CSV format', async () => {
    const profile = makeProfile();
    mockApi.getProfile.mockResolvedValue(profile);

    const output = await runCommand(['--csv']);
    const joined = output.join('\n');

    // CSV output includes header row and data
    expect(joined).toContain('Name');
    expect(joined).toContain('Email');
    expect(joined).toContain('User ID');
    expect(joined).toContain('John Smith');
    expect(joined).toContain('john@example.com');
  });
});
