import {existsSync, readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';
import axios from 'axios';
import {ensureConfigDir, getConfigDir, getClientId, getClientSecret} from './config.js';
import type {AuthData} from './types.js';

const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

let cachedAuth: AuthData | null = null;

function getAuthPath(): string {
  return join(getConfigDir(), 'auth.json');
}

/**
 * Load auth data from disk. Returns cached copy after first read.
 */
export function loadAuth(): AuthData | null {
  // Environment variable override takes highest priority
  if (process.env.WHOOP_ACCESS_TOKEN) {
    return {
      access_token: process.env.WHOOP_ACCESS_TOKEN,
      expires_at: Number.MAX_SAFE_INTEGER, // Never expires for env var tokens
    };
  }

  if (cachedAuth) return cachedAuth;

  const path = getAuthPath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, 'utf-8');
    cachedAuth = JSON.parse(raw) as AuthData;
    return cachedAuth;
  } catch {
    return null;
  }
}

/**
 * Save auth data to disk with restricted permissions.
 */
export function saveAuth(auth: AuthData): void {
  ensureConfigDir();
  const path = getAuthPath();
  writeFileSync(path, JSON.stringify(auth, null, 2) + '\n', {mode: 0o600});
  cachedAuth = auth;
}

/**
 * Delete local auth data.
 */
export function clearAuth(): void {
  const path = getAuthPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
  cachedAuth = null;
}

/**
 * Check if the access token is expired or about to expire.
 */
export function isTokenExpired(auth: AuthData): boolean {
  return Date.now() >= auth.expires_at - REFRESH_BUFFER_MS;
}

/**
 * Refresh the access token using the refresh token.
 * Returns the new auth data and saves it to disk.
 */
export async function refreshToken(auth: AuthData): Promise<AuthData> {
  if (!auth.refresh_token) {
    throw new Error('No refresh token available. Run "whoop auth login" to re-authenticate.');
  }

  const clientId = auth.client_id ?? getClientId();
  const clientSecret = auth.client_secret ?? getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Missing client_id or client_secret. Set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables, or run "whoop config set client_id <value>".');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement',
  });

  const response = await axios.post(TOKEN_URL, params.toString(), {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  });

  const newAuth: AuthData = {
    ...auth,
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token ?? auth.refresh_token,
    expires_at: Date.now() + (response.data.expires_in * 1000),
    scopes: response.data.scope?.split(' '),
  };

  saveAuth(newAuth);
  return newAuth;
}

/**
 * Get a valid access token, auto-refreshing if needed.
 */
export async function getValidToken(forceRefresh = false): Promise<string> {
  const auth = loadAuth();

  if (!auth) {
    throw new Error('Not authenticated. Run "whoop auth login" to get started.');
  }

  // Env var tokens bypass refresh
  if (process.env.WHOOP_ACCESS_TOKEN) {
    return auth.access_token;
  }

  if (forceRefresh) {
    try {
      const newAuth = await refreshToken(auth);
      return newAuth.access_token;
    } catch {
      throw new Error('Session expired. Run "whoop auth login" to re-authenticate.');
    }
  }

  if (isTokenExpired(auth)) {
    try {
      const newAuth = await refreshToken(auth);
      return newAuth.access_token;
    } catch {
      throw new Error('Session expired. Run "whoop auth login" to re-authenticate.');
    }
  }

  return auth.access_token;
}

/**
 * Reset the in-memory cache (for testing).
 */
export function resetAuthCache(): void {
  cachedAuth = null;
}
