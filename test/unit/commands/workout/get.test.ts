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
  getWorkout: vi.fn(),
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

import WorkoutGet from '../../../../src/commands/workout/get.js';
import {makeWorkout, makePendingWorkout, makeWorkoutScore} from '../../../helpers/fixtures.js';

describe('workout get', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new WorkoutGet(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored workout detail with HR zones', async () => {
    const workout = makeWorkout();
    mockApi.getWorkout.mockResolvedValue(workout);

    const output = await runCommand(['c3d4e5f6-a7b8-9012-cdef-123456789012', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Running');
    expect(text).toContain('Strain 14.2');
    expect(text).toContain('Duration: 48m 00s');
    expect(text).toContain('Avg HR: 142bpm');
    expect(text).toContain('Max HR: 171bpm');
    // HR zones should be rendered
    expect(text).toContain('Heart Rate Zones:');
    expect(text).toContain('Zone 0 (Rest)');
    expect(text).toContain('Zone 1 (Light)');
    expect(text).toContain('Zone 2 (Mod.)');
    expect(text).toContain('Zone 3 (Hard)');
    expect(text).toContain('Zone 4 (V.Hard)');
    expect(text).toContain('Zone 5 (Max)');
    expect(mockApi.getWorkout).toHaveBeenCalledWith('c3d4e5f6-a7b8-9012-cdef-123456789012');
  });

  it('should display distance in metric by default', async () => {
    const workout = makeWorkout();
    mockApi.getWorkout.mockResolvedValue(workout);

    const output = await runCommand(['workout-id', '--no-color']);
    const text = output.join('\n');

    // 8047m = 8.05 km
    expect(text).toContain('8.05 km');
  });

  it('should display distance in imperial units', async () => {
    const workout = makeWorkout();
    mockApi.getWorkout.mockResolvedValue(workout);

    const output = await runCommand(['workout-id', '--no-color', '--units', 'imperial']);
    const text = output.join('\n');

    // 8047m = ~5.0 mi
    expect(text).toContain('mi');
  });

  it('should display elevation gain using metersToFeet for imperial', async () => {
    const workout = makeWorkout({
      score: makeWorkoutScore({altitude_gain_meter: 150}),
    });
    mockApi.getWorkout.mockResolvedValue(workout);

    const output = await runCommand(['workout-id', '--no-color', '--units', 'imperial']);
    const text = output.join('\n');

    // 150m * 3.28084 = ~492ft
    expect(text).toContain('492ft');
    expect(text).toContain('Elevation gain:');
  });

  it('should display pending workout', async () => {
    const pending = makePendingWorkout();
    mockApi.getWorkout.mockResolvedValue(pending);

    const output = await runCommand(['workout-id', '--no-color']);
    const text = output.join('\n');

    expect(text).toContain('Running (Pending)');
  });
});
