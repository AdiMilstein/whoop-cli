import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';
import {setConfigValue} from '../../../../src/lib/config.js';

vi.mock('../../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => null),
  getValidToken: vi.fn(async () => 'test-token'),
  resetAuthCache: vi.fn(),
}));

vi.mock('../../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(() => ({})),
  setConfigValue: vi.fn(),
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

import ConfigSet from '../../../../src/commands/config/set.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('ConfigSet', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new ConfigSet(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('sets a valid config value', async () => {
    const output = await runCommand(['units', 'imperial', '--no-color']);
    const joined = output.join('\n');

    expect(setConfigValue).toHaveBeenCalledWith('units', 'imperial');
    expect(joined).toContain('Set units = imperial');
  });

  it('masks client_secret value in output', async () => {
    const output = await runCommand(['client_secret', 'super-secret-value', '--no-color']);
    const joined = output.join('\n');

    expect(setConfigValue).toHaveBeenCalledWith('client_secret', 'super-secret-value');
    expect(joined).toContain('********');
    expect(joined).not.toContain('super-secret-value');
  });

  it('throws on invalid value from setConfigValue', async () => {
    vi.mocked(setConfigValue).mockImplementation(() => {
      throw new Error('Invalid value for units: "bad". Must be "metric" or "imperial".');
    });

    await expect(runCommand(['units', 'bad'])).rejects.toThrow('Invalid value for units');
  });
});
