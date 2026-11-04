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

  it('allows public routes like /recuperar and /restablecer without redirecting to login', async () => {
    const reqRecuperar = new NextRequest('http://localhost:3000/recuperar');
    const resRecuperar = await proxy(reqRecuperar);
    expect(resRecuperar.headers.get('location')).toBeNull();

    const reqReset = new NextRequest('http://localhost:3000/restablecer/sample-token');
    const resReset = await proxy(reqReset);
    expect(resReset.headers.get('location')).toBeNull();
  });

  it('rejects open-redirect attempts with backslashes without setting next param', async () => {
    const req = new NextRequest('http://localhost:3000/\\evil.com');
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    // Location redirects to /login without any next query param
    expect(location).toBe('http://localhost:3000/login');
  });

  it('redirects authenticated user on root / to /inicio', async () => {
    const req = new NextRequest('http://localhost:3000/', {
      headers: {
        cookie: 'englove_access_token=valid-jwt-token',
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/inicio');
  });

  it('redirects student accessing teacher routes like /alumnos to /inicio', async () => {
    const studentPayload = Buffer.from(JSON.stringify({ role: 'student' })).toString('base64url');
    const studentToken = `header.${studentPayload}.sig`;
    const req = new NextRequest('http://localhost:3000/alumnos', {
      headers: {
        cookie: `englove_access_token=${studentToken}`,
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/inicio');
  });

  it('redirects teacher accessing student routes like /perfil to /inicio', async () => {
    const teacherPayload = Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url');
    const teacherToken = `header.${teacherPayload}.sig`;
    const req = new NextRequest('http://localhost:3000/perfil', {
      headers: {
        cookie: `englove_access_token=${teacherToken}`,
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/inicio');
  });

  it('allows teacher to access /actividades and /actividades/nueva without redirecting', async () => {
    const teacherPayload = Buffer.from(JSON.stringify({ role: 'teacher' })).toString('base64url');
    const teacherToken = `header.${teacherPayload}.sig`;
    const req = new NextRequest('http://localhost:3000/actividades', {
      headers: {
        cookie: `englove_access_token=${teacherToken}`,
      },
    });
    const res = await proxy(req);
    expect(res.headers.get('location')).toBeNull();

    const reqNueva = new NextRequest('http://localhost:3000/actividades/nueva', {
      headers: {
        cookie: `englove_access_token=${teacherToken}`,
      },
    });
    const resNueva = await proxy(reqNueva);
    expect(resNueva.headers.get('location')).toBeNull();
  });

  it('redirects student accessing /actividades to /inicio but allows /actividad/123', async () => {
    const studentPayload = Buffer.from(JSON.stringify({ role: 'student' })).toString('base64url');
    const studentToken = `header.${studentPayload}.sig`;
    const reqTeacherSection = new NextRequest('http://localhost:3000/actividades', {
      headers: {
        cookie: `englove_access_token=${studentToken}`,
      },
    });
    const resTeacherSection = await proxy(reqTeacherSection);
    expect(resTeacherSection.status).toBe(307);
    expect(resTeacherSection.headers.get('location')).toContain('/inicio');

    const reqStudentRunner = new NextRequest('http://localhost:3000/actividad/attempt-123', {
      headers: {
        cookie: `englove_access_token=${studentToken}`,
      },
    });
    const resStudentRunner = await proxy(reqStudentRunner);
    expect(resStudentRunner.headers.get('location')).toBeNull();
  });

  it('allows unauthenticated access to PWA assets and /offline per RF-1', async () => {
    const urls = [
      'http://localhost:3000/manifest.webmanifest',
      'http://localhost:3000/manifest.json',
      'http://localhost:3000/sw.js',
      'http://localhost:3000/icons/icon-192.png',
      'http://localhost:3000/icons/icon-512.png',
      'http://localhost:3000/offline',
    ];
    for (const url of urls) {
      const req = new NextRequest(url);
      const res = await proxy(req);
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('allows authenticated access to /offline without redirecting to /inicio', async () => {
    const req = new NextRequest('http://localhost:3000/offline', {
      headers: {
        cookie: 'englove_access_token=valid-token',
      },
    });
    const res = await proxy(req);
    expect(res.headers.get('location')).toBeNull();
  });
});
