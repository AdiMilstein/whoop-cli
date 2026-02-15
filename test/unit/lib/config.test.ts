import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {existsSync, mkdirSync, rmSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  loadConfig, saveConfig, setConfigValue, getClientId, getClientSecret,
  resetConfigCache,
} from '../../../src/lib/config.js';

const testDir = join(tmpdir(), 'whoop-cli-test-config-' + process.pid);

describe('config', () => {
  beforeEach(() => {
    resetConfigCache();
    process.env.WHOOP_CONFIG_DIR = testDir;
    delete process.env.WHOOP_CLIENT_ID;
    delete process.env.WHOOP_CLIENT_SECRET;

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
    resetConfigCache();
  });

  it('returns empty config when no file exists', () => {
    const config = loadConfig();
    expect(config).toEqual({});
  });

  it('saves and loads config', () => {
    saveConfig({units: 'imperial', default_limit: 20});
    resetConfigCache();
    const loaded = loadConfig();
    expect(loaded.units).toBe('imperial');
    expect(loaded.default_limit).toBe(20);
  });

  it('saves config with restricted permissions', () => {
    saveConfig({units: 'metric'});
    const configPath = join(testDir, 'config.json');
    expect(existsSync(configPath)).toBe(true);
  });

  describe('setConfigValue', () => {
    it('sets units to imperial', () => {
      setConfigValue('units', 'imperial');
      resetConfigCache();
      expect(loadConfig().units).toBe('imperial');
    });

    it('sets default_format', () => {
      setConfigValue('default_format', 'json');
      resetConfigCache();
      expect(loadConfig().default_format).toBe('json');
    });

    it('sets default_limit', () => {
      setConfigValue('default_limit', '15');
      resetConfigCache();
      expect(loadConfig().default_limit).toBe(15);
    });

    it('sets color', () => {
      setConfigValue('color', 'false');
      resetConfigCache();
      expect(loadConfig().color).toBe(false);
    });

    it('sets client_id', () => {
      setConfigValue('client_id', 'test-id');
      resetConfigCache();
      expect(loadConfig().client_id).toBe('test-id');
    });

    it('rejects invalid units', () => {
      expect(() => setConfigValue('units', 'kelvin')).toThrow('Invalid value for units');
    });

    it('rejects invalid default_format', () => {
      expect(() => setConfigValue('default_format', 'xml')).toThrow('Invalid value for default_format');
    });

    it('rejects invalid default_limit', () => {
      expect(() => setConfigValue('default_limit', '0')).toThrow('Invalid value for default_limit');
      expect(() => setConfigValue('default_limit', '26')).toThrow('Invalid value for default_limit');
    });

    it('rejects unknown keys', () => {
      expect(() => setConfigValue('foo', 'bar')).toThrow('Unknown config key');
    });
  });

  describe('getClientId / getClientSecret', () => {
    it('prefers env var over config', () => {
      setConfigValue('client_id', 'config-id');
      process.env.WHOOP_CLIENT_ID = 'env-id';
      expect(getClientId()).toBe('env-id');
    });

    it('falls back to config', () => {
      setConfigValue('client_id', 'config-id');
      resetConfigCache();
      expect(getClientId()).toBe('config-id');
    });

    it('returns undefined when neither set', () => {
      expect(getClientSecret()).toBeUndefined();
    });
  });
});
