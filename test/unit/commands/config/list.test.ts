import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';
import {loadConfig} from '../../../../src/lib/config.js';

vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => null),
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

import ConfigList from '../../../../src/commands/config/list.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('ConfigList', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new ConfigList(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('masks client_secret in JSON output', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      units: 'metric',
      client_id: 'my-client-id',
      client_secret: 'super-secret',
    });

    const output = await runCommand(['--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.client_secret).toBe('********');
    expect(parsed.client_id).toBe('my-client-id');
    expect(parsed.units).toBe('metric');
  });

  it('shows config entries in table output', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      units: 'imperial',
      default_format: 'json',
    });

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('units');
    expect(joined).toContain('imperial');
    expect(joined).toContain('default_format');
    expect(joined).toContain('json');
  });

  it('shows defaults when no config is set', async () => {
    vi.mocked(loadConfig).mockReturnValue({});

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('(default: metric)');
    expect(joined).toContain('(default: table)');
    expect(joined).toContain('(not set)');
  });

  it('masks secret in table output and shows other values', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      client_secret: 'real-secret',
      client_id: 'my-id',
    });

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    expect(joined).toContain('********');
    expect(joined).not.toContain('real-secret');
    expect(joined).toContain('my-id');
  });
});
