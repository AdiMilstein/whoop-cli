import {describe, it, expect, vi, beforeAll, afterAll, afterEach, type Mock} from 'vitest';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {WhoopApi, WhoopApiError} from '../../../src/lib/api.js';

const BASE_URL = 'https://api.prod.whoop.com/developer';

// Mock the auth module so we can control getValidToken per-test
vi.mock('../../../src/lib/auth.js', () => ({
  getValidToken: vi.fn(),
}));

// Import the mock after vi.mock so we get the mocked version
const {getValidToken} = await import('../../../src/lib/auth.js');
const mockGetValidToken = getValidToken as Mock;

const server = setupServer();

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('WhoopApi interceptors', () => {
  describe('request interceptor', () => {
    it('injects Authorization header on successful request', async () => {
      mockGetValidToken.mockResolvedValue('test-token-abc');

      const profileData = {user_id: 123, first_name: 'Test', last_name: 'User'};

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, ({request}) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader !== 'Bearer test-token-abc') {
            return HttpResponse.json({error: 'unauthorized'}, {status: 401});
          }
          return HttpResponse.json(profileData);
        }),
      );

      const api = new WhoopApi();
      const result = await api.getProfile();

      expect(result).toEqual(profileData);
      expect(mockGetValidToken).toHaveBeenCalledOnce();
    });
  });

  describe('response interceptor', () => {
    it('401 -> refresh -> retry succeeds', async () => {
      let requestCount = 0;

      // Flow:
      // 1. Request interceptor calls getValidToken() -> 'stale-token'
      // 2. Server returns 401
      // 3. Response interceptor calls getValidToken(true) -> 'fresh-token'
      //    Sets Authorization header to 'Bearer fresh-token'
      // 4. this.client.request(config) triggers request interceptor again
      //    which calls getValidToken() -> 'fresh-token' (overwrites header, same value)
      // 5. Server sees 'Bearer fresh-token' and returns 200
      mockGetValidToken
        .mockResolvedValueOnce('stale-token')   // step 1: initial request interceptor
        .mockResolvedValueOnce('fresh-token')   // step 3: force refresh in response interceptor
        .mockResolvedValueOnce('fresh-token');  // step 4: request interceptor on retry

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, ({request}) => {
          requestCount++;
          const authHeader = request.headers.get('Authorization');

          if (authHeader === 'Bearer stale-token') {
            return HttpResponse.json({error: 'unauthorized'}, {status: 401});
          }

          if (authHeader === 'Bearer fresh-token') {
            return HttpResponse.json({user_id: 42});
          }

          return HttpResponse.json({error: 'unexpected'}, {status: 500});
        }),
      );

      const api = new WhoopApi();
      const result = await api.getProfile();

      expect(result).toEqual({user_id: 42});
      // 3 calls: initial request interceptor, force refresh, retry request interceptor
      expect(mockGetValidToken).toHaveBeenCalledTimes(3);
      // The second call should be the force refresh (called with true)
      expect(mockGetValidToken).toHaveBeenNthCalledWith(2, true);
      // 2 HTTP requests: original (401) + retry (200)
      expect(requestCount).toBe(2);
    });

    it('401 -> retry also fails -> throws WhoopApiError(401)', async () => {
      // Flow:
      // 1. Request interceptor calls getValidToken() -> 'stale-token'
      // 2. Server returns 401
      // 3. Response interceptor calls getValidToken(true) -> throws Error
      // 4. catch block throws WhoopApiError(401)
      mockGetValidToken
        .mockResolvedValueOnce('stale-token')
        .mockRejectedValueOnce(new Error('refresh failed'));

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, () => {
          return HttpResponse.json({error: 'unauthorized'}, {status: 401});
        }),
      );

      const api = new WhoopApi();

      try {
        await api.getProfile();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WhoopApiError);
        const apiError = error as WhoopApiError;
        expect(apiError.statusCode).toBe(401);
        expect(apiError.message).toBe('Session expired. Run "whoop auth login" to re-authenticate.');
      }
    });

    it('429 with retry-after header -> throws WhoopApiError(429) with retryAfter', async () => {
      mockGetValidToken.mockResolvedValue('valid-token');

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, () => {
          return HttpResponse.json(
            {error: 'rate limited'},
            {status: 429, headers: {'retry-after': '30'}},
          );
        }),
      );

      const api = new WhoopApi();

      try {
        await api.getProfile();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WhoopApiError);
        const apiError = error as WhoopApiError;
        expect(apiError.statusCode).toBe(429);
        expect(apiError.retryAfter).toBe(30);
        expect(apiError.message).toContain('Retry after 30s');
      }
    });

    it('429 without retry-after header -> defaults to 60s', async () => {
      mockGetValidToken.mockResolvedValue('valid-token');

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, () => {
          return HttpResponse.json({error: 'rate limited'}, {status: 429});
        }),
      );

      const api = new WhoopApi();

      try {
        await api.getProfile();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WhoopApiError);
        const apiError = error as WhoopApiError;
        expect(apiError.statusCode).toBe(429);
        expect(apiError.retryAfter).toBe(60);
        expect(apiError.message).toContain('Retry after 60s');
      }
    });

    it('404 -> throws WhoopApiError(404)', async () => {
      mockGetValidToken.mockResolvedValue('valid-token');

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, () => {
          return HttpResponse.json({error: 'not found'}, {status: 404});
        }),
      );

      const api = new WhoopApi();

      try {
        await api.getProfile();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WhoopApiError);
        const apiError = error as WhoopApiError;
        expect(apiError.statusCode).toBe(404);
        expect(apiError.message).toBe('Resource not found. Check the ID and try again.');
      }
    });

    it('500 -> throws WhoopApiError(500)', async () => {
      mockGetValidToken.mockResolvedValue('valid-token');

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, () => {
          return HttpResponse.json({error: 'internal server error'}, {status: 500});
        }),
      );

      const api = new WhoopApi();

      try {
        await api.getProfile();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WhoopApiError);
        const apiError = error as WhoopApiError;
        expect(apiError.statusCode).toBe(500);
        expect(apiError.message).toBe('WHOOP API server error. Please try again later.');
      }
    });

    it('network error -> throws WhoopApiError(0)', async () => {
      mockGetValidToken.mockResolvedValue('valid-token');

      server.use(
        http.get(`${BASE_URL}/v2/user/profile/basic`, () => {
          return HttpResponse.error();
        }),
      );

      const api = new WhoopApi();

      try {
        await api.getProfile();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WhoopApiError);
        const apiError = error as WhoopApiError;
        expect(apiError.statusCode).toBe(0);
        expect(apiError.message).toBe('Could not reach WHOOP API. Check your internet connection.');
      }
    });
  });
});
