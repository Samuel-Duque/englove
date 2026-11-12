import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const services = ['activities', 'attempts', 'reviews', 'students'];
const mutationNames = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

describe('TEN-01: defensa tenant explícita en mutaciones', () => {
  it.each(services)('%s conserva organization_id en cada mutación', (service) => {
    const path = resolve(__dirname, `../src/${service}/${service}.service.ts`);
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const missing: string[] = [];
    let mutations = 0;

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && mutationNames.has(node.expression.name.text)) {
        mutations += 1;
        const args = node.arguments[0];
        const where = args && ts.isObjectLiteralExpression(args)
          ? args.properties.find((property) => ts.isPropertyAssignment(property)
            && property.name.getText(source) === 'where')
          : undefined;
        const hasTenant = where && ts.isPropertyAssignment(where)
          && ts.isObjectLiteralExpression(where.initializer)
          && where.initializer.properties.some((property) =>
            ts.isPropertyAssignment(property) && property.name.getText(source) === 'organization_id');
        if (!hasTenant) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          missing.push(`${service}:${line + 1} ${node.expression.getText(source)}`);
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
    expect(mutations).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
