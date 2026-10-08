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
