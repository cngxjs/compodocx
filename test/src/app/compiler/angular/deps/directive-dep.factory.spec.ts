import { DirectiveDepFactory } from '../../../../../../src/app/compiler/angular/deps/directive-dep.factory';
import type { ComponentHelper } from '../../../../../../src/app/compiler/angular/deps/helpers/component-helper';
import type { ComponentPlaygroundBlock } from '../../../../../../src/templates/helpers/jsdoc';

/**
 * Minimal `ComponentHelper` stub. `DirectiveDepFactory.create` calls a fixed
 * set of getters; each returns a benign default so the test focuses on the
 * `playgrounds` propagation path added in this change.
 */
const makeHelperStub = (): ComponentHelper =>
    ({
        getComponentSelector: () => '',
        getComponentProviders: () => [],
        getComponentExportAs: () => '',
        getComponentHostDirectives: () => [],
        getComponentHostStructured: () => [],
        getComponentStandalone: () => false,
        getComponentExampleUrls: () => [],
        getExampleUrlsOf: () => [],
        getInputOutputSignals: (properties: any) => ({
            inputSignals: [],
            outputSignals: [],
            properties
        }),
        getComponentHost: () => undefined
    }) as unknown as ComponentHelper;

const baseIO = (overrides: Record<string, any> = {}): any => ({
    description: '',
    rawdescription: '',
    inputs: [],
    outputs: [],
    hostBindings: [],
    hostListeners: [],
    properties: [],
    methods: [],
    ...overrides
});

const srcFileStub = { getText: () => 'export class Foo {}' };

describe('DirectiveDepFactory.playgrounds', () => {
    it('defaults playgrounds to an empty array when IO.playgrounds is absent', () => {
        const factory = new DirectiveDepFactory(makeHelperStub());
        const dep = factory.create('foo.directive.ts', srcFileStub, 'FooDirective', {}, baseIO());

        expect(dep.playgrounds).to.deep.equal([]);
    });

    it('passes IO.playgrounds through to the returned dep', () => {
        const blocks: ComponentPlaygroundBlock[] = [
            {
                title: 'Hover state',
                snippet: '<button cdxHover>Hover</button>',
                language: 'html',
                line: 1
            },
            {
                title: 'Disabled',
                snippet: '<button cdxHover disabled>Off</button>',
                language: 'html',
                line: 5
            }
        ];
        const factory = new DirectiveDepFactory(makeHelperStub());
        const dep = factory.create(
            'foo.directive.ts',
            srcFileStub,
            'FooDirective',
            {},
            baseIO({ playgrounds: blocks })
        );

        expect(dep.playgrounds).to.equal(blocks);
        expect(dep.playgrounds).to.have.length(2);
        expect(dep.playgrounds?.[0].title).to.equal('Hover state');
    });

    it('treats an empty IO.playgrounds array as empty (not undefined)', () => {
        const factory = new DirectiveDepFactory(makeHelperStub());
        const dep = factory.create(
            'foo.directive.ts',
            srcFileStub,
            'FooDirective',
            {},
            baseIO({ playgrounds: [] })
        );

        // `IO.playgrounds || []` collapses an empty array to a new `[]` — both
        // are equivalent for downstream `playgrounds.length` checks.
        expect(Array.isArray(dep.playgrounds)).to.equal(true);
        expect(dep.playgrounds).to.have.length(0);
    });
});
