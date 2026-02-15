import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import type {CliConfig} from './types.js';

let cachedConfig: CliConfig | null = null;
let cachedConfigDir: string | null = null;

/**
 * Get the config directory path, respecting env overrides and XDG.
 */
export function getConfigDir(): string {
  if (cachedConfigDir) return cachedConfigDir;

  if (process.env.WHOOP_CONFIG_DIR) {
    cachedConfigDir = process.env.WHOOP_CONFIG_DIR;
  } else if (process.env.XDG_CONFIG_HOME) {
    cachedConfigDir = join(process.env.XDG_CONFIG_HOME, 'whoop-cli');
  } else {
    cachedConfigDir = join(homedir(), '.config', 'whoop-cli');
  }

  return cachedConfigDir;
}

/**
 * Ensure the config directory exists.
 */
export function ensureConfigDir(): string {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true});
  }
  return dir;
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

/**
 * Load config from disk. Returns cached copy after first read.
 */
export function loadConfig(): CliConfig {
  if (cachedConfig) return cachedConfig;

  const path = getConfigPath();
  if (!existsSync(path)) {
    cachedConfig = {};
    return cachedConfig;
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    cachedConfig = JSON.parse(raw) as CliConfig;
    return cachedConfig;
  } catch {
    cachedConfig = {};
    return cachedConfig;
  }
}

/**
 * Save config to disk and update cache.
 */
export function saveConfig(config: CliConfig): void {
  ensureConfigDir();
  const path = getConfigPath();
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', {mode: 0o600});
  cachedConfig = config;
}

/**
 * Update a single config value.
 */
export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  switch (key) {
    case 'units':
      if (value !== 'metric' && value !== 'imperial') {
        throw new Error(`Invalid value for units: "${value}". Must be "metric" or "imperial".`);
      }
      config.units = value;
      break;
    case 'default_format':
      if (value !== 'table' && value !== 'json' && value !== 'csv') {
        throw new Error(`Invalid value for default_format: "${value}". Must be "table", "json", or "csv".`);
      }
      config.default_format = value;
      break;
    case 'default_limit': {
      const num = Number.parseInt(value, 10);
      if (Number.isNaN(num) || num < 1 || num > 25) {
        throw new Error(`Invalid value for default_limit: "${value}". Must be a number between 1 and 25.`);
      }
      config.default_limit = num;
      break;
    }
    case 'color':
      if (value !== 'true' && value !== 'false') {
        throw new Error(`Invalid value for color: "${value}". Must be "true" or "false".`);
      }
      config.color = value === 'true';
      break;
    case 'client_id':
      config.client_id = value;
      break;
    case 'client_secret':
      config.client_secret = value;
      break;
    default:
      throw new Error(`Unknown config key: "${key}". Valid keys: units, default_format, default_limit, color, client_id, client_secret`);
  }

  saveConfig(config);
}

/**
 * Get a client_id, preferring env var > config > undefined.
 */
export function getClientId(): string | undefined {
  return process.env.WHOOP_CLIENT_ID ?? loadConfig().client_id;
}

/**
 * Get a client_secret, preferring env var > config > undefined.
 */
export function getClientSecret(): string | undefined {
  return process.env.WHOOP_CLIENT_SECRET ?? loadConfig().client_secret;
}

/**
 * Reset the in-memory cache (for testing).
 */
export function resetConfigCache(): void {
  cachedConfig = null;
  cachedConfigDir = null;
}
