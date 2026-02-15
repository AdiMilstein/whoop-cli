import {Args} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';
import {colorStrain, renderBar} from '../../lib/formatter.js';
import {msToHuman, kjToKcal, formatNumber, metersToMiles, metersToKm} from '../../lib/units.js';
import type {Workout} from '../../lib/types.js';
import type {Column} from '../../lib/formatter.js';

export default class WorkoutGet extends BaseCommand {
  static override description = 'Get a specific workout';

  static override examples = [
    '<%= config.bin %> workout get <workoutId>',
  ];

  static override args = {
    workoutId: Args.string({description: 'Workout ID (UUID)', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(WorkoutGet);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);
    const units = this.getUnits(flags);

    const workout = await this.api.getWorkout(args.workoutId);

    if (format === 'json') {
      this.log(JSON.stringify(workout, null, 2));
      return;
    }

    if (format === 'csv') {
      this.printFormatted(
        [this.toWorkoutRow(workout, units)],
        this.getWorkoutColumns(),
        {format, noColor},
      );
      return;
    }

    this.printWorkoutDetail(workout, noColor, units);
  }

  getWorkoutColumns(): Column[] {
    return [
      {key: 'date', header: 'Date'},
      {key: 'workoutId', header: 'Workout ID'},
      {key: 'sport', header: 'Sport'},
      {key: 'strain', header: 'Strain'},
      {key: 'duration', header: 'Duration'},
      {key: 'avgHr', header: 'Avg HR'},
      {key: 'maxHr', header: 'Max HR'},
      {key: 'calories', header: 'Calories'},
      {key: 'distance', header: 'Distance'},
      {key: 'elevationGain', header: 'Elevation Gain'},
      {key: 'state', header: 'State'},
    ];
  }

  toWorkoutRow(workout: Workout, units: 'metric' | 'imperial'): Record<string, unknown> {
    if (workout.score_state !== 'SCORED' || !workout.score) {
      return {
        date: workout.start.split('T')[0],
        workoutId: workout.id,
        sport: workout.sport_name,
        strain: '—',
        duration: '—',
        avgHr: '—',
        maxHr: '—',
        calories: '—',
        distance: '—',
        elevationGain: '—',
        state: workout.score_state,
      };
    }

    const s = workout.score;
    const start = new Date(workout.start).getTime();
    const end = new Date(workout.end).getTime();
    const durationMs = end - start;

    let distance = '—';
    if (s.distance_meter !== undefined) {
      distance = units === 'imperial'
        ? `${metersToMiles(s.distance_meter)} mi`
        : `${metersToKm(s.distance_meter)} km`;
    }

    let elevationGain = '—';
    if (s.altitude_gain_meter !== undefined) {
      elevationGain = units === 'imperial'
        ? `${Math.round(s.altitude_gain_meter * 3.28084)} ft`
        : `${Math.round(s.altitude_gain_meter)} m`;
    }

    return {
      date: workout.start.split('T')[0],
      workoutId: workout.id,
      sport: workout.sport_name,
      strain: s.strain.toFixed(1),
      duration: msToHuman(durationMs),
      avgHr: s.average_heart_rate,
      maxHr: s.max_heart_rate,
      calories: formatNumber(kjToKcal(s.kilojoule)),
      distance,
      elevationGain,
      state: workout.score_state,
    };
  }

  printWorkoutDetail(workout: Workout, noColor: boolean, units: 'metric' | 'imperial'): void {
    if (workout.score_state === 'PENDING_SCORE') {
      this.log(`Workout: ${workout.sport_name} (Pending)`);
      return;
    }

    if (workout.score_state === 'UNSCORABLE') {
      this.log(`Workout: ${workout.sport_name} (Unscorable)`);
      return;
    }

    const s = workout.score!;
    const start = new Date(workout.start).getTime();
    const end = new Date(workout.end).getTime();
    const durationMs = end - start;

    let distanceStr = '';
    if (s.distance_meter !== undefined) {
      distanceStr = units === 'imperial'
        ? ` | ${metersToMiles(s.distance_meter)} mi`
        : ` | ${metersToKm(s.distance_meter)} km`;
    }

    this.log(`\u{1F3CB}\u{FE0F} ${workout.sport_name} \u2014 Strain ${colorStrain(s.strain, noColor)}`);
    this.log(`   Duration: ${msToHuman(durationMs)} | Avg HR: ${s.average_heart_rate}bpm | Max HR: ${s.max_heart_rate}bpm | ${formatNumber(kjToKcal(s.kilojoule))} kcal${distanceStr}`);

    if (s.altitude_gain_meter !== undefined) {
      const altGain = units === 'imperial'
        ? `${Math.round(s.altitude_gain_meter * 3.28084)}ft`
        : `${Math.round(s.altitude_gain_meter)}m`;
      this.log(`   Elevation gain: ${altGain}`);
    }

    // Heart rate zone breakdown
    const zones = s.zone_durations;
    const totalZoneMs = zones.zone_zero_milli + zones.zone_one_milli + zones.zone_two_milli +
      zones.zone_three_milli + zones.zone_four_milli + zones.zone_five_milli;

    if (totalZoneMs > 0) {
      this.log('');
      this.log('   Heart Rate Zones:');
      const zoneData = [
        {name: 'Zone 0 (Rest)  ', ms: zones.zone_zero_milli},
        {name: 'Zone 1 (Light) ', ms: zones.zone_one_milli},
        {name: 'Zone 2 (Mod.)  ', ms: zones.zone_two_milli},
        {name: 'Zone 3 (Hard)  ', ms: zones.zone_three_milli},
        {name: 'Zone 4 (V.Hard)', ms: zones.zone_four_milli},
        {name: 'Zone 5 (Max)   ', ms: zones.zone_five_milli},
      ];

      for (const zone of zoneData) {
        const fraction = zone.ms / totalZoneMs;
        const time = msToHuman(zone.ms, false).padStart(10);
        this.log(`   ${zone.name} ${time}  ${renderBar(fraction, 20, noColor)}`);
      }
    }
  }
}
