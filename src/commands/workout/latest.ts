import {BaseCommand} from '../../lib/base-command.js';
import WorkoutGet from './get.js';

export default class WorkoutLatest extends BaseCommand {
  static override description = 'Get your latest workout';

  static override examples = [
    '<%= config.bin %> workout latest',
    '<%= config.bin %> workout latest --json',
    '<%= config.bin %> workout latest -q',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(WorkoutLatest);
    const format = this.getOutputFormat(flags);
    const noColor = this.isNoColor(flags);
    const units = this.getUnits(flags);

    const response = await this.api.listWorkouts({limit: 1});
    if (response.records.length === 0) {
      this.log('No workout data found.');
      return;
    }

    const workout = response.records[0];

    if (flags.quiet) {
      if (workout.score_state === 'SCORED' && workout.score) {
        this.log(workout.score.strain.toFixed(1));
      } else {
        this.log(workout.score_state);
      }
      return;
    }

    if (format === 'json') {
      this.log(JSON.stringify(workout, null, 2));
      return;
    }

    const getCmd = new WorkoutGet(this.argv, this.config);
    if (format === 'csv') {
      this.printFormatted(
        [getCmd.toWorkoutRow(workout, units)],
        getCmd.getWorkoutColumns(),
        {format, noColor},
      );
      return;
    }

    getCmd.printWorkoutDetail(workout, noColor, units);
  }
}
