import { beforeAll, describe, expect, it } from 'vitest';

import {
    emptyModel,
    factKey,
    type SemanticModel,
    type SymbolFacts
} from '../../../../src/app/compiler/semantic/model';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import {
    DiBadges,
    DiRoleBadge,
    InjectionContextBadge
} from '../../../../src/templates/components/DiBadges';
import { symbolFacts } from '../../../../src/templates/helpers/symbol-facts';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const F = 'lib/a.ts';
const facts = (name: string, di?: SymbolFacts['di']): SymbolFacts => ({
    key: { name, file: F },
    exportedBy: ['@lib/a'],
    notExported: false,
    usedBy: [],
    di
});
const di = (extra: Partial<NonNullable<SymbolFacts['di']>>) => ({
    providesTokens: [],
    readsTokens: [],
    ...extra
});

describe('dependency injection badges', () => {
    it('shows the injection-context badge for direct and indirect use alike', () => {
        for (const via of ['direct', 'call'] as const) {
            const html = InjectionContextBadge({
                facts: facts('injectFoo', di({ usesInjectionContext: via }))
            });
            expect(html).to.include('cdx-badge--injection-context');
            expect(html).to.include('>Injection context<');
            expect(html).to.include('title="Must be called in an injection context');
        }
    });

    it('shows the role from the facts, not from the name', () => {
        expect(DiRoleBadge({ facts: facts('provideFoo', di({ role: 'provider' })) })).to.include(
            '>Provider<'
        );
        expect(DiRoleBadge({ facts: facts('withBar', di({ role: 'feature' })) })).to.include(
            '>Feature<'
        );
        expect(DiRoleBadge({ facts: facts('provideNothing', di({})) })).to.equal('');
    });

    it('renders nothing without facts', () => {
        expect(DiBadges({})).to.equal('');
        expect(DiBadges({ facts: facts('format') })).to.equal('');
    });

    it('finds the facts of an engine object through the symbol table', () => {
        const table = buildSymbolTable(
            { miscellaneous: { functions: [{ name: 'provideFoo', file: F }] } },
            { cwd: '/' }
        );
        const own = facts('provideFoo', di({ role: 'provider', usesInjectionContext: 'call' }));
        const semantic: SemanticModel = {
            ...emptyModel(),
            facts: new Map([[factKey(own.key), own]])
        };
        const item = { name: 'provideFoo', file: F };
        expect(symbolFacts({ symbols: table, semantic }, 'function', item)).to.equal(own);
        expect(symbolFacts({ symbols: table }, 'function', item)).to.equal(undefined);
        expect(
            DiBadges({ facts: symbolFacts({ symbols: table, semantic }, 'function', item) })
        ).to.match(/Provider<\/span><span class="cdx-badge cdx-badge--injection-context"/);
    });
});
