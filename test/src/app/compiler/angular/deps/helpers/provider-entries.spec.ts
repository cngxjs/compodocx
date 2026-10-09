import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { SymbolHelper } from '../../../../../../../src/app/compiler/angular/deps/helpers/symbol-helper';

/** The entries of the `providers` array in `@Component({ providers: [...] })`. */
const entriesOf = (providers: string) => {
    const source = ts.createSourceFile(
        'panel.ts',
        `@Component({ providers: [${providers}] })\nexport class Panel {}\n`,
        ts.ScriptTarget.Latest,
        true
    );
    const decorated = source.statements.find(ts.isClassDeclaration);
    const decorator = ts.getDecorators(decorated!)![0];
    const options = (decorator.expression as ts.CallExpression)
        .arguments[0] as ts.ObjectLiteralExpression;
    return new SymbolHelper().getProviderEntries(options.properties, 'providers', source);
};

describe('provider entries of a providers array', () => {
    it('records the callee and the feature calls of a provider call', () => {
        const [entry] = entriesOf(`provideFoo(withMode('wide'), withExtras({}), 'label')`);
        expect(entry.call).toEqual({ callee: 'provideFoo', args: ['withMode', 'withExtras'] });
        expect(entry.kind).toBe('class');
        // `name` keeps the printed source of the existing element parser.
        expect(entry.name.startsWith('provideFoo(')).toBe(true);
    });

    it('records the callee of a spread call without arguments', () => {
        const [entry] = entriesOf('...provideFoo(withMode())');
        expect(entry.call).toEqual({ callee: 'provideFoo', args: [] });
    });

    it('sets no call on class and object providers', () => {
        const entries = entriesOf('FooService, { provide: FOO, useValue: 1 }');
        expect(entries).toHaveLength(2);
        for (const entry of entries) {
            expect(entry).not.toHaveProperty('call');
        }
    });
});
