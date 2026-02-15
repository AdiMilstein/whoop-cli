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
vi.mock('../../../../src/lib/pagination.js', () => ({
  paginate: vi.fn(),
  parseDate: vi.fn((d: string) => d),
}));
vi.mock('../../../../src/lib/api.js', () => ({
  getApi: vi.fn(() => ({})),
  WhoopApiError: class WhoopApiError extends Error {
    constructor(message: string, public statusCode: number, public retryAfter?: number) {
      super(message); this.name = 'WhoopApiError';
    }
  },
  resetApi: vi.fn(),
}));

import WorkoutList from '../../../../src/commands/workout/index.js';
import {paginate} from '../../../../src/lib/pagination.js';
import {makeWorkout, makePendingWorkout, makeWorkoutWithoutDistance} from '../../../helpers/fixtures.js';

describe('workout list', () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    vi.clearAllMocks();
  });

  function makeConfig(): Config {
    return {runHook: vi.fn().mockResolvedValue({successes: []})} as unknown as Config;
  }

  async function runCommand(argv: string[] = []): Promise<string[]> {
    const cmd = new WorkoutList(argv, makeConfig());
    cmd.log = (msg?: string) => { stdout.push(msg ?? ''); };
    cmd.error = ((msg: string) => { throw new Error(msg); }) as any;
    await cmd.init();
    await cmd.run();
    return stdout;
  }

  it('should display scored workout rows with metric distance', async () => {
    const workout = makeWorkout();
    vi.mocked(paginate).mockResolvedValue([workout]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('2024-06-15');
    expect(text).toContain('Running');
    expect(text).toContain('14.2');
    // Duration: end - start = 48min = 48m 00s
    expect(text).toContain('48m 00s');
    expect(text).toContain('142');
    expect(text).toContain('171');
    // Distance: 8047m in km = 8.05 km
    expect(text).toContain('8.05 km');
  });

  it('should display distance in imperial units', async () => {
    const workout = makeWorkout();
    vi.mocked(paginate).mockResolvedValue([workout]);

    const output = await runCommand(['--no-color', '--units', 'imperial']);
    const text = output.join('\n');

    // Distance: 8047m in miles = ~5.0 mi
    expect(text).toContain('5 mi');
  });

  it('should filter workouts by sport name', async () => {
    const running = makeWorkout({sport_name: 'Running'});
    const cycling = makeWorkout({
      id: 'cycling-id',
      sport_name: 'Cycling',
      start: '2024-06-15T19:00:00.000Z',
      end: '2024-06-15T20:00:00.000Z',
    });
    vi.mocked(paginate).mockResolvedValue([running, cycling]);

    const output = await runCommand(['--no-color', '--sport', 'Running']);
    const text = output.join('\n');

    expect(text).toContain('Running');
    expect(text).not.toContain('Cycling');
  });

  it('should display pending workout', async () => {
    const pending = makePendingWorkout();
    vi.mocked(paginate).mockResolvedValue([pending]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    expect(text).toContain('(Pending)');
  });

  it('should display dash for workouts without distance', async () => {
    const workout = makeWorkoutWithoutDistance();
    vi.mocked(paginate).mockResolvedValue([workout]);

    const output = await runCommand(['--no-color']);
    const text = output.join('\n');

    // Distance column should contain em-dash when undefined
    expect(text).not.toContain('km');
    expect(text).not.toContain('mi');
  });
});
