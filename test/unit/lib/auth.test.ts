import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {existsSync, mkdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import axios from 'axios';
import {
  loadAuth, saveAuth, clearAuth, isTokenExpired, getValidToken,
  refreshToken, resetAuthCache,
} from '../../../src/lib/auth.js';
import {resetConfigCache} from '../../../src/lib/config.js';
import type {AuthData} from '../../../src/lib/types.js';

const testDir = join(tmpdir(), 'whoop-cli-test-auth-' + process.pid);

function makeAuthData(overrides?: Partial<AuthData>): AuthData {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3_600_000,
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    ...overrides,
  };
}

describe('auth', () => {
  beforeEach(() => {
    resetAuthCache();
    resetConfigCache();
    process.env.WHOOP_CONFIG_DIR = testDir;
    delete process.env.WHOOP_ACCESS_TOKEN;

    if (existsSync(testDir)) {
      rmSync(testDir, {recursive: true});
    }
    mkdirSync(testDir, {recursive: true});
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, {recursive: true});
    }
    delete process.env.WHOOP_CONFIG_DIR;
    delete process.env.WHOOP_ACCESS_TOKEN;
    resetAuthCache();
    resetConfigCache();
    vi.restoreAllMocks();
  });

  describe('loadAuth', () => {
    it('returns null when no auth file exists', () => {
      expect(loadAuth()).toBeNull();
    });

    it('returns auth data from file', () => {
      const auth = makeAuthData();
      saveAuth(auth);
      resetAuthCache();
      const loaded = loadAuth();
      expect(loaded?.access_token).toBe('test-access-token');
    });

    it('prefers WHOOP_ACCESS_TOKEN env var', () => {
      saveAuth(makeAuthData());
      process.env.WHOOP_ACCESS_TOKEN = 'env-token';
      resetAuthCache();
      const loaded = loadAuth();
      expect(loaded?.access_token).toBe('env-token');
      expect(loaded?.expires_at).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('returns null when auth file contains corrupted JSON', () => {
      const authPath = join(testDir, 'auth.json');
      writeFileSync(authPath, '{not valid json!!!', {mode: 0o600});
      resetAuthCache();
      const loaded = loadAuth();
      expect(loaded).toBeNull();
    });
  });

  describe('saveAuth', () => {
    it('saves auth to file', () => {
      saveAuth(makeAuthData());
      const authPath = join(testDir, 'auth.json');
      expect(existsSync(authPath)).toBe(true);
    });

    it('sets restrictive file permissions (600)', () => {
      saveAuth(makeAuthData());
      const authPath = join(testDir, 'auth.json');
      const stats = statSync(authPath);
      // Check owner read/write only (0o600 = 384 decimal)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe('clearAuth', () => {
    it('deletes auth file', () => {
      saveAuth(makeAuthData());
      const authPath = join(testDir, 'auth.json');
      expect(existsSync(authPath)).toBe(true);
      clearAuth();
      expect(existsSync(authPath)).toBe(false);
    });

    it('does not throw when no file exists', () => {
      expect(() => clearAuth()).not.toThrow();
    });
  });

  describe('isTokenExpired', () => {
    it('returns false for future token', () => {
      const auth = makeAuthData({expires_at: Date.now() + 3_600_000});
      expect(isTokenExpired(auth)).toBe(false);
    });

    it('returns true for past token', () => {
      const auth = makeAuthData({expires_at: Date.now() - 1000});
      expect(isTokenExpired(auth)).toBe(true);
    });

    it('returns true when within 5 minute buffer', () => {
      const auth = makeAuthData({expires_at: Date.now() + 4 * 60 * 1000}); // 4 minutes from now
      expect(isTokenExpired(auth)).toBe(true);
    });

    it('returns false when just outside 5 minute buffer', () => {
      const auth = makeAuthData({expires_at: Date.now() + 6 * 60 * 1000}); // 6 minutes from now
      expect(isTokenExpired(auth)).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('refreshes successfully and saves new auth with correct expires_at', async () => {
      const auth = makeAuthData();
      const now = Date.now();
      vi.spyOn(axios, 'post').mockResolvedValue({
        data: {
          access_token: 'refreshed-access-token',
          refresh_token: 'refreshed-refresh-token',
          expires_in: 7200,
          scope: 'offline read:profile',
        },
      } as any);

      const newAuth = await refreshToken(auth);

      expect(newAuth.access_token).toBe('refreshed-access-token');
      expect(newAuth.refresh_token).toBe('refreshed-refresh-token');
      // expires_at should be approximately now + 7200 * 1000
      expect(newAuth.expires_at).toBeGreaterThanOrEqual(now + 7200 * 1000 - 1000);
      expect(newAuth.expires_at).toBeLessThanOrEqual(now + 7200 * 1000 + 5000);
      // Verify it was persisted
      resetAuthCache();
      const saved = loadAuth();
      expect(saved?.access_token).toBe('refreshed-access-token');
    });

    it('throws when no refresh_token is present', async () => {
      const auth = makeAuthData({refresh_token: undefined});

      await expect(refreshToken(auth)).rejects.toThrow('No refresh token available');
    });

    it('throws when client credentials are missing', async () => {
      // Remove client_id and client_secret from auth data,
      // and ensure env vars and config have no credentials either
      delete process.env.WHOOP_CLIENT_ID;
      delete process.env.WHOOP_CLIENT_SECRET;
      process.env.WHOOP_CLIENT_ID = '';
      process.env.WHOOP_CLIENT_SECRET = '';
      resetConfigCache();

      const auth = makeAuthData({client_id: undefined, client_secret: undefined});

      await expect(refreshToken(auth)).rejects.toThrow('Missing client_id or client_secret');

      // Clean up
      delete process.env.WHOOP_CLIENT_ID;
      delete process.env.WHOOP_CLIENT_SECRET;
    });

    it('preserves profile data through refresh', async () => {
      const profile = {
        user_id: 12345,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      };
      const auth = makeAuthData({profile});

      vi.spyOn(axios, 'post').mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          scope: 'offline read:profile',
        },
      } as any);

      const newAuth = await refreshToken(auth);

      expect(newAuth.profile).toEqual(profile);
      expect(newAuth.access_token).toBe('new-access-token');
    });
  });

  describe('getValidToken', () => {
    it('returns cached token when not expired', async () => {
      saveAuth(makeAuthData({access_token: 'cached-token', expires_at: Date.now() + 60 * 60 * 1000}));
      const postSpy = vi.spyOn(axios, 'post');

      const token = await getValidToken();

      expect(token).toBe('cached-token');
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('refreshes immediately when forceRefresh is true', async () => {
      saveAuth(makeAuthData({access_token: 'old-token', expires_at: Date.now() + 60 * 60 * 1000}));
      const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          scope: 'offline read:profile',
        },
      } as any);

      const token = await getValidToken(true);

      expect(token).toBe('new-token');
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(loadAuth()?.access_token).toBe('new-token');
    });

    it('throws when forceRefresh is true and no refresh token exists', async () => {
      saveAuth(makeAuthData({refresh_token: undefined}));

      await expect(getValidToken(true)).rejects.toThrow('Session expired');
    });

    it('auto-refreshes when token is expired', async () => {
      saveAuth(makeAuthData({
        access_token: 'expired-token',
        expires_at: Date.now() - 60_000, // expired 1 minute ago
      }));
      const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
        data: {
          access_token: 'auto-refreshed-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          scope: 'offline read:profile',
        },
      } as any);

      const token = await getValidToken();

      expect(token).toBe('auto-refreshed-token');
      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    it('throws with preserved error context when refresh fails on expired token', async () => {
      saveAuth(makeAuthData({
        access_token: 'expired-token',
        expires_at: Date.now() - 60_000, // expired
      }));
      vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network timeout'));

      await expect(getValidToken()).rejects.toThrow(
        /Session expired.*Network timeout/,
      );
    });
  });
});
