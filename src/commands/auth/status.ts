import chalk from 'chalk';
import {BaseCommand} from '../../lib/base-command.js';
import {loadAuth} from '../../lib/auth.js';

export default class AuthStatus extends BaseCommand {
  static override description = 'Show current authentication status';

  static override examples = [
    '<%= config.bin %> auth status',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthStatus);
    const noColor = this.isNoColor(flags);
    const auth = loadAuth();

    if (!auth) {
      this.log(noColor
        ? 'Not authenticated. Run "whoop auth login" to get started.'
        : chalk.yellow('Not authenticated. Run "whoop auth login" to get started.'));
      return;
    }

    const isEnvVar = !!process.env.WHOOP_ACCESS_TOKEN;

    this.log(noColor ? 'Authenticated' : chalk.green('Authenticated'));
    this.log('');

    if (auth.profile) {
      this.log(`  Name:    ${auth.profile.first_name} ${auth.profile.last_name}`);
      this.log(`  Email:   ${auth.profile.email}`);
      this.log(`  User ID: ${auth.profile.user_id}`);
      this.log('');
    }

    if (isEnvVar) {
      this.log('  Source:  WHOOP_ACCESS_TOKEN environment variable');
    } else {
      const expiresAt = new Date(auth.expires_at);
      const isExpired = Date.now() >= auth.expires_at;
      const hasRefresh = !!auth.refresh_token;

      this.log(`  Token expires: ${expiresAt.toLocaleString()}`);
      if (isExpired) {
        this.log(noColor ? '  Status: EXPIRED' : `  Status: ${chalk.red('EXPIRED')}`);
      } else {
        const remaining = Math.round((auth.expires_at - Date.now()) / 60_000);
        this.log(noColor
          ? `  Status: Valid (${remaining}m remaining)`
          : `  Status: ${chalk.green(`Valid (${remaining}m remaining)`)}`);
      }

      this.log(`  Refresh token: ${hasRefresh ? 'Yes' : 'No'}`);
    }

    if (auth.scopes && auth.scopes.length > 0) {
      this.log(`  Scopes:  ${auth.scopes.join(', ')}`);
    }
  }
}
