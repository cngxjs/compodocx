import { beforeEach, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';

/**
 * The reverse-index pass attaches `entity.referencedBy: EntityWithKind[]`
 * onto each reference-kind symbol that another primary-kind entity mentions
 * in its public surface (extends/implements, member types, method return
 * types, constructor args, host directives).
 */
describe('DependenciesEngine — Referenced-by reverse-index', () => {
    beforeEach(() => {
        Configuration.mainData.groupDepth = 2;
    });

    const makeParsed = (overrides: Partial<any> = {}): any => ({
        components: [],
        directives: [],
        injectables: [],
        interceptors: [],
        guards: [],
        interfaces: [],
        pipes: [],
        classes: [],
        entities: [],
        miscellaneous: {
            variables: [],
            functions: [],
            typealiases: [],
            enumerations: [],
            groupedVariables: [],
            groupedFunctions: [],
            groupedEnumerations: [],
            groupedTypeAliases: []
        },
        routesTree: {},
        appConfig: [],
        ...overrides
    });

    it('records a component that references an interface via property type', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'CngxToast',
                        file: 'src/toast/toast.component.ts',
                        propertiesClass: [{ name: 'config', type: 'ToastConfig' }]
                    }
                ],
                interfaces: [
                    {
                        name: 'ToastConfig',
                        file: 'src/toast/toast.types.ts'
                    }
                ]
            })
        );
        const iface = DependenciesEngine.interfaces.find(i => i.name === 'ToastConfig');
        expect(iface).toBeDefined();
        const refs = (iface as any).referencedBy as Array<{ name: string; kind: string }>;
        expect(refs).toHaveLength(1);
        expect(refs[0]).toMatchObject({ name: 'CngxToast', kind: 'component' });
    });

    it('records implements / extends as references', () => {
        DependenciesEngine.init(
            makeParsed({
                injectables: [
                    {
                        name: 'AuthService',
                        file: 'src/auth/auth.service.ts',
                        implements: ['AuthContract'],
                        extends: 'BaseService'
                    }
                ],
                interfaces: [{ name: 'AuthContract', file: 'src/auth/auth.types.ts' }],
                classes: [
                    {
                        name: 'BaseService',
                        file: 'src/shared/base.service.ts'
                    }
                ]
            })
        );
        const contract = DependenciesEngine.interfaces.find(i => i.name === 'AuthContract');
        expect((contract as any).referencedBy?.[0]?.name).toBe('AuthService');
        // BaseService is itself a primary-kind class — it never enters the
        // reference-name set, so its `referencedBy` stays unset.
        const base = DependenciesEngine.classes.find(c => (c as any).name === 'BaseService');
        expect((base as any).referencedBy).toBeUndefined();
    });

    it('skips self-references when an entity references its own name', () => {
        DependenciesEngine.init(
            makeParsed({
                miscellaneous: {
                    variables: [],
                    typealiases: [
                        {
                            name: 'Recursive',
                            file: 'src/lib/recursive.ts',
                            rawtype: 'Recursive | null'
                        }
                    ],
                    enumerations: [],
                    functions: [],
                    groupedVariables: [],
                    groupedFunctions: [],
                    groupedEnumerations: [],
                    groupedTypeAliases: []
                }
            })
        );
        const recursive = DependenciesEngine.miscellaneous.typealiases.find(
            (t: any) => t.name === 'Recursive'
        );
        expect((recursive as any).referencedBy).toBeUndefined();
    });

    it('dedupes when the same primary entity references the same type from multiple members', () => {
        DependenciesEngine.init(
            makeParsed({
                directives: [
                    {
                        name: 'MyDirective',
                        file: 'src/d.directive.ts',
                        propertiesClass: [
                            { name: 'a', type: 'Shared' },
                            { name: 'b', type: 'Shared' }
                        ],
                        methodsClass: [{ name: 'm', returnType: 'Shared' }]
                    }
                ],
                interfaces: [{ name: 'Shared', file: 'src/shared.ts' }]
            })
        );
        const shared = DependenciesEngine.interfaces.find(i => i.name === 'Shared');
        expect((shared as any).referencedBy).toHaveLength(1);
        expect((shared as any).referencedBy[0].name).toBe('MyDirective');
    });

    it('sorts the referencedBy list alphabetically by entity name', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'Zeta',
                        file: 'src/zeta.component.ts',
                        propertiesClass: [{ name: 'x', type: 'Shared' }]
                    },
                    {
                        name: 'Alpha',
                        file: 'src/alpha.component.ts',
                        propertiesClass: [{ name: 'x', type: 'Shared' }]
                    }
                ],
                interfaces: [{ name: 'Shared', file: 'src/shared.ts' }]
            })
        );
        const shared = DependenciesEngine.interfaces.find(i => i.name === 'Shared');
        const names = ((shared as any).referencedBy as Array<{ name: string }>).map(e => e.name);
        expect(names).toEqual(['Alpha', 'Zeta']);
    });

    it('leaves referencedBy unset when nothing in the project references the symbol', () => {
        DependenciesEngine.init(
            makeParsed({
                interfaces: [{ name: 'Lonely', file: 'src/lonely.ts' }]
            })
        );
        const lonely = DependenciesEngine.interfaces.find(i => i.name === 'Lonely');
        expect((lonely as any).referencedBy).toBeUndefined();
    });

    it('records references to PascalCase / SCREAMING_SNAKE reference symbols', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'Holder',
                        file: 'src/holder.component.ts',
                        propertiesClass: [
                            { name: 'a', type: 'AliasType' },
                            { name: 'b', type: 'StatusEnum' },
                            { name: 'c', type: 'typeof CONST_TOKEN' }
                        ]
                    }
                ],
                miscellaneous: {
                    variables: [{ name: 'CONST_TOKEN', file: 'src/c.ts' }],
                    typealiases: [{ name: 'AliasType', file: 'src/a.ts' }],
                    enumerations: [{ name: 'StatusEnum', file: 'src/e.ts' }],
                    functions: [],
                    groupedVariables: [],
                    groupedFunctions: [],
                    groupedEnumerations: [],
                    groupedTypeAliases: []
                }
            })
        );
        const alias = DependenciesEngine.miscellaneous.typealiases.find(
            (t: any) => t.name === 'AliasType'
        );
        const enumeration = DependenciesEngine.miscellaneous.enumerations.find(
            (e: any) => e.name === 'StatusEnum'
        );
        const variable = DependenciesEngine.miscellaneous.variables.find(
            (v: any) => v.name === 'CONST_TOKEN'
        );
        expect((alias as any).referencedBy?.[0]?.name).toBe('Holder');
        expect((enumeration as any).referencedBy?.[0]?.name).toBe('Holder');
        expect((variable as any).referencedBy?.[0]?.name).toBe('Holder');
    });

    it('skips camelCase function names — they rarely appear as TS type references', () => {
        // Documented limitation: the reverse-index walks PascalCase / SCREAMING
        // identifiers out of TS type expressions. A camelCase function name
        // appears in runtime metadata (factory refs, route components), not in
        // type strings — so the backlink stays empty for that shape. Promote
        // factory wrappers (e.g. provideFeedback → ProvideFeedback) if needed.
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'Holder',
                        file: 'src/h.component.ts',
                        propertiesClass: [{ name: 'fn', type: 'typeof helperFn' }]
                    }
                ],
                miscellaneous: {
                    variables: [],
                    typealiases: [],
                    enumerations: [],
                    functions: [{ name: 'helperFn', file: 'src/f.ts' }],
                    groupedVariables: [],
                    groupedFunctions: [],
                    groupedEnumerations: [],
                    groupedTypeAliases: []
                }
            })
        );
        const fn = DependenciesEngine.miscellaneous.functions.find(
            (f: any) => f.name === 'helperFn'
        );
        expect((fn as any).referencedBy).toBeUndefined();
    });

    it('extracts identifiers from generic instantiations (matches by base name)', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'GenericHolder',
                        file: 'src/g.component.ts',
                        propertiesClass: [
                            { name: 'list', type: 'Array<ToastConfig>' },
                            { name: 'observable', type: 'Observable<ToastConfig | null>' }
                        ]
                    }
                ],
                interfaces: [{ name: 'ToastConfig', file: 'src/toast.types.ts' }]
            })
        );
        const config = DependenciesEngine.interfaces.find(i => i.name === 'ToastConfig');
        expect((config as any).referencedBy).toHaveLength(1);
        expect((config as any).referencedBy[0].name).toBe('GenericHolder');
    });
});
