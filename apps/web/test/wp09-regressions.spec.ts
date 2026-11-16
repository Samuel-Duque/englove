import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const webSrc = path.join(webRoot, 'src');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('WP-09: Regresiones de redirecciones, cero as Type y limpieza web', () => {
  it('mantiene las 4 redirecciones heredadas tras eliminar apps/web/next.config.ts', async () => {
    const { default: RecuperarRedirectPage } = await import(
      '../src/app/(public)/recuperar/page'
    );
    const { default: ContenidosRedirectPage } = await import(
      '../src/app/(teacher)/contenidos/page'
    );
    const { default: ContenidosOnboardingRedirectPage } = await import(
      '../src/app/(teacher)/contenidos/onboarding/page'
    );
    const { default: JuegoActivityRedirectPage } = await import(
      '../src/app/(student)/juegos/[activityId]/page'
    );

    expect(() => RecuperarRedirectPage()).toThrow('NEXT_REDIRECT:/recuperar-contrasena');
    expect(() => ContenidosRedirectPage()).toThrow('NEXT_REDIRECT:/actividades');
    expect(() => ContenidosOnboardingRedirectPage()).toThrow(
      'NEXT_REDIRECT:/actividades/nueva',
    );
    expect(() => JuegoActivityRedirectPage()).toThrow('NEXT_REDIRECT:/juegos');
  });

  it('elimina apps/web/next.config.ts, public/sw.js manual y barril muerto components/activities/index.ts', () => {
    expect(fs.existsSync(path.join(webRoot, 'next.config.ts'))).toBe(false);
    expect(fs.existsSync(path.join(webRoot, 'public', 'sw.js'))).toBe(false);
    expect(
      fs.existsSync(path.join(webSrc, 'components', 'activities', 'index.ts')),
    ).toBe(false);
  });

  it('garantiza cero aserciones "as Type" o "<Type>expr" fuera de as const y las 2 líneas justificadas de api.ts', () => {
    const assertions: Array<{ file: string; line: number; text: string }> = [];

    for (const file of collectTsFiles(webSrc)) {
      const code = fs.readFileSync(file, 'utf8');
      const kind = file.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : file.endsWith('.jsx')
          ? ts.ScriptKind.JSX
          : file.endsWith('.ts')
            ? ts.ScriptKind.TS
            : ts.ScriptKind.JS;
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);

      const visit = (node: ts.Node) => {
        if (ts.isAsExpression(node)) {
          const isConst =
            ts.isTypeReferenceNode(node.type) &&
            ts.isIdentifier(node.type.typeName) &&
            node.type.typeName.text === 'const';
          if (!isConst) {
            const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            assertions.push({
              file: path.relative(webRoot, file).replace(/\\/g, '/'),
              line: pos.line + 1,
              text: node.getText(sf),
            });
          }
        } else if (ts.isTypeAssertionExpression(node)) {
          const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          assertions.push({
            file: path.relative(webRoot, file).replace(/\\/g, '/'),
            line: pos.line + 1,
            text: node.getText(sf),
          });
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
    }

    const unexpected = assertions.filter((a) => {
      if (a.file !== 'src/lib/api.ts') return true;
      const apiLines = fs
        .readFileSync(path.join(webSrc, 'lib', 'api.ts'), 'utf8')
        .split('\n');
      const prevLine = apiLines[a.line - 2] ?? '';
      return !prevLine.includes('guardrails-ignore G-C12:');
    });

    expect(unexpected).toEqual([]);
  }, 30_000); // QA-01: presupuesto propio para recorrer el AST de todo src.
});
