import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PwaUpdateBanner } from '../src/components/pwa-update-banner';
import { OfflineStatusBanner } from '../src/components/offline-status-banner';
import { OfflineClient } from '../src/app/offline/offline-client';
import {
  checkAppMinVersion,
  _resetPwaManagerState,
} from '../src/lib/pwa-manager';
import {
  setSharedSession,
  clearSharedSession,
} from '../src/lib/auth-session';
import { Role, AgeSegment } from '@englove/shared';

describe('PWA & Offline Banners Segment Copy (SPEC-09 §7, RF-7, P2-10)', () => {
  let mockStorage: Record<string, string> = {};
  let mockAttrs: Record<string, string> = {};
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    mockStorage = {};
    mockAttrs = {};
    _resetPwaManagerState();
    clearSharedSession();

    globalThis.window = {
      localStorage: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = String(val);
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { reload: () => {} },
    } as unknown as Window & typeof globalThis;

    globalThis.document = {
      documentElement: {
        getAttribute: (attr: string) => mockAttrs[attr] ?? null,
        setAttribute: (attr: string, val: string) => {
          mockAttrs[attr] = String(val);
        },
        removeAttribute: (attr: string) => {
          delete mockAttrs[attr];
        },
      },
    } as unknown as Document;

    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      globalThis.document = originalDocument;
    }
    vi.restoreAllMocks();
  });

  describe('PwaUpdateBanner', () => {
    it('returns null when no update is needed', () => {
      const html = renderToString(<PwaUpdateBanner />);
      expect(html).toBe('');
    });

    it('renders Kids copy by default when update is triggered', () => {
      checkAppMinVersion('99.0.0');
      const html = renderToString(<PwaUpdateBanner />);

      expect(html).toContain('¡Englove tiene novedades! Toca Actualizar para verlas.');
      expect(html).toContain('Actualizar');
      expect(html).not.toContain('Hay una actualización disponible.');
      expect(html).not.toContain('Reiniciar y actualizar');
    });

    it('renders Teens copy when student has ageSegment teens', () => {
      setSharedSession({
        user: {
          id: 'u-teen',
          name: 'Teen User',
          email: 'teen@englove.edu',
          role: Role.student,
        },
        student: {
          id: 's-teen',
          ageSegment: AgeSegment.teens,
          canSwitchInterface: false,
        },
      });

      checkAppMinVersion('99.0.0');
      const html = renderToString(<PwaUpdateBanner />);

      expect(html).toContain('Hay una actualización disponible. La aplicación necesita reiniciarse para aplicar los cambios.');
      expect(html).toContain('Reiniciar y actualizar');
      expect(html).not.toContain('¡Englove tiene novedades!');
    });

    it('renders Teacher (panel) copy when user has teacher role', () => {
      setSharedSession({
        user: {
          id: 'u-teach',
          name: 'Teacher User',
          email: 'teacher@englove.edu',
          role: Role.teacher,
        },
        student: null,
      });

      checkAppMinVersion('99.0.0');
      const html = renderToString(<PwaUpdateBanner />);

      expect(html).toContain('Hay una actualización disponible. La aplicación necesita reiniciarse para aplicar los cambios.');
      expect(html).toContain('Reiniciar y actualizar');
      expect(html).not.toContain('¡Englove tiene novedades!');
    });

    it('renders Teacher copy when user has admin role', () => {
      setSharedSession({
        user: {
          id: 'u-admin',
          name: 'Admin User',
          email: 'admin@englove.edu',
          role: Role.admin,
        },
        student: null,
      });

      checkAppMinVersion('99.0.0');
      const html = renderToString(<PwaUpdateBanner />);

      expect(html).toContain('Hay una actualización disponible.');
      expect(html).toContain('Reiniciar y actualizar');
      expect(html).not.toContain('¡Englove tiene novedades!');
    });

    it('renders Teacher copy when pathname is a panel route', () => {
      (globalThis.window as unknown as { location: { pathname: string } }).location = {
        pathname: '/alumnos',
      };

      checkAppMinVersion('99.0.0');
      const html = renderToString(<PwaUpdateBanner />);

      expect(html).toContain('Hay una actualización disponible.');
      expect(html).toContain('Reiniciar y actualizar');
      expect(html).not.toContain('¡Englove tiene novedades!');
    });
  });

  describe('OfflineStatusBanner', () => {
    it('returns null when online with no pending items', () => {
      const html = renderToString(<OfflineStatusBanner />);
      expect(html).toBe('');
    });

    it('renders Kids offline copy by default when offline', () => {
      const html = renderToString(
        <OfflineStatusBanner
          initialStatus={{
            isOffline: true,
            pendingCount: 0,
            isFlushing: false,
            lastSyncedAt: null,
            justFlushed: false,
          }}
        />,
      );

      expect(html).toContain('Sin internet. Tus respuestas se guardan aquí mientras tanto.');
      expect(html).not.toContain('Sin conexión. Tus respuestas se guardan en este dispositivo.');
    });

    it('renders Teens offline copy when student ageSegment is teens', () => {
      setSharedSession({
        user: {
          id: 'u-teen',
          name: 'Teen',
          email: 'teen@englove.edu',
          role: Role.student,
        },
        student: {
          id: 's-teen',
          ageSegment: AgeSegment.teens,
          canSwitchInterface: false,
        },
      });

      const html = renderToString(
        <OfflineStatusBanner
          initialStatus={{
            isOffline: true,
            pendingCount: 0,
            isFlushing: false,
            lastSyncedAt: null,
            justFlushed: false,
          }}
        />,
      );

      expect(html).toContain('Sin conexión. Tus respuestas se guardan en este dispositivo.');
      expect(html).not.toContain('Sin internet. Tus respuestas se guardan aquí mientras tanto.');
    });

    it('renders Teacher offline copy when user role is teacher', () => {
      setSharedSession({
        user: {
          id: 'u-teach',
          name: 'Teacher',
          email: 'teacher@englove.edu',
          role: Role.teacher,
        },
        student: null,
      });

      const html = renderToString(
        <OfflineStatusBanner
          initialStatus={{
            isOffline: true,
            pendingCount: 0,
            isFlushing: false,
            lastSyncedAt: null,
            justFlushed: false,
          }}
        />,
      );

      expect(html).toContain('Sin conexión. Tus respuestas se guardan en este dispositivo.');
      expect(html).not.toContain('Sin internet. Tus respuestas se guardan aquí mientras tanto.');
    });

    it('renders Kids confirmation when justFlushed is true', () => {
      const html = renderToString(
        <OfflineStatusBanner
          initialStatus={{
            isOffline: false,
            pendingCount: 0,
            isFlushing: false,
            lastSyncedAt: Date.now(),
            justFlushed: true,
          }}
        />,
      );

      expect(html).toContain('¡Enviado!');
      expect(html).not.toContain('Tus respuestas pendientes se enviaron.');
    });

    it('renders Teens/Teacher confirmation when justFlushed is true', () => {
      mockStorage['englove_segment'] = 'teens';

      const html = renderToString(
        <OfflineStatusBanner
          initialStatus={{
            isOffline: false,
            pendingCount: 0,
            isFlushing: false,
            lastSyncedAt: Date.now(),
            justFlushed: true,
          }}
        />,
      );

      expect(html).toContain('Tus respuestas pendientes se enviaron.');
      expect(html).not.toContain('¡Enviado!');
    });
  });

  describe('OfflineClient', () => {
    it('renders Kids offline copy when unauthenticated', () => {
      const html = renderToString(<OfflineClient />);

      expect(html).toContain('¡Ups! No hay internet');
      expect(html).toContain('¡Ups! No hay internet. Revisa la conexión y vuelve a intentarlo.');
      expect(html).not.toContain('Sin conexión. Revisa tu red e inténtalo de nuevo.');
    });

    it('renders Teens offline copy when stored in localStorage', () => {
      mockStorage['englove_segment'] = 'teens';
      const html = renderToString(<OfflineClient />);

      expect(html).toContain('Sin conexión');
      expect(html).toContain('Sin conexión. Revisa tu red e inténtalo de nuevo.');
      expect(html).not.toContain('¡Ups! No hay internet');
    });

    it('renders Teacher offline copy when stored in localStorage', () => {
      mockStorage['englove_segment'] = 'teacher';
      const html = renderToString(<OfflineClient />);

      expect(html).toContain('Sin conexión');
      expect(html).toContain('Sin conexión. Revisa tu red e inténtalo de nuevo.');
      expect(html).not.toContain('¡Ups! No hay internet');
    });
  });
});
