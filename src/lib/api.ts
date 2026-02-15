import axios, {type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig} from 'axios';
import {getValidToken} from './auth.js';
import type {
  Cycle, Recovery, Sleep, Workout,
  UserBasicProfile, UserBodyMeasurement,
  PaginatedResponse, ListParams,
} from './types.js';

const BASE_URL = 'https://api.prod.whoop.com/developer';
const OAUTH_BASE = 'https://api.prod.whoop.com/oauth/oauth2';

export class WhoopApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'WhoopApiError';
  }
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

export class WhoopApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
    });

    // Request interceptor: inject auth header
    this.client.interceptors.request.use(async (config) => {
      const token = await getValidToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Response interceptor: handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as RetryConfig | undefined;

        // 401: attempt refresh and retry once
        if (error.response?.status === 401 && config && !config._retried) {
          config._retried = true;
          try {
            const token = await getValidToken(true);
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
            return this.client.request(config);
          } catch {
            throw new WhoopApiError(
              'Session expired. Run "whoop auth login" to re-authenticate.',
              401,
            );
          }
        }

        // 429: rate limited
        if (error.response?.status === 429) {
          const retryAfter = Number.parseInt(
            error.response.headers['retry-after'] as string ?? '60',
            10,
          );
          throw new WhoopApiError(
            `Rate limited by WHOOP API. Retry after ${retryAfter}s.`,
            429,
            retryAfter,
          );
        }

        // 404
        if (error.response?.status === 404) {
          throw new WhoopApiError(
            'Resource not found. Check the ID and try again.',
            404,
          );
        }

        // Other 4xx
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          const body = error.response.data as Record<string, unknown> | undefined;
          const message = body?.message ?? body?.error ?? `Request failed with status ${error.response.status}`;
          throw new WhoopApiError(String(message), error.response.status);
        }

        // 5xx
        if (error.response && error.response.status >= 500) {
          throw new WhoopApiError(
            'WHOOP API server error. Please try again later.',
            error.response.status,
          );
        }

        // Network error
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response) {
          throw new WhoopApiError(
            'Could not reach WHOOP API. Check your internet connection.',
            0,
          );
        }

        throw error;
      },
    );
  }

  // --- User ---

  async getProfile(): Promise<UserBasicProfile> {
    const {data} = await this.client.get<UserBasicProfile>('/v2/user/profile/basic');
    return data;
  }

  async getBodyMeasurement(): Promise<UserBodyMeasurement> {
    const {data} = await this.client.get<UserBodyMeasurement>('/v2/user/measurement/body');
    return data;
  }

  async revokeAccess(): Promise<void> {
    await this.client.delete('/v2/user/access');
  }

  // --- Cycles ---

  async listCycles(params: ListParams = {}): Promise<PaginatedResponse<Cycle>> {
    const {data} = await this.client.get<PaginatedResponse<Cycle>>('/v2/cycle', {
      params: buildQueryParams(params),
    });
    return data;
  }

  async getCycle(cycleId: number): Promise<Cycle> {
    const {data} = await this.client.get<Cycle>(`/v2/cycle/${cycleId}`);
    return data;
  }

  async getCycleSleep(cycleId: number): Promise<Sleep> {
    const {data} = await this.client.get<Sleep>(`/v2/cycle/${cycleId}/sleep`);
    return data;
  }

  // --- Recovery ---

  async listRecoveries(params: ListParams = {}): Promise<PaginatedResponse<Recovery>> {
    const {data} = await this.client.get<PaginatedResponse<Recovery>>('/v2/recovery', {
      params: buildQueryParams(params),
    });
    return data;
  }

  async getCycleRecovery(cycleId: number): Promise<Recovery> {
    const {data} = await this.client.get<Recovery>(`/v2/cycle/${cycleId}/recovery`);
    return data;
  }

  // --- Sleep ---

  async listSleeps(params: ListParams = {}): Promise<PaginatedResponse<Sleep>> {
    const {data} = await this.client.get<PaginatedResponse<Sleep>>('/v2/activity/sleep', {
      params: buildQueryParams(params),
    });
    return data;
  }

  async getSleep(sleepId: string): Promise<Sleep> {
    const {data} = await this.client.get<Sleep>(`/v2/activity/sleep/${sleepId}`);
    return data;
  }

  // --- Workouts ---

  async listWorkouts(params: ListParams = {}): Promise<PaginatedResponse<Workout>> {
    const {data} = await this.client.get<PaginatedResponse<Workout>>('/v2/activity/workout', {
      params: buildQueryParams(params),
    });
    return data;
  }

  async getWorkout(workoutId: string): Promise<Workout> {
    const {data} = await this.client.get<Workout>(`/v2/activity/workout/${workoutId}`);
    return data;
  }
}

function buildQueryParams(params: ListParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.start) query.start = params.start;
  if (params.end) query.end = params.end;
  if (params.nextToken) query.nextToken = params.nextToken;
  return query;
}

// OAuth helpers (used by auth commands, not via the interceptor-equipped client)

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const {data} = await axios.post(`${OAUTH_BASE}/token`, params.toString(), {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  });

  return data;
}

export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement',
    state,
  });

  return `${OAUTH_BASE}/auth?${params.toString()}`;
}

// Singleton
let apiInstance: WhoopApi | null = null;

export function getApi(): WhoopApi {
  if (!apiInstance) {
    apiInstance = new WhoopApi();
  }
  return apiInstance;
}

export function resetApi(): void {
  apiInstance = null;
}
