import {BaseCommand} from '../../lib/base-command.js';
import {metersToFeetInches, kgToLbs} from '../../lib/units.js';

export default class ProfileBody extends BaseCommand {
  static override description = 'View your body measurements';

  static override examples = [
    '<%= config.bin %> profile body',
    '<%= config.bin %> profile body --json',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(ProfileBody);
    const format = this.getOutputFormat(flags);

    const body = await this.api.getBodyMeasurement();

    if (format === 'json') {
      this.log(JSON.stringify(body, null, 2));
      return;
    }

    const heightImperial = metersToFeetInches(body.height_meter);
    const weightImperial = kgToLbs(body.weight_kilogram);

    this.log(`Height:         ${body.height_meter.toFixed(2)}m (${heightImperial})`);
    this.log(`Weight:         ${body.weight_kilogram.toFixed(1)}kg (${weightImperial}lb)`);
    this.log(`Max Heart Rate: ${body.max_heart_rate} bpm`);
  }
}
