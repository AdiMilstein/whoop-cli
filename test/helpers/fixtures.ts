import type {
  Recovery, RecoveryScore, Sleep, SleepScore, SleepStageSummary, SleepNeeded,
  Workout, WorkoutScore, ZoneDurations, Cycle, CycleScore,
  UserBasicProfile, UserBodyMeasurement, PaginatedResponse,
} from '../../src/lib/types.js';

// --- Recovery ---

export function makeRecoveryScore(overrides?: Partial<RecoveryScore>): RecoveryScore {
  return {
    user_calibrating: false,
    recovery_score: 78,
    resting_heart_rate: 52,
    hrv_rmssd_milli: 45.2,
    spo2_percentage: 97.1,
    skin_temp_celsius: 33.4,
    ...overrides,
  };
}

export function makeRecovery(overrides?: Partial<Recovery>): Recovery {
  return {
    cycle_id: 10001,
    sleep_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    user_id: 10129,
    created_at: '2024-06-15T07:00:00.000Z',
    updated_at: '2024-06-15T07:00:00.000Z',
    score_state: 'SCORED',
    score: makeRecoveryScore(),
    ...overrides,
  };
}

export function makePendingRecovery(): Recovery {
  return makeRecovery({score_state: 'PENDING_SCORE', score: undefined});
}

export function makeUnscorableRecovery(): Recovery {
  return makeRecovery({score_state: 'UNSCORABLE', score: undefined});
}

export function makeRecoveryWithoutOptionals(): Recovery {
  return makeRecovery({
    score: makeRecoveryScore({spo2_percentage: undefined, skin_temp_celsius: undefined}),
  });
}

// --- Sleep ---

export function makeSleepStageSummary(overrides?: Partial<SleepStageSummary>): SleepStageSummary {
  return {
    total_in_bed_time_milli: 28_800_000,  // 8h
    total_awake_time_milli: 2_220_000,    // 37m
    total_no_data_time_milli: 0,
    total_light_sleep_time_milli: 11_520_000, // 3h 12m
    total_slow_wave_sleep_time_milli: 6_480_000, // 1h 48m
    total_rem_sleep_time_milli: 7_500_000,    // 2h 05m
    sleep_cycle_count: 4,
    disturbance_count: 3,
    ...overrides,
  };
}

export function makeSleepNeeded(overrides?: Partial<SleepNeeded>): SleepNeeded {
  return {
    baseline_milli: 27_000_000,       // 7h 30m
    need_from_sleep_debt_milli: 1_800_000,   // 30m
    need_from_recent_strain_milli: 900_000,  // 15m
    need_from_recent_nap_milli: -1_800_000,  // -30m
    ...overrides,
  };
}

export function makeSleepScore(overrides?: Partial<SleepScore>): SleepScore {
  return {
    stage_summary: makeSleepStageSummary(),
    sleep_needed: makeSleepNeeded(),
    respiratory_rate: 15.8,
    sleep_performance_percentage: 94,
    sleep_consistency_percentage: 88,
    sleep_efficiency_percentage: 91.7,
    ...overrides,
  };
}

export function makeSleep(overrides?: Partial<Sleep>): Sleep {
  return {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    cycle_id: 10001,
    user_id: 10129,
    created_at: '2024-06-15T06:30:00.000Z',
    updated_at: '2024-06-15T06:30:00.000Z',
    start: '2024-06-14T22:30:00.000Z',
    end: '2024-06-15T06:30:00.000Z',
    timezone_offset: '-04:00',
    nap: false,
    score_state: 'SCORED',
    score: makeSleepScore(),
    ...overrides,
  };
}

export function makePendingSleep(): Sleep {
  return makeSleep({score_state: 'PENDING_SCORE', score: undefined});
}

export function makeUnscorableSleep(): Sleep {
  return makeSleep({score_state: 'UNSCORABLE', score: undefined});
}

// --- Workout ---

export function makeZoneDurations(overrides?: Partial<ZoneDurations>): ZoneDurations {
  return {
    zone_zero_milli: 300_000,    // 5m
    zone_one_milli: 600_000,     // 10m
    zone_two_milli: 900_000,     // 15m
    zone_three_milli: 900_000,   // 15m
    zone_four_milli: 600_000,    // 10m
    zone_five_milli: 300_000,    // 5m
    ...overrides,
  };
}

export function makeWorkoutScore(overrides?: Partial<WorkoutScore>): WorkoutScore {
  return {
    strain: 14.2,
    average_heart_rate: 142,
    max_heart_rate: 171,
    kilojoule: 5210,
    percent_recorded: 98.5,
    distance_meter: 8047,
    zone_durations: makeZoneDurations(),
    ...overrides,
  };
}

export function makeWorkout(overrides?: Partial<Workout>): Workout {
  return {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    user_id: 10129,
    created_at: '2024-06-15T18:00:00.000Z',
    updated_at: '2024-06-15T18:48:00.000Z',
    start: '2024-06-15T18:00:00.000Z',
    end: '2024-06-15T18:48:00.000Z',
    timezone_offset: '-04:00',
    sport_name: 'Running',
    score_state: 'SCORED',
    score: makeWorkoutScore(),
    ...overrides,
  };
}

export function makePendingWorkout(): Workout {
  return makeWorkout({score_state: 'PENDING_SCORE', score: undefined});
}

export function makeWorkoutWithoutDistance(): Workout {
  return makeWorkout({
    score: makeWorkoutScore({distance_meter: undefined, altitude_gain_meter: undefined}),
  });
}

// --- Cycle ---

export function makeCycleScore(overrides?: Partial<CycleScore>): CycleScore {
  return {
    strain: 12.4,
    kilojoule: 11_910,
    average_heart_rate: 72,
    max_heart_rate: 168,
    ...overrides,
  };
}

export function makeCycle(overrides?: Partial<Cycle>): Cycle {
  return {
    id: 10001,
    user_id: 10129,
    created_at: '2024-06-15T04:00:00.000Z',
    updated_at: '2024-06-15T22:00:00.000Z',
    start: '2024-06-15T04:00:00.000Z',
    end: '2024-06-16T04:00:00.000Z',
    timezone_offset: '-04:00',
    score_state: 'SCORED',
    score: makeCycleScore(),
    ...overrides,
  };
}

export function makeActiveCycle(): Cycle {
  return makeCycle({end: undefined});
}

export function makePendingCycle(): Cycle {
  return makeCycle({score_state: 'PENDING_SCORE', score: undefined});
}

// --- User ---

export function makeProfile(): UserBasicProfile {
  return {
    user_id: 10129,
    email: 'john@example.com',
    first_name: 'John',
    last_name: 'Smith',
  };
}

export function makeBodyMeasurement(): UserBodyMeasurement {
  return {
    height_meter: 1.83,
    weight_kilogram: 90.7,
    max_heart_rate: 200,
  };
}

// --- Paginated helpers ---

export function paginated<T>(records: T[], nextToken?: string): PaginatedResponse<T> {
  return {records, next_token: nextToken};
}
