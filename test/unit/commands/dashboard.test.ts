import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Config} from '@oclif/core';

vi.mock('../../../src/lib/auth.js', () => ({
  loadAuth: vi.fn(() => ({access_token: 'test-token', expires_at: Date.now() + 3_600_000})),
  getValidToken: vi.fn(async () => 'test-token'),
  resetAuthCache: vi.fn(),
}));

vi.mock('../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(() => ({})),
  resetConfigCache: vi.fn(),
}));

const mockApi = {
  listCycles: vi.fn(),
  getCycleRecovery: vi.fn(),
  listSleeps: vi.fn(),
  listWorkouts: vi.fn(),
};

vi.mock('../../../src/lib/api.js', () => ({
  getApi: vi.fn(() => mockApi),
  WhoopApiError: class WhoopApiError extends Error {
    constructor(message: string, public statusCode: number, public retryAfter?: number) {
      super(message);
      this.name = 'WhoopApiError';
    }
  },
  resetApi: vi.fn(),
}));

import Dashboard from '../../../src/commands/dashboard.js';
import {makeCycle, makeRecovery, makeSleep, makeWorkout, paginated} from '../../helpers/fixtures.js';

const stubConfig = {runHook: vi.fn(async () => ({successes: []}))} as unknown as Config;

describe('Dashboard', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new Dashboard(argv, stubConfig);
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    (cmd as any).cliConfig = {};
    (cmd as any).api = mockApi;
    await cmd.run();
    return stdout;
  }

  function setupAllMocks() {
    const cycle = makeCycle();
    const recovery = makeRecovery();
    const sleep = makeSleep();
    const workout = makeWorkout();

    mockApi.listCycles.mockResolvedValue(paginated([cycle]));
    mockApi.getCycleRecovery.mockResolvedValue(recovery);
    mockApi.listSleeps.mockResolvedValue(paginated([sleep]));
    mockApi.listWorkouts.mockResolvedValue(paginated([workout]));

    return {cycle, recovery, sleep, workout};
  }

  it('displays all four sections in table mode', async () => {
    setupAllMocks();

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    // Recovery section
    expect(joined).toContain('Recovery:');
    // Strain section
    expect(joined).toContain('Strain:');
    // Sleep section
    expect(joined).toContain('Sleep:');
    // Workout section
    expect(joined).toContain('Workout:');
  });

  it('outputs JSON with cycle, recovery, sleep, and workout', async () => {
    const {cycle, recovery, sleep, workout} = setupAllMocks();

    const output = await runCommand(['--json']);
    const parsed = JSON.parse(output.join('\n'));

    expect(parsed.cycle.id).toBe(cycle.id);
    expect(parsed.recovery.cycle_id).toBe(recovery.cycle_id);
    expect(parsed.sleep.id).toBe(sleep.id);
    expect(parsed.workout.id).toBe(workout.id);
  });

  it('handles partial API failures gracefully', async () => {
    const cycle = makeCycle();
    const sleep = makeSleep();
    const workout = makeWorkout();

    mockApi.listCycles.mockResolvedValue(paginated([cycle]));
    mockApi.getCycleRecovery.mockRejectedValue(new Error('recovery failed'));
    mockApi.listSleeps.mockResolvedValue(paginated([sleep]));
    mockApi.listWorkouts.mockResolvedValue(paginated([workout]));

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const output = await runCommand(['--no-color']);
    const joined = output.join('\n');

    // Stderr warning about failed recovery
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('recovery'),
    );

    // Other sections still display
    expect(joined).toContain('Sleep:');
    expect(joined).toContain('Workout:');

    stderrSpy.mockRestore();
  });

  it('shows "No cycle data found" when no cycles exist', async () => {
    mockApi.listCycles.mockResolvedValue(paginated([]));

    const output = await runCommand([]);
    expect(output.join('\n')).toContain('No cycle data found');
  });
});
