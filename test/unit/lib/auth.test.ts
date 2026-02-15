import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {existsSync, mkdirSync, rmSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  loadAuth, saveAuth, clearAuth, isTokenExpired,
  resetAuthCache,
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
});
