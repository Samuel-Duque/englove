import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SPEC-11 RF-7, SPEC-09 RF-3, RF-4, Decisión 118, 135: Serwist Service Worker Build Output', () => {
  const distClientDir = path.resolve(__dirname, '../dist/client');
  const swPath = path.resolve(distClientDir, 'sw.js');

  it('generates dist/client/sw.js build artifact', () => {
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it('keeps service worker bundle size well below 3 MB worker limit', () => {
    const stats = fs.statSync(swPath);
    const sizeInMb = stats.size / (1024 * 1024);
    expect(sizeInMb).toBeLessThan(3.0);
    // Real build is ~41 KB
    expect(stats.size).toBeLessThan(100 * 1024);
  });

  it('does NOT contain legacy manual public/sw.js code (englove-static-v1)', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content).not.toContain('englove-static-v1');
    expect(content).not.toContain('CACHE_VERSION');
  });

  it('does NOT precache sw.js itself', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content.includes('url:`sw.js`') || content.includes('url:"sw.js"')).toBe(false);
  });

  it('contains Serwist precache manifest with /offline, manifest, favicon, and chunks', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content).toContain('/offline');
    expect(content).toContain('manifest.webmanifest');
    expect(content).toContain('favicon.ico');
    expect(content).toContain('_next/static');
  });

  it('implements NetworkOnly for API requests and media / R2 signed URLs', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content).toContain('/api/');
    expect(content).toContain('r2.cloudflarestorage.com');
    expect(content).toContain('X-Amz-Signature');
    expect(content).toContain('X-Amz-Algorithm');
  });

  it('implements NetworkOnly for React Server Component (RSC) requests and never caches them', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content).toContain('_rsc');
    expect(content).toContain('RSC');
    // Must NOT contain catch-all others or apis caches that could cache RSC or authenticated responses
    expect(content).not.toContain('cacheName:`others`');
    expect(content).not.toContain('cacheName:"others"');
    expect(content).not.toContain('cacheName:`apis`');
    expect(content).not.toContain('cacheName:"apis"');
    expect(content).not.toContain('cacheName:`static-data-assets`');
    expect(content).not.toContain('cacheName:"static-data-assets"');
  });

  it('implements navigation fallback to cached /offline page', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content).toContain('matchPrecache');
    expect(content).toContain('/offline');
  });

  it('implements manual SKIP_WAITING message listener for PwaUpdateBanner cycle', () => {
    const content = fs.readFileSync(swPath, 'utf8');
    expect(content).toContain('SKIP_WAITING');
    expect(content).toContain('skipWaiting');
  });
});
