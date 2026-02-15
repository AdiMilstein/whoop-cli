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
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }

        if (!receivedCode) {
          res.writeHead(400, {'Content-Type': 'text/html'});
          res.end('<html><body><h1>Missing Code</h1><p>No authorization code received.</p></body></html>');
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        if (receivedState !== state) {
          res.writeHead(400, {'Content-Type': 'text/html'});
          res.end('<html><body><h1>State Mismatch</h1><p>CSRF verification failed.</p></body></html>');
          server.close();
          reject(new Error('State mismatch — possible CSRF attack'));
          return;
        }

        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<html><body><h1>Success!</h1><p>You can close this window and return to the terminal.</p></body></html>');

        server.close();
        resolve({port: actualPort, code: receivedCode});
      });

      let actualPort = preferredPort;

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

          // Also listen for pasted redirect URL on stdin
          this.listenForPastedUrl(state, server, resolve);
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
        reject(new Error(`Failed to start callback server: ${err.message}`));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out (5 minutes). Try again.'));
      }, 5 * 60 * 1000);
    });
  }

  private listenForPastedUrl(
    expectedState: string,
    server: ReturnType<typeof createServer>,
    resolve: (value: {port: number; code: string}) => void,
  ): void {
    const {stdin} = process;
    if (!stdin.isTTY) return;

    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', (data: string) => {
      const input = data.trim();

      // Try to parse as a URL with ?code= param
      try {
        const url = new URL(input);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (code) {
          if (state && state !== expectedState) {
            this.log('State mismatch in pasted URL. Try again.');
            return;
          }

          stdin.pause();
          server.close();
          const addr = server.address();
          const port = addr && typeof addr === 'object' ? addr.port : 0;
          resolve({port, code});
          return;
        }
      } catch {
        // Not a URL, try as raw code
      }

      // Try as a raw authorization code
      if (input.length > 10 && !input.includes(' ')) {
        stdin.pause();
        server.close();
        const addr = server.address();
        const port = addr && typeof addr === 'object' ? addr.port : 0;
        resolve({port, code: input});
      }
    });
  }
}
