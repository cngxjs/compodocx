import traverse from 'neotraverse/legacy';
import AngularApiUtil from '../../utils/angular-api.util';
import type { IApiSourceResult } from '../../utils/api-source-result.interface';
import { getNamesCompareFn } from '../../utils/utils';
import type {
    IDep,
    IEnumDecDep,
    IFunctionDecDep,
    IGuardDep,
    IInjectableDep,
    IInterceptorDep,
    IInterfaceDep,
    IPipeDep,
    ITypeAliasDecDep
} from '../compiler/angular/dependencies.interfaces';
import type { IComponentDep } from '../compiler/angular/deps/component-dep.factory';
import type { IDirectiveDep } from '../compiler/angular/deps/directive-dep.factory';
import Configuration from '../configuration';
import { hiddenFilter } from '../di/model';
import type { MiscellaneousData } from '../interfaces/miscellaneous-data.interface';
import type { ParsedData } from '../interfaces/parsed-data.interface';
import type { RouteInterface } from '../interfaces/routes.interface';
import type { TableKind } from '../links/symbol-id';
import { buildSymbolTable, lookupEntry, type SymbolTable } from '../links/symbol-table';

export interface GroupNode {
    name: string; // segment name (single folder)
    fullPath: string; // e.g. "features/admin"
    items: any[]; // entities directly in this folder
    children: GroupNode[];
}

/** Discriminator for cross-kind feature grouping. */
export type EntityKind =
    | 'component'
    | 'directive'
    | 'injectable'
    | 'token'
    | 'pipe'
    | 'class'
    | 'interface'
    | 'guard'
    | 'interceptor'
    | 'entity'
    | 'function'
    | 'variable'
    | 'typealias'
    | 'enumeration';

/** Kinds that default into the Features chapter under `menuLayout: 'feature'`. */
export const PRIMARY_KINDS: ReadonlySet<TableKind> = new Set<TableKind>([
    'component',
    'directive',
    'pipe',
    'injectable',
    'token',
    'class',
    'guard',
    'interceptor',
    'resolver',
    'entity'
]);

/** Kinds that default into the References chapter under `menuLayout: 'feature'`. */
export const REFERENCE_KINDS: ReadonlySet<TableKind> = new Set<TableKind>([
    'interface',
    'function',
    'variable',
    'typealias',
    'enumeration'
]);

/** Entity decorated with its kind + href prefix for cross-kind sidebar rendering. */
export interface EntityWithKind {
    kind: TableKind;
    hrefPrefix: string;
    name: string;
    file?: string;
    category?: string;
    deprecated?: boolean;
    standalone?: boolean;
    isToken?: boolean;
    beta?: boolean;
    factoryKind?: string;
    selector?: string;
    duplicateName?: string;
    description?: string;
    inputsClass?: unknown[];
    outputsClass?: unknown[];
    [key: string]: unknown;
}

/**
 * Convert flat `Record<string, items[]>` into a GroupNode tree.
 * Mirrors the actual folder structure — no path compression.
 */
export function buildGroupTree(groups: Record<string, any[]>): GroupNode[] {
    interface TrieNode {
        name: string;
        fullPath: string;
        items: any[];
        children: Map<string, TrieNode>;
    }

    const root: TrieNode = {
        name: '',
        fullPath: '',
        items: [],
        children: new Map()
    };

    for (const [key, items] of Object.entries(groups)) {
        const segments = key.split('/');
        let current = root;
        let pathSoFar = '';
        for (const seg of segments) {
            pathSoFar = pathSoFar ? `${pathSoFar}/${seg}` : seg;
            if (!current.children.has(seg)) {
                current.children.set(seg, {
                    name: seg,
                    fullPath: pathSoFar,
                    items: [],
                    children: new Map()
                });
            }
            current = current.children.get(seg)!;
        }
        current.items = items;
    }

    const toGroupNodes = (node: TrieNode): GroupNode[] => {
        const result: GroupNode[] = [];
        for (const child of node.children.values()) {
            result.push({
                name: child.name,
                fullPath: child.fullPath,
                items: child.items,
                children: toGroupNodes(child)
            });
        }
        result.sort((a, b) => a.name.localeCompare(b.name));
        return result;
    };

    return toGroupNodes(root);
}

