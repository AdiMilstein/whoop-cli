import {Flags} from '@oclif/core';
import * as readline from 'node:readline/promises';
import {BaseCommand} from '../../lib/base-command.js';
import {saveAuth} from '../../lib/auth.js';
import {getApi, resetApi, WhoopApiError} from '../../lib/api.js';
import type {AuthData} from '../../lib/types.js';

const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes (conservative default)

export default class AuthToken extends BaseCommand {
  static override description = 'Authenticate by pasting an access token directly';

  static override examples = [
    '<%= config.bin %> auth token',
    '<%= config.bin %> auth token --access-token <token>',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
    'access-token': Flags.string({
      description: 'Access token to use',
    }),
    'refresh-token': Flags.string({
      description: 'Optional refresh token',
    }),
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthToken);

    let accessToken = flags['access-token'];
    let refreshToken = flags['refresh-token'];

    if (!accessToken) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr,
      });

      accessToken = await rl.question('Paste your access token: ');
      if (!refreshToken) {
        refreshToken = await rl.question('Paste your refresh token (or press Enter to skip): ');
        if (!refreshToken) refreshToken = undefined;
      }

      rl.close();
    }

    if (!accessToken) {
      this.error('No access token provided.');
    }

    this.log('Validating token...');

    const auth: AuthData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + DEFAULT_TOKEN_TTL_MS,
    };

    saveAuth(auth);
    resetApi();

    try {
      const api = getApi();
      const profile = await api.getProfile();

      auth.profile = {
        user_id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
      };
      saveAuth(auth);

      this.log(`Authenticated as ${profile.first_name} ${profile.last_name} (${profile.email})`);
    } catch (error) {
      if (error instanceof WhoopApiError && error.statusCode === 401) {
        // Token is definitely invalid — clear it
        const {clearAuth} = await import('../../lib/auth.js');
        clearAuth();
        this.error('Token validation failed. The token is invalid or expired.');
      }

      // Network or other error — keep the saved token
      this.error('Token validation failed: could not reach WHOOP API. The token has been saved and will be used for future requests.');
    }
  }
}
