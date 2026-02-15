import {BaseCommand} from '../../lib/base-command.js';

export default class Profile extends BaseCommand {
  static override description = 'View your WHOOP profile';

  static override examples = [
    '<%= config.bin %> profile',
    '<%= config.bin %> profile --json',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Profile);
    const format = this.getOutputFormat(flags);

    const profile = await this.api.getProfile();

    if (format === 'json') {
      this.log(JSON.stringify(profile, null, 2));
      return;
    }

    this.log(`Name:    ${profile.first_name} ${profile.last_name}`);
    this.log(`Email:   ${profile.email}`);
    this.log(`User ID: ${profile.user_id}`);
  }
}