export class DependenciesEngine {
    public rawData: ParsedData;
    public components: IComponentDep[];
    public entities: IDep[];
    public directives: IDirectiveDep[];
    public injectables: IInjectableDep[];
    public tokens: IInjectableDep[];
    public interceptors: IInterceptorDep[];
    public guards: IGuardDep[];
    public interfaces: IInterfaceDep[];
    public routes: RouteInterface;
    public pipes: IPipeDep[];
    public classes: IDep[];
    public appConfig: any[] = [];
    public miscellaneous: MiscellaneousData = {
        variables: [],
        functions: [],
        typealiases: [],
        enumerations: [],
        groupedVariables: [],
        groupedFunctions: [],
        groupedEnumerations: [],
        groupedTypeAliases: []
    };

    private static instance: DependenciesEngine;
    private constructor() {}
    public static getInstance() {
        if (!DependenciesEngine.instance) {
            DependenciesEngine.instance = new DependenciesEngine();
        }
        return DependenciesEngine.instance;
    }

    public init(data: ParsedData) {
        traverse(data).forEach(node => {
            if (node) {
                if (node.parent) {
                    delete node.parent;
                }
                if (node.initializer) {
                    delete node.initializer;
                }
            }
        });
        this.rawData = data;
        this.components = [...this.rawData.components].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.entities = [...this.rawData.entities].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.directives = [...this.rawData.directives].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.injectables = [...this.rawData.injectables].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.tokens = [...(this.rawData.tokens ?? [])].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.interceptors = [...this.rawData.interceptors].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.guards = [...this.rawData.guards].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.interfaces = [...this.rawData.interfaces].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.pipes = [...this.rawData.pipes].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.classes = [...this.rawData.classes].sort((a, b) =>
            (a as any).name.toLowerCase().localeCompare((b as any).name.toLowerCase())
        );
        this.appConfig = this.rawData.appConfig || [];
        this.miscellaneous = this.rawData.miscellaneous;
        this.prepareMiscellaneous();
        this.routes = this.rawData.routesTree;
        this.manageDuplicatesName();
    }

    private manageDuplicatesName() {
        const processDuplicates = (element, _index, array) => {
            const elementsWithSameName = array.filter(
                el => (el as any).name === (element as any).name
            );
            if (elementsWithSameName.length > 1) {
                // First element is the reference for duplicates
                for (let i = 1; i < elementsWithSameName.length; i++) {
                    const elementToEdit = elementsWithSameName[i];
                    if (typeof elementToEdit.isDuplicate === 'undefined') {
                        elementToEdit.isDuplicate = true;
                        elementToEdit.duplicateId = i;
                        elementToEdit.duplicateName = `${elementToEdit.name}-${elementToEdit.duplicateId}`;
                        elementToEdit.id = `${elementToEdit.id}-${elementToEdit.duplicateId}`;
                    }
                }
            }
            return element;
        };
        this.classes = this.classes.map(processDuplicates);
        this.interfaces = this.interfaces.map(processDuplicates);
        this.injectables = this.injectables.map(processDuplicates);
        this.pipes = this.pipes.map(processDuplicates);
        this.interceptors = this.interceptors.map(processDuplicates);
        this.guards = this.guards.map(processDuplicates);
        this.components = this.components.map(processDuplicates);
        this.entities = this.entities.map(processDuplicates);
        this.directives = this.directives.map(processDuplicates);
    }

