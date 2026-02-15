import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {loadAuth, clearAuth} from '../../lib/auth.js';
import {WhoopApiError} from '../../lib/api.js';

export default class AuthLogout extends BaseCommand {
  static override description = 'Revoke WHOOP access and clear local tokens';

  static override examples = [
    '<%= config.bin %> auth logout',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthLogout);
    const noColor = this.isNoColor(flags);
    const auth = loadAuth();

    if (!auth) {
      this.log('Not currently authenticated.');
      return;
    }

    // Try to revoke server-side
    try {
      await this.api.revokeAccess();
      this.log('Revoked WHOOP access token on server.');
    } catch (error) {
      if (error instanceof WhoopApiError && error.statusCode === 0) {
        this.log('Could not reach WHOOP API to revoke token. Local credentials will still be cleared.');
      } else {
        this.log('Could not revoke token on server (may already be expired).');
      }
    }

    // Clear local tokens
    clearAuth();
    this.log(noColor ? 'Logged out successfully.' : chalk.green('Logged out successfully.'));
  }
}
