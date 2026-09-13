import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/workspace-data/route';
import { POST } from '@/app/api/auth/login/route';

afterEach(() => vi.unstubAllEnvs());
describe('synthetic workspace access boundary', () => {
  it('does not disclose fixture records when demo access is disabled', async () => {
    vi.stubEnv('DEMO_AUTH_ENABLED', 'false');
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('WORKSPACE_DISABLED');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('keeps demo credentials disabled independently of client state', async () => {
    vi.stubEnv('DEMO_AUTH_ENABLED', 'false');
    const response = await POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@nucleus.com', password: 'not-a-valid-password' }) }));
    expect(response.status).toBe(403);
  });
  it('rejects oversized and cross-origin demo sign-ins', async () => {
    vi.stubEnv('DEMO_AUTH_ENABLED', 'true');
    vi.stubEnv('APP_DATA_MODE', 'json');
    const oversized = await POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: 'a'.repeat(5000) }));
    expect(oversized.status).toBe(413);
    const crossOrigin = await POST(new Request('http://localhost/api/auth/login', { method: 'POST', headers: { origin: 'https://untrusted.test' }, body: '{}' }));
    expect(crossOrigin.status).toBe(403);
  });
});
