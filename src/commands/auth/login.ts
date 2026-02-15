import {Flags} from '@oclif/core';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomBytes} from 'node:crypto';
import {BaseCommand} from '../../lib/base-command.js';
import {buildAuthorizationUrl, exchangeCodeForToken, getApi} from '../../lib/api.js';
import {saveAuth} from '../../lib/auth.js';
import {getClientId, getClientSecret} from '../../lib/config.js';
import type {AuthData} from '../../lib/types.js';

export default class AuthLogin extends BaseCommand {
  static override description = 'Authenticate with WHOOP via browser OAuth flow';

  static override examples = [
    '<%= config.bin %> auth login',
    '<%= config.bin %> auth login --no-browser',
    '<%= config.bin %> auth login --port 9876',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
    port: Flags.integer({
      description: 'Override callback port',
      default: 0,
    }),
    'no-browser': Flags.boolean({
      description: 'Print the auth URL instead of opening browser',
    }),
  };

  protected override requiresAuth = false;

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthLogin);

    const clientId = getClientId();
    const clientSecret = getClientSecret();

    if (!clientId || !clientSecret) {
      this.error(
        'Missing WHOOP OAuth credentials.\n' +
        'Set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables,\n' +
        'or run: whoop config set client_id <value> && whoop config set client_secret <value>',
      );
    }

    const state = randomBytes(16).toString('hex');

    const {port, code} = await this.startCallbackServer(
      flags.port,
      flags['no-browser'],
      clientId,
      state,
    );

    const redirectUri = `http://localhost:${port}/callback`;

    this.log('Exchanging authorization code for tokens...');

    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    // Fetch profile
    const tempAuth: AuthData = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: Date.now() + (tokenResponse.expires_in * 1000),
      client_id: clientId,
      client_secret: clientSecret,
      scopes: tokenResponse.scope?.split(' '),
    };

    saveAuth(tempAuth);

    try {
      const api = getApi();
      const profile = await api.getProfile();
      tempAuth.profile = {
        user_id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
      };
      saveAuth(tempAuth);
      this.log(`\nAuthenticated as ${profile.first_name} ${profile.last_name} (${profile.email})`);
    } catch {
      this.log('\nAuthenticated successfully! (Could not fetch profile details)');
    }
  }

  private async startCallbackServer(
    preferredPort: number,
    noBrowser: boolean,
    clientId: string,
    state: string,
  ): Promise<{port: number; code: string}> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', `http://localhost`);

        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const receivedCode = url.searchParams.get('code');
        const receivedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, {'Content-Type': 'text/html'});
          res.end('<html><body><h1>Authorization Failed</h1><p>You can close this window.</p></body></html>');
          safeCloseServer();
          rejectOnce(new Error(`Authorization failed: ${error}`));
          return;
        }

        if (!receivedCode) {
          res.writeHead(400, {'Content-Type': 'text/html'});
          res.end('<html><body><h1>Missing Code</h1><p>No authorization code received.</p></body></html>');
          safeCloseServer();
          rejectOnce(new Error('No authorization code received'));
          return;
        }

        if (receivedState !== state) {
          res.writeHead(400, {'Content-Type': 'text/html'});
          res.end('<html><body><h1>State Mismatch</h1><p>CSRF verification failed.</p></body></html>');
          safeCloseServer();
          rejectOnce(new Error('State mismatch — possible CSRF attack'));
          return;
        }

        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<html><body><h1>Success!</h1><p>You can close this window and return to the terminal.</p></body></html>');

        safeCloseServer();
        resolveOnce({port: actualPort, code: receivedCode});
      });

      let actualPort = preferredPort;
      let timeout: NodeJS.Timeout | undefined;
      let cleanupStdin = () => {};

      const safeCloseServer = () => {
        if (server.listening) {
          server.close();
        }
      };

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }

        cleanupStdin();
      };

      const resolveOnce = (value: {port: number; code: string}) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      server.listen(preferredPort, '127.0.0.1', async () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          actualPort = addr.port;
        }

        const redirectUri = `http://localhost:${actualPort}/callback`;
        const authUrl = buildAuthorizationUrl(clientId, redirectUri, state);

        if (noBrowser) {
          this.log('Open this URL in your browser to authenticate:\n');
          this.log(authUrl);
          this.log('\nWaiting for callback...');
          this.log('(Or paste the redirect URL here if running on a remote machine)');

          cleanupStdin = this.listenForPastedUrl(state, (code) => {
            safeCloseServer();
            resolveOnce({port: actualPort, code});
          });
        } else {
          this.log('Opening browser for authentication...');
          try {
            const openModule = await import('open');
            await openModule.default(authUrl);
          } catch {
            this.log('Could not open browser. Open this URL manually:\n');
            this.log(authUrl);
          }

          this.log('Waiting for callback...');
        }
      });

      server.on('error', (err) => {
        rejectOnce(new Error(`Failed to start callback server: ${err.message}`));
      });

      timeout = setTimeout(() => {
        safeCloseServer();
        rejectOnce(new Error('Authentication timed out (5 minutes). Try again.'));
      }, 5 * 60 * 1000);
    });
  }

  private listenForPastedUrl(
    expectedState: string,
    onCode: (code: string) => void,
  ): () => void {
    const {stdin} = process;
    if (!stdin.isTTY) return () => {};

    stdin.setEncoding('utf8');
    stdin.resume();
    const onData = (data: string) => {
      const input = data.trim();

      try {
        const url = new URL(input);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (code) {
          if (state && state !== expectedState) {
            this.log('State mismatch in pasted URL. Try again.');
            return;
          }

          onCode(code);
          return;
        }
      } catch {
      }

      if (input.length > 10 && !input.includes(' ')) {
        onCode(input);
      }
    };

    stdin.on('data', onData);

    return () => {
      stdin.off('data', onData);
      stdin.pause();
    };
  }
}