    /**
     * The symbol table of the current engine data. Crawl-time callers run
     * before the crawl phase publishes the table and see the engine as it is
     * (empty on a first run, the previous run in watch mode).
     */
    private symbolTable(): SymbolTable {
        return Configuration.mainData.symbols ?? buildSymbolTable(this);
    }

    /** Resolve a type name: documented symbols first (`type-link` policy), then the Angular API. */
    public find(name: string): IApiSourceResult<any> | undefined {
        const entry = lookupEntry(
            this.symbolTable(),
            name,
            'type-link',
            undefined,
            hiddenFilter(Configuration.mainData.di)
        );
        if (entry) {
            return { source: 'internal', data: entry.data, score: entry.ref.name === name ? 2 : 1 };
        }
        const external = AngularApiUtil.findApi(name);
        return external.data && external.score > 0 ? external : undefined;
    }

    public update(updatedData): void {
        if (updatedData.components.length > 0) {
            updatedData.components.forEach((component: IComponentDep) => {
                const _index = this.components.findIndex(c => (c as any).name === component.name);
                this.components[_index] = component;
            });
        }
        if (updatedData.entities.length > 0) {
            updatedData.entities.forEach((entity: any) => {
                const _index = this.entities.findIndex(e => (e as any).name === entity.name);
                this.entities[_index] = entity;
            });
        }
        if (updatedData.directives.length > 0) {
            updatedData.directives.forEach((directive: IDirectiveDep) => {
                const _index = this.directives.findIndex(d => (d as any).name === directive.name);
                this.directives[_index] = directive;
            });
        }
        if (updatedData.injectables.length > 0) {
            updatedData.injectables.forEach((injectable: IInjectableDep) => {
                const _index = this.injectables.findIndex(i => (i as any).name === injectable.name);
                this.injectables[_index] = injectable;
            });
        }
        if (updatedData.interceptors.length > 0) {
            updatedData.interceptors.forEach((interceptor: IInterceptorDep) => {
                const _index = this.interceptors.findIndex(
                    i => (i as any).name === interceptor.name
                );
                this.interceptors[_index] = interceptor;
            });
        }
        if (updatedData.guards.length > 0) {
            updatedData.guards.forEach((guard: IGuardDep) => {
                const _index = this.guards.findIndex(g => (g as any).name === guard.name);
                this.guards[_index] = guard;
            });
        }
        if (updatedData.interfaces.length > 0) {
            updatedData.interfaces.forEach((int: IInterfaceDep) => {
                const _index = this.interfaces.findIndex(i => (i as any).name === int.name);
                this.interfaces[_index] = int;
            });
        }
        if (updatedData.pipes.length > 0) {
            updatedData.pipes.forEach((pipe: IPipeDep) => {
                const _index = this.pipes.findIndex(p => (p as any).name === pipe.name);
                this.pipes[_index] = pipe;
            });
        }
        if (updatedData.classes.length > 0) {
            updatedData.classes.forEach((classe: any) => {
                const _index = this.classes.findIndex(c => (c as any).name === classe.name);
                this.classes[_index] = classe;
            });
        }
        /**
         * Miscellaneous update
         */
        if (updatedData.miscellaneous.variables.length > 0) {
            updatedData.miscellaneous.variables.forEach((variable: any) => {
                const _index = this.miscellaneous.variables.findIndex(
                    v => v.name === variable.name && v.file === variable.file
                );
                this.miscellaneous.variables[_index] = variable;
            });
        }
        if (updatedData.miscellaneous.functions.length > 0) {
            updatedData.miscellaneous.functions.forEach((func: IFunctionDecDep) => {
                const _index = this.miscellaneous.functions.findIndex(
                    f => f.name === func.name && f.file === func.file
                );
                this.miscellaneous.functions[_index] = func;
            });
        }
        if (updatedData.miscellaneous.typealiases.length > 0) {
            updatedData.miscellaneous.typealiases.forEach((typealias: ITypeAliasDecDep) => {
                const _index = this.miscellaneous.typealiases.findIndex(
                    t => t.name === typealias.name && t.file === typealias.file
                );
                this.miscellaneous.typealiases[_index] = typealias;
            });
        }
        if (updatedData.miscellaneous.enumerations.length > 0) {
            updatedData.miscellaneous.enumerations.forEach((enumeration: IEnumDecDep) => {
                const _index = this.miscellaneous.enumerations.findIndex(
                    e => e.name === enumeration.name && e.file === enumeration.file
                );
                this.miscellaneous.enumerations[_index] = enumeration;
            });
        }
        this.prepareMiscellaneous();
    }

