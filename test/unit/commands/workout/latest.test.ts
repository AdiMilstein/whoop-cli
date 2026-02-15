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
  listWorkouts: vi.fn(),
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

import WorkoutLatest from '../../../../src/commands/workout/latest.js';
import {makeWorkout, makePendingWorkout, paginated} from '../../../helpers/fixtures.js';

describe('workout latest', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new WorkoutLatest(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display no data message when no workouts exist', async () => {
    mockApi.listWorkouts.mockResolvedValue(paginated([]));

    const output = await runCommand();
    const text = output.join('\n');

    expect(text).toContain('No workout data found.');
    expect(mockApi.listWorkouts).toHaveBeenCalledWith({limit: 1});
  });

  it('should output strain value in quiet mode', async () => {
    const workout = makeWorkout();
    mockApi.listWorkouts.mockResolvedValue(paginated([workout]));

    const output = await runCommand(['--quiet']);
    const text = output.join('\n');

    // quiet mode outputs strain.toFixed(1) = "14.2"
    expect(text).toBe('14.2');
  });

  it('should output score_state in quiet mode for pending workout', async () => {
    const pending = makePendingWorkout();
    mockApi.listWorkouts.mockResolvedValue(paginated([pending]));

    const output = await runCommand(['--quiet']);
    const text = output.join('\n');

    expect(text).toBe('PENDING_SCORE');
  });

  it('should display scored workout in CSV format (delegates to WorkoutGet)', async () => {
    const workout = makeWorkout();
    mockApi.listWorkouts.mockResolvedValue(paginated([workout]));

    const output = await runCommand(['--csv']);
    const text = output.join('\n');

    // CSV uses this.printFormatted which calls this.log on the original command
    expect(text).toContain('Date,Workout ID,Sport');
    expect(text).toContain('Running');
    expect(text).toContain('14.2');
  });
});
