import {describe, it, expect} from 'vitest';
import {
  makeRecovery, makePendingRecovery, makeUnscorableRecovery, makeRecoveryWithoutOptionals,
  makeSleep, makePendingSleep, makeUnscorableSleep,
  makeWorkout, makePendingWorkout, makeWorkoutWithoutDistance,
  makeCycle, makeActiveCycle, makePendingCycle,
  makeProfile, makeBodyMeasurement,
  paginated,
} from '../../helpers/fixtures.js';

describe('fixture factories', () => {
  describe('recovery', () => {
    it('creates scored recovery', () => {
      const r = makeRecovery();
      expect(r.score_state).toBe('SCORED');
      expect(r.score).toBeDefined();
      expect(r.score!.recovery_score).toBe(78);
    });

    it('creates pending recovery', () => {
      const r = makePendingRecovery();
      expect(r.score_state).toBe('PENDING_SCORE');
      expect(r.score).toBeUndefined();
    });

    it('creates unscorable recovery', () => {
      const r = makeUnscorableRecovery();
      expect(r.score_state).toBe('UNSCORABLE');
      expect(r.score).toBeUndefined();
    });

    it('creates recovery without optional fields', () => {
      const r = makeRecoveryWithoutOptionals();
      expect(r.score_state).toBe('SCORED');
      expect(r.score!.spo2_percentage).toBeUndefined();
      expect(r.score!.skin_temp_celsius).toBeUndefined();
    });

    it('allows overrides', () => {
      const r = makeRecovery({cycle_id: 99999});
      expect(r.cycle_id).toBe(99999);
    });
  });

  describe('sleep', () => {
    it('creates scored sleep', () => {
      const s = makeSleep();
      expect(s.score_state).toBe('SCORED');
      expect(s.score).toBeDefined();
      expect(s.score!.sleep_performance_percentage).toBe(94);
    });

    it('creates pending sleep', () => {
      const s = makePendingSleep();
      expect(s.score_state).toBe('PENDING_SCORE');
      expect(s.score).toBeUndefined();
    });

    it('creates unscorable sleep', () => {
      const s = makeUnscorableSleep();
      expect(s.score_state).toBe('UNSCORABLE');
    });

    it('creates nap', () => {
      const s = makeSleep({nap: true});
      expect(s.nap).toBe(true);
    });
  });

  describe('workout', () => {
    it('creates scored workout', () => {
      const w = makeWorkout();
      expect(w.score_state).toBe('SCORED');
      expect(w.sport_name).toBe('Running');
      expect(w.score!.distance_meter).toBe(8047);
    });

    it('creates pending workout', () => {
      const w = makePendingWorkout();
      expect(w.score_state).toBe('PENDING_SCORE');
      expect(w.score).toBeUndefined();
    });

    it('creates workout without distance', () => {
      const w = makeWorkoutWithoutDistance();
      expect(w.score!.distance_meter).toBeUndefined();
    });
  });

  describe('cycle', () => {
    it('creates scored cycle', () => {
      const c = makeCycle();
      expect(c.score_state).toBe('SCORED');
      expect(c.end).toBeDefined();
    });

    it('creates active cycle (no end)', () => {
      const c = makeActiveCycle();
      expect(c.end).toBeUndefined();
    });

    it('creates pending cycle', () => {
      const c = makePendingCycle();
      expect(c.score_state).toBe('PENDING_SCORE');
      expect(c.score).toBeUndefined();
    });
  });

  describe('user', () => {
    it('creates profile', () => {
      const p = makeProfile();
      expect(p.first_name).toBe('John');
      expect(p.email).toBe('john@example.com');
    });

    it('creates body measurement', () => {
      const b = makeBodyMeasurement();
      expect(b.height_meter).toBe(1.83);
      expect(b.max_heart_rate).toBe(200);
    });
  });

  describe('pagination', () => {
    it('creates paginated response', () => {
      const resp = paginated([1, 2, 3], 'nextpage');
      expect(resp.records).toEqual([1, 2, 3]);
      expect(resp.next_token).toBe('nextpage');
    });

    it('creates last page response', () => {
      const resp = paginated([1, 2]);
      expect(resp.next_token).toBeUndefined();
    });
  });
});
