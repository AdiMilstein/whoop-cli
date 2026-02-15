import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {loadAuth, refreshToken} from '../../lib/auth.js';

export default class AuthRefresh extends BaseCommand {
  static override description = 'Force an immediate token refresh';

  static override examples = [
    '<%= config.bin %> auth refresh',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthRefresh);
    const noColor = this.isNoColor(flags);
    const auth = loadAuth();

    if (!auth) {
      this.error('Not authenticated. Run "whoop auth login" to get started.');
    }

    if (!auth.refresh_token) {
      this.error('No refresh token available. Run "whoop auth login" to re-authenticate with full OAuth flow.');
    }

    this.log('Refreshing token...');

    try {
      const newAuth = await refreshToken(auth);
      const expiresAt = new Date(newAuth.expires_at);
      this.log(noColor
        ? `Token refreshed. New expiry: ${expiresAt.toLocaleString()}`
        : chalk.green(`Token refreshed. New expiry: ${expiresAt.toLocaleString()}`));
    } catch (error) {
      this.error('Token refresh failed. Run "whoop auth login" to re-authenticate.');
    }
  }
}
