import { describe, expect, it } from 'vitest';
import { buildEntityIndex } from '../../../src/utils/entity-index.util';
import { pageOf } from '../helpers/pages';

describe('buildEntityIndex — miscellaneous entries', () => {
    it('routes untagged misc entries to anchor on collection page', () => {
        const index = buildEntityIndex({
            miscellaneous: {
                functions: [{ name: 'helperFn' }],
                variables: [{ name: 'VERSION' }],
                typealiases: [{ name: 'Maybe' }],
                enumerations: [{ name: 'Theme' }]
            }
        });
        expect(index['helperFn'].href).to.equal(pageOf('function', 'helperFn'));
        expect(index['VERSION'].href).to.equal(pageOf('variable', 'VERSION'));
        expect(index['Maybe'].href).to.equal(pageOf('typealias', 'Maybe'));
        expect(index['Theme'].href).to.equal(pageOf('enumeration', 'Theme'));
    });

    it('routes @category-tagged misc entries to a dedicated detail page', () => {
        const index = buildEntityIndex({
            miscellaneous: {
                functions: [{ name: 'provideToaster', category: 'Toast' }],
                variables: [{ name: 'TOAST_TOKEN', category: 'Toast' }],
                typealiases: [{ name: 'ToastConfig', category: 'Toast' }],
                enumerations: [{ name: 'ToastPosition', category: 'Toast' }]
            }
        });
        expect(index['provideToaster'].href).to.equal(pageOf('function', 'provideToaster'));
        expect(index['TOAST_TOKEN'].href).to.equal(pageOf('variable', 'TOAST_TOKEN'));
        expect(index['ToastConfig'].href).to.equal(pageOf('typealias', 'ToastConfig'));
        expect(index['ToastPosition'].href).to.equal(pageOf('enumeration', 'ToastPosition'));
    });

    it('treats whitespace-only `category` as untagged', () => {
        const index = buildEntityIndex({
            miscellaneous: {
                functions: [{ name: 'whitespaceCat', category: '   ' }]
            }
        });
        expect(index['whitespaceCat'].href).to.equal(pageOf('function', 'whitespaceCat'));
    });

    it('keeps the kind discriminator on every misc entry', () => {
        const index = buildEntityIndex({
            miscellaneous: {
                functions: [{ name: 'fn', category: 'X' }],
                variables: [{ name: 'v' }],
                typealiases: [{ name: 't' }],
                enumerations: [{ name: 'e' }]
            }
        });
        expect(index['fn'].kind).to.equal('function');
        expect(index['v'].kind).to.equal('variable');
        expect(index['t'].kind).to.equal('typealias');
        expect(index['e'].kind).to.equal('enum');
    });
});

describe('buildEntityIndex — route entries', () => {
    const node = (id: string, fullPath: string, children: unknown[] = []) => ({
        id,
        path: null,
        fullPath,
        children,
        guards: {},
        resolve: [],
        providers: [],
        file: 'routes.ts',
        line: 1
    });
    const routing = {
        roots: [
            {
                id: '0',
                kind: 'router',
                bootstraps: [],
                features: [],
                routes: [
                    node('0-0', '/users', [node('0-0-0', '/users/:id')]),
                    node('0-1', '/users')
                ]
            }
        ],
        count: 3,
        byTarget: new Map(),
        mountedAt: new Map(),
        notes: []
    };

    it('adds one entry per distinct full path, linking its first row on the routes page', () => {
        const index = buildEntityIndex({ routing });
        expect(index['route:/users']).toEqual({ href: 'routes.html#route-0-0', kind: 'route' });
        expect(index['route:/users/:id']).toEqual({
            href: 'routes.html#route-0-0-0',
            kind: 'route'
        });
        expect(Object.keys(index).filter(key => key.startsWith('route:'))).toHaveLength(2);
    });

    it('adds none with routes disabled', () => {
        const index = buildEntityIndex({ routing, disableRoutes: true });
        expect(Object.keys(index).some(key => key.startsWith('route:'))).toBe(false);
    });
});
