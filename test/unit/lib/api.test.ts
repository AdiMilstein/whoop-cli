import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {buildAuthorizationUrl} from '../../../src/lib/api.js';

describe('buildAuthorizationUrl', () => {
  it('builds correct URL with all params', () => {
    const url = buildAuthorizationUrl('test-client-id', 'http://localhost:9876/callback', 'random-state-123');
    expect(url).toContain('https://api.prod.whoop.com/oauth/oauth2/auth?');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A9876%2Fcallback');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=random-state-123');
  });

  it('includes all required scopes', () => {
    const url = buildAuthorizationUrl('id', 'http://localhost/cb', 'state');
    expect(url).toContain('offline');
    expect(url).toContain('read%3Arecovery');
    expect(url).toContain('read%3Acycles');
    expect(url).toContain('read%3Aworkout');
    expect(url).toContain('read%3Asleep');
    expect(url).toContain('read%3Aprofile');
    expect(url).toContain('read%3Abody_measurement');
  });
});
