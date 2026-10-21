import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

describe('RF-17: proxy routing and redirect logic', () => {
  it('allows static assets and assets with extensions to pass through', async () => {
    const req = new NextRequest('http://localhost:3000/_next/static/chunk.js');
    const res = await proxy(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows public routes like / without redirecting to login', async () => {
    const req = new NextRequest('http://localhost:3000/');
    const res = await proxy(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated private route to /login with next query param', async () => {
    const req = new NextRequest('http://localhost:3000/inicio');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?next=%2Finicio');
  });

  it('does not append next if next would be a public auth route', async () => {
    const req = new NextRequest('http://localhost:3000/login');
    const res = await proxy(req);
    // /login is a public route, should not redirect unauthenticated user
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects authenticated user on public auth route to /inicio', async () => {
    const req = new NextRequest('http://localhost:3000/login', {
      headers: {
        cookie: 'englove_access_token=valid-jwt-token',
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/inicio');
  });

  it('allows authenticated user on private route to pass through', async () => {
    const req = new NextRequest('http://localhost:3000/inicio', {
      headers: {
        cookie: 'englove_access_token=valid-jwt-token',
      },
    });
    const res = await proxy(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('supports custom COOKIE_PREFIX or standard access_token fallback', async () => {
    const req = new NextRequest('http://localhost:3000/registro', {
      headers: {
        cookie: 'access_token=valid-token',
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/inicio');
  });

  it('preserves query parameters in next parameter when redirecting private routes', async () => {
    const req = new NextRequest('http://localhost:3000/actividades/123?level=A1&page=2');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?next=%2Factividades%2F123%3Flevel%3DA1%26page%3D2');
  });

  it('rejects open-redirect attempts with backslashes without setting next param', async () => {
    const req = new NextRequest('http://localhost:3000/\\evil.com');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    // Location redirects to /login without any next query param
    expect(location).toBe('http://localhost:3000/login');
  });
});
