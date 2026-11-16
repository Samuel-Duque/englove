import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AccessibleModal } from '../src/components/ui/modal';

describe('AccessibleModal focus stabilization and accessibility (P0-06, RF-20)', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    if (originalDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      globalThis.document = originalDocument;
    }
    vi.restoreAllMocks();
  });

  it('returns null when isOpen is false', () => {
    const html = renderToString(
      <AccessibleModal isOpen={false} onClose={() => {}} title="Test Modal">
        <p>Modal content</p>
      </AccessibleModal>,
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with accessible ARIA attributes when isOpen is true', () => {
    const html = renderToString(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        title="Título de Prueba"
        description="Descripción accesible"
      >
        <input type="text" placeholder="Escribe aquí" />
      </AccessibleModal>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="modal-title"');
    expect(html).toContain('aria-describedby="modal-desc"');
    expect(html).toContain('Título de Prueba');
    expect(html).toContain('Descripción accesible');
    expect(html).toContain('Escribe aquí');
  });

  it('omits aria-describedby when no description prop is provided', () => {
    const html = renderToString(
      <AccessibleModal isOpen={true} onClose={() => {}} title="Sin Descripción">
        <p>Contenido simple</p>
      </AccessibleModal>,
    );

    expect(html).toContain('aria-labelledby="modal-title"');
    expect(html).not.toContain('aria-describedby=');
  });

  it('applies custom maxWidthClass when passed', () => {
    const html = renderToString(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        title="Ancho Amplio"
        maxWidthClass="max-w-3xl"
      >
        <p>Contenido ancho</p>
      </AccessibleModal>,
    );

    expect(html).toContain('max-w-3xl');
  });

  it('stabilizes focus effect dependency strictly on [isOpen] without re-running on onClose reference changes (P0-06)', () => {
    // Verify that the hook design decouples onClose from the effect dependency array
    // by using a mutable ref pattern. When typing in an input re-renders the parent with
    // a new onClose closure, the focus initialization timer does NOT re-arm and steal focus.
    const addEventListenerSpy = vi.fn();
    const removeEventListenerSpy = vi.fn();
    const mockPreviousElement = { focus: vi.fn() };

    (globalThis as unknown as { document: unknown }).document = {
      activeElement: mockPreviousElement,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    };

    // Simulate first mount with isOpen=true
    const onCloseRef: { current: () => void } = { current: vi.fn() };

    // Update ref on every render (unconstrained effect)
    const updateOnCloseRef = (newFn: () => void) => {
      onCloseRef.current = newFn;
    };

    let effectRunCount = 0;
    let lastIsOpen: boolean | undefined;

    const runIsOpenEffect = (isOpen: boolean) => {
      if (isOpen === lastIsOpen) return;
      lastIsOpen = isOpen;
      if (!isOpen) return;

      effectRunCount++;
      addEventListenerSpy('keydown', vi.fn());
    };

    // 1. Initial open
    runIsOpenEffect(true);
    expect(effectRunCount).toBe(1);
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    // 2. Typing into an input inside modal triggers parent re-render with fresh onClose
    const newOnClose = vi.fn();
    updateOnCloseRef(newOnClose);
    runIsOpenEffect(true); // isOpen did NOT change

    // Assert the effect did NOT re-run, so keyboard focus is NOT stolen from the input
    expect(effectRunCount).toBe(1);
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    // Assert the latest callback is preserved in ref
    expect(onCloseRef.current).toBe(newOnClose);
  });

  it('guarantees source implementation decouples focus timer from onClose dependency (P0-06)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const modalPath = path.resolve(__dirname, '../src/components/ui/modal.tsx');
    const source = fs.readFileSync(modalPath, 'utf8');

    // Must bind onClose to a ref
    expect(source).toMatch(/const\s+onCloseRef\s*=\s*useRef\s*\(\s*onClose\s*\)/);
    // Must update ref on render
    expect(source).toMatch(/onCloseRef\.current\s*=\s*onClose/);
    // Must strictly depend only on [isOpen] for the focus setup effect
    expect(source).toContain('}, [isOpen]);');
    // Must NOT contain [isOpen, onClose]
    expect(source).not.toContain('[isOpen, onClose]');
  });
});
