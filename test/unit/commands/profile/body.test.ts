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
  getBodyMeasurement: vi.fn(),
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

import ProfileBody from '../../../../src/commands/profile/body.js';
import {makeBodyMeasurement} from '../../../helpers/fixtures.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('ProfileBody', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new ProfileBody(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  it('displays metric measurements (m, kg)', async () => {
    const body = makeBodyMeasurement();
    mockApi.getBodyMeasurement.mockResolvedValue(body);

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    // Metric values
    expect(joined).toContain('1.83m');
    expect(joined).toContain('90.7kg');
    expect(joined).toContain('200 bpm');
  });

  it('displays imperial measurements (feet/inches, lbs)', async () => {
    const body = makeBodyMeasurement();
    mockApi.getBodyMeasurement.mockResolvedValue(body);

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    // Imperial values shown in parentheses
    expect(joined).toMatch(/6'\d+"/); // feet'inches"
    expect(joined).toMatch(/\d+(\.\d+)?lb/); // weight in lbs
  });

  it('outputs JSON format', async () => {
    const body = makeBodyMeasurement();
    mockApi.getBodyMeasurement.mockResolvedValue(body);

    const output = await runCommand(['--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.height_meter).toBe(1.83);
    expect(parsed.weight_kilogram).toBe(90.7);
    expect(parsed.max_heart_rate).toBe(200);
  });
});