    /** Resolve a `{@link}` target (`doc-link` policy); `false` when unknown. */
    public findInCompodoc(name: string) {
        const hidden = hiddenFilter(Configuration.mainData.di);
        return (
            (lookupEntry(this.symbolTable(), name, 'doc-link', undefined, hidden)?.data as any) ||
            false
        );
    }

    private prepareMiscellaneous() {
        this.miscellaneous.variables.sort(getNamesCompareFn());
        this.miscellaneous.functions.sort(getNamesCompareFn());
        this.miscellaneous.enumerations.sort(getNamesCompareFn());
        this.miscellaneous.typealiases.sort(getNamesCompareFn());
        // group each subgoup by file
        this.miscellaneous.groupedVariables = this.miscellaneous.variables.reduce(
            (groups, item) => {
                (groups[item.file] ??= []).push(item);
                return groups;
            },
            {}
        );
        this.miscellaneous.groupedFunctions = this.miscellaneous.functions.reduce(
            (groups, item) => {
                (groups[item.file] ??= []).push(item);
                return groups;
            },
            {}
        );
        this.miscellaneous.groupedEnumerations = this.miscellaneous.enumerations.reduce(
            (groups, item) => {
                (groups[item.file] ??= []).push(item);
                return groups;
            },
            {}
        );
        this.miscellaneous.groupedTypeAliases = this.miscellaneous.typealiases.reduce(
            (groups, item) => {
                (groups[item.file] ??= []).push(item);
                return groups;
            },
            {}
        );
    }

    public getComponents() {
        return this.components;
    }

    public getEntities() {
        return this.entities;
    }

    public getDirectives() {
        return this.directives;
    }

    public getInjectables() {
        return this.injectables;
    }

    public getTokens() {
        return this.tokens;
    }

    public getInterceptors() {
        return this.interceptors;
    }

    public getGuards() {
        return this.guards;
    }

    public getInterfaces() {
        return this.interfaces;
    }

    public getRoutes() {
        return this.routes;
    }

    public getPipes() {
        return this.pipes;
    }

    public getClasses() {
        return this.classes;
    }

    public getMiscellaneous() {
        return this.miscellaneous;
    }

