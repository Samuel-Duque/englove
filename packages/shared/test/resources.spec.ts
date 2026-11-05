import { describe, it, expect } from 'vitest';
import {
  isValidHttpsResourceUrl,
  ExternalResourceItem,
  ExternalResourceListResponse,
  Level,
} from '../src';

describe('SPEC-10: shared/resources - isValidHttpsResourceUrl and contracts', () => {
  it('accepts valid https URLs without credentials', () => {
    expect(isValidHttpsResourceUrl('https://es.educaplay.com/recursos/123')).toBe(true);
    expect(isValidHttpsResourceUrl('https://sub.domain.org/path/to/page?query=true#hash')).toBe(true);
    expect(isValidHttpsResourceUrl('https://example.com/')).toBe(true);
    expect(isValidHttpsResourceUrl('  https://example.com/trimmed   ')).toBe(true);
  });

  it('rejects insecure protocols (http, javascript, data, file)', () => {
    expect(isValidHttpsResourceUrl('http://insecure.com')).toBe(false);
    expect(isValidHttpsResourceUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpsResourceUrl('data:text/html,<div>test</div>')).toBe(false);
    expect(isValidHttpsResourceUrl('file:///etc/passwd')).toBe(false);
    expect(isValidHttpsResourceUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects URLs containing embedded credentials', () => {
    expect(isValidHttpsResourceUrl('https://user:pass@example.com')).toBe(false);
    expect(isValidHttpsResourceUrl('https://admin@example.com/resource')).toBe(false);
  });

  it('rejects URLs with whitespace inside or empty/missing host', () => {
    expect(isValidHttpsResourceUrl('https://example.com/path with spaces')).toBe(false);
    expect(isValidHttpsResourceUrl('https://')).toBe(false);
    expect(isValidHttpsResourceUrl('https:///')).toBe(false);
  });

  it('rejects non-string inputs, empty strings, and strings exceeding 2048 characters', () => {
    expect(isValidHttpsResourceUrl('')).toBe(false);
    expect(isValidHttpsResourceUrl('   ')).toBe(false);
    expect(isValidHttpsResourceUrl(null)).toBe(false);
    expect(isValidHttpsResourceUrl(undefined)).toBe(false);
    expect(isValidHttpsResourceUrl(12345)).toBe(false);
    expect(isValidHttpsResourceUrl({ url: 'https://test.com' })).toBe(false);

    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    expect(isValidHttpsResourceUrl(longUrl)).toBe(false);
  });

  it('conforms to ExternalResourceItem type shape', () => {
    const item: ExternalResourceItem = {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Animals Memory',
      url: 'https://es.educaplay.com/recursos/123',
      description: 'Actividad de repaso',
      level: Level.A1,
      position: 0,
      createdBy: '00000000-0000-4000-8000-000000000099',
      createdAt: '2026-11-04T12:00:00.000Z',
      updatedAt: '2026-11-04T12:00:00.000Z',
    };

    const list: ExternalResourceListResponse = {
      items: [item],
      total: 1,
    };

    expect(list.items).toHaveLength(1);
    expect(list.total).toBe(1);
    expect(list.items[0].level).toBe('A1');
  });
});