    /**
     * Compute relationships for a given entity.
     * Returns incoming (who uses this) and outgoing (what it depends on).
     * Limited to MAX_NODES to avoid performance issues in large projects.
     */
    public getRelationships(entityName: string): {
        incoming: Array<{
            name: string;
            type: string;
            description?: string;
            subtype?: string;
        }>;
        outgoing: Array<{
            name: string;
            type: string;
            description?: string;
            subtype?: string;
        }>;
    } {
        const MAX_NODES = 50;
        const incoming: Array<{
            name: string;
            type: string;
            description?: string;
            subtype?: string;
        }> = [];
        const outgoing: Array<{
            name: string;
            type: string;
            description?: string;
            subtype?: string;
        }> = [];
        const seen = new Set<string>();

        // Check standalone component imports
        const allComponents = [...this.components, ...this.directives, ...this.pipes] as any[];
        allComponents.forEach((comp: any) => {
            if (comp.name === entityName) {
                // Outgoing: what this entity imports
                (comp.imports ?? []).forEach((imp: any) => {
                    if (!seen.has(imp.name) && outgoing.length < MAX_NODES) {
                        const resolved = this.resolveEntityByName(imp.name);
                        outgoing.push({
                            name: imp.name,
                            type: resolved?.type || imp.type || 'dependency',
                            subtype: this.computeEntitySubtype(resolved),
                            description: resolved
                                ? this.extractShortDescription(resolved)
                                : undefined
                        });
                        seen.add(imp.name);
                    }
                });
                // Outgoing: providers
                (comp.providers ?? []).forEach((prov: any) => {
                    if (!seen.has(prov.name) && outgoing.length < MAX_NODES) {
                        const resolved = this.resolveEntityByName(prov.name);
                        outgoing.push({
                            name: prov.name,
                            type: resolved?.type || 'injectable',
                            subtype: this.computeEntitySubtype(resolved),
                            description: resolved
                                ? this.extractShortDescription(resolved)
                                : undefined
                        });
                        seen.add(prov.name);
                    }
                });
            } else {
                // Incoming: other components that import this entity
                const compImports = (comp.imports ?? []).map((i: any) => i.name);
                if (
                    compImports.includes(entityName) &&
                    !seen.has(comp.name) &&
                    incoming.length < MAX_NODES
                ) {
                    incoming.push({
                        name: comp.name,
                        type: comp.type || 'component',
                        description: this.extractShortDescription(comp)
                    });
                    seen.add(comp.name);
                }
            }
        });

        return { incoming, outgoing };
    }

    /**
     * Extract first sentence of an entity's description, HTML-stripped,
     * truncated to ~120 characters. Returns undefined when empty.
     */
    private extractShortDescription(entity: any): string | undefined {
        const raw: string = entity?.rawdescription || entity?.description || '';
        if (!raw) {
            return undefined;
        }
        const stripped = String(raw)
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!stripped) {
            return undefined;
        }
        const firstSentence = stripped.split(/(?<=\.)\s/)[0] || stripped;
        return firstSentence.length > 120
            ? `${firstSentence.slice(0, 117).trim()}…`
            : firstSentence;
    }

    /**
     * Look up an entity by name across all known dep stores.
     */
    private resolveEntityByName(name: string): any {
        return (
            (this.components as any[]).find(e => e.name === name) ||
            (this.directives as any[]).find(e => e.name === name) ||
            (this.pipes as any[]).find(e => e.name === name) ||
            (this.injectables as any[]).find(e => e.name === name) ||
            (this.interfaces as any[]).find(e => e.name === name) ||
            (this.classes as any[]).find(e => e.name === name) ||
            (this.guards as any[]).find(e => e.name === name) ||
            (this.interceptors as any[]).find(e => e.name === name)
        );
    }

    /**
     * Compute a human subtype label like "Singleton Service", "Pure Pipe",
     * "Attribute Directive" from the resolved entity. Returns undefined
     * when no meaningful subtype applies.
     */
    private computeEntitySubtype(entity: any): string | undefined {
        if (!entity) {
            return undefined;
        }
        const type = entity.type;
        if (type === 'injectable') {
            if (entity.providedIn === 'root' || entity.providedIn === 'platform') {
                return 'Singleton service';
            }
            return 'Service';
        }
        if (type === 'pipe') {
            return entity.pure === 'false' ? 'Impure pipe' : 'Pure pipe';
        }
        if (type === 'directive') {
            return entity.selector?.startsWith('[') ? 'Attribute directive' : 'Directive';
        }
        if (type === 'component') {
            return entity.standalone ? 'Standalone component' : 'Component';
        }
        if (type === 'guard') {
            return entity.functionalKind ? 'Functional guard' : 'Class guard';
        }
        if (type === 'interceptor') {
            return entity.functionalKind ? 'Functional interceptor' : 'Class interceptor';
        }
        return undefined;
    }
}

export default DependenciesEngine.getInstance();
