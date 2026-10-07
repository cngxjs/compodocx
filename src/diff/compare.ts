/**
 * Pure-functional diff engine.
 *
 * Walks the matched entity buckets in two `ExportData` snapshots and emits a
 * flat list of `EntityChange` records. The classifier (`./classify.ts`) is
 * the only stage that assigns severity — `compare()` keeps every change
 * record at severity `'docs-only'` until the classifier inspects it. That
 * split lets unit tests target rule classification independent of the walk.
 *
 * Immutable inputs, no mutation, return-by-value (F5).
 */

import type {
    ExportClass,
    ExportComponent,
    ExportData,
    ExportDirective,
    ExportEntityCommon,
    ExportGuard,
    ExportInjectable,
    ExportInterceptor,
    ExportInterface,
    ExportMethod,
    ExportPipe,
    ExportProperty
} from '../app/interfaces/export-data.interface';
import { type SymbolId, symbolFile, symbolId } from '../app/links/symbol-id';
import { stripVolatileFields } from './normalize';
import type { ChangeKind, EntityChange, EntityKind, FieldChange } from './types';

interface EntityBucket<T extends ExportEntityCommon> {
    kind: EntityKind;
    items: ReadonlyArray<T>;
}

const buckets = (data: ExportData): ReadonlyArray<EntityBucket<ExportEntityCommon>> => [
    { kind: 'component', items: data.components ?? [] },
    { kind: 'directive', items: data.directives ?? [] },
    { kind: 'pipe', items: data.pipes ?? [] },
    { kind: 'injectable', items: data.injectables ?? [] },
    { kind: 'guard', items: data.guards ?? [] },
    { kind: 'interceptor', items: data.interceptors ?? [] },
    { kind: 'class', items: data.classes ?? [] },
    { kind: 'interface', items: data.interfaces ?? [] }
];

const indexByName = <T extends { name: string }>(items: ReadonlyArray<T>): Map<string, T> => {
    const map = new Map<string, T>();
    for (const item of items) {
        if (typeof item?.name === 'string') {
            map.set(item.name, item);
        }
    }
    return map;
};

const draftChange = (
    entity: EntityKind,
    name: string,
    file: string | undefined,
    suffix: 'added' | 'removed' | 'changed',
    changes: FieldChange[]
): EntityChange => ({
    kind: `${entity}-${suffix}` as ChangeKind,
    entity,
    name,
    file,
    changes,
    severity: 'docs-only'
});

const PROPERTY_FIELDS = [
    'type',
    'defaultValue',
    'optional',
    'deprecated',
    'description',
    'kind'
] as const;

const METHOD_FIELDS = ['returnType', 'optional', 'deprecated', 'description'] as const;

/**
 * Compare a "named members" list (e.g. `inputsClass`, `methodsClass`,
 * `propertiesClass`). Returns one `member-*` FieldChange per shift.
 */
const compareMemberList = <T extends { name: string }>(
    field: string,
    oldList: ReadonlyArray<T> | undefined,
    newList: ReadonlyArray<T> | undefined,
    fieldsOfInterest: ReadonlyArray<keyof T>
): FieldChange[] => {
    const oldMap = indexByName(oldList ?? []);
    const newMap = indexByName(newList ?? []);
    const out: FieldChange[] = [];
    for (const [name, oldItem] of oldMap) {
        if (!newMap.has(name)) {
            out.push({ field: `${field}.${name}`, kind: 'member-removed', oldValue: oldItem });
        }
    }
    for (const [name, newItem] of newMap) {
        if (!oldMap.has(name)) {
            out.push({ field: `${field}.${name}`, kind: 'member-added', newValue: newItem });
            continue;
        }
        const oldItem = oldMap.get(name) as T;
        const nested = compareScalarFields(oldItem, newItem, fieldsOfInterest);
        if (nested.length > 0) {
            out.push({ field: `${field}.${name}`, kind: 'member-changed', nested });
        }
    }
    return out;
};

const compareScalarFields = <T>(
    oldItem: T,
    newItem: T,
    fields: ReadonlyArray<keyof T>
): FieldChange[] => {
    const out: FieldChange[] = [];
    for (const field of fields) {
        const oldValue = oldItem[field];
        const newValue = newItem[field];
        if (!shallowEqual(oldValue, newValue)) {
            out.push({
                field: String(field),
                kind: 'value-changed',
                oldValue,
                newValue
            });
        }
    }
    return out;
};

/** Equality good enough for primitive-typed contract fields (strings, numbers, booleans, simple arrays). */
const shallowEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((item, idx) => shallowEqual(item, b[idx]));
    }
    if (a == null || b == null) {
        return false;
    }
    if (typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    return JSON.stringify(a) === JSON.stringify(b);
};

const compareEntityCommon = (
    oldEntity: ExportEntityCommon,
    newEntity: ExportEntityCommon
): FieldChange[] =>
    compareScalarFields(oldEntity, newEntity, [
        'description',
        'deprecated',
        'deprecationMessage',
        'extends'
    ]);

const compareComponent = (
    oldEntity: ExportComponent,
    newEntity: ExportComponent
): FieldChange[] => [
    ...compareEntityCommon(oldEntity, newEntity),
    ...compareScalarFields(oldEntity, newEntity, [
        'selector',
        'standalone',
        'changeDetection',
        'preserveWhitespaces'
    ]),
    ...compareMemberList('inputsClass', oldEntity.inputsClass, newEntity.inputsClass, [
        ...PROPERTY_FIELDS
    ] as ReadonlyArray<keyof ExportProperty>),
    ...compareMemberList('outputsClass', oldEntity.outputsClass, newEntity.outputsClass, [
        ...PROPERTY_FIELDS
    ] as ReadonlyArray<keyof ExportProperty>),
    ...compareMemberList('methodsClass', oldEntity.methodsClass, newEntity.methodsClass, [
        ...METHOD_FIELDS
    ] as ReadonlyArray<keyof ExportMethod>),
    ...compareMemberList('themeTokens', oldEntity.themeTokens, newEntity.themeTokens, [
        'type',
        'defaultValue',
        'description',
        'group',
        'deprecated'
    ])
];

const compareDirective = (
    oldEntity: ExportDirective,
    newEntity: ExportDirective
): FieldChange[] => [
    ...compareEntityCommon(oldEntity, newEntity),
    ...compareScalarFields(oldEntity, newEntity, ['selector', 'standalone']),
    ...compareMemberList('inputsClass', oldEntity.inputsClass, newEntity.inputsClass, [
        ...PROPERTY_FIELDS
    ] as ReadonlyArray<keyof ExportProperty>),
    ...compareMemberList('outputsClass', oldEntity.outputsClass, newEntity.outputsClass, [
        ...PROPERTY_FIELDS
    ] as ReadonlyArray<keyof ExportProperty>),
    ...compareMemberList('methodsClass', oldEntity.methodsClass, newEntity.methodsClass, [
        ...METHOD_FIELDS
    ] as ReadonlyArray<keyof ExportMethod>)
];

const comparePipe = (oldEntity: ExportPipe, newEntity: ExportPipe): FieldChange[] => [
    ...compareEntityCommon(oldEntity, newEntity),
    ...compareScalarFields(oldEntity, newEntity, ['standalone', 'pure', 'ngname']),
    ...compareMemberList('methods', oldEntity.methods, newEntity.methods, [
        ...METHOD_FIELDS
    ] as ReadonlyArray<keyof ExportMethod>),
    ...compareMemberList('properties', oldEntity.properties, newEntity.properties, [
        ...PROPERTY_FIELDS
    ] as ReadonlyArray<keyof ExportProperty>)
];

const compareClassLike = (
    oldEntity: ExportClass | ExportInjectable | ExportInterceptor | ExportGuard | ExportInterface,
    newEntity: ExportClass | ExportInjectable | ExportInterceptor | ExportGuard | ExportInterface
): FieldChange[] => [
    ...compareEntityCommon(oldEntity, newEntity),
    ...compareMemberList('properties', oldEntity.properties, newEntity.properties, [
        ...PROPERTY_FIELDS
    ] as ReadonlyArray<keyof ExportProperty>),
    ...compareMemberList('methods', oldEntity.methods, newEntity.methods, [
        ...METHOD_FIELDS
    ] as ReadonlyArray<keyof ExportMethod>)
];

const compareEntityByKind = (
    kind: EntityKind,
    oldEntity: ExportEntityCommon,
    newEntity: ExportEntityCommon
): FieldChange[] => {
    switch (kind) {
        case 'component':
            return compareComponent(oldEntity as ExportComponent, newEntity as ExportComponent);
        case 'directive':
            return compareDirective(oldEntity as ExportDirective, newEntity as ExportDirective);
        case 'pipe':
            return comparePipe(oldEntity as ExportPipe, newEntity as ExportPipe);
        case 'injectable':
        case 'interceptor':
        case 'guard':
        case 'class':
        case 'interface':
            return compareClassLike(oldEntity as ExportClass, newEntity as ExportClass);
    }
};

/** Entries keyed by symbol id; a repeated id keeps the last entry. */
const indexById = <T extends ExportEntityCommon>(
    kind: EntityKind,
    items: ReadonlyArray<T>
): Map<SymbolId, T> => {
    const map = new Map<SymbolId, T>();
    for (const item of items) {
        if (typeof item?.name === 'string') {
            const file = symbolFile(item.file ?? '', process.cwd());
            map.set(symbolId({ kind, file, name: item.name }), item);
        }
    }
    return map;
};

const countNames = <T extends { name: string }>(items: Iterable<T>): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    }
    return counts;
};

/**
 * Pair old and new entries of one kind: by symbol id first, then entries
 * left over on both sides by name when that name is unique among the
 * leftovers of each side (a symbol whose file moved).
 */
const pairEntries = <T extends ExportEntityCommon>(
    kind: EntityKind,
    oldData: ReadonlyArray<T>,
    newData: ReadonlyArray<T>
): { removed: T[]; pairs: Map<T, T | undefined> } => {
    const oldMap = indexById(kind, oldData);
    const newMap = indexById(kind, newData);
    const oldLeft = [...oldMap].filter(([id]) => !newMap.has(id)).map(([, item]) => item);
    const newLeft = [...newMap].filter(([id]) => !oldMap.has(id)).map(([, item]) => item);
    const oldCounts = countNames(oldLeft);
    const newCounts = countNames(newLeft);
    const isUnique = (name: string) => oldCounts.get(name) === 1 && newCounts.get(name) === 1;
    const moved = new Map(oldLeft.filter(item => isUnique(item.name)).map(i => [i.name, i]));

    const pairs = new Map<T, T | undefined>();
    for (const [id, newItem] of newMap) {
        pairs.set(newItem, oldMap.get(id) ?? moved.get(newItem.name));
    }
    const matched = new Set(pairs.values());
    return { removed: [...oldMap.values()].filter(item => !matched.has(item)), pairs };
};

const compareBucket = <T extends ExportEntityCommon>(
    bucket: EntityBucket<T>,
    oldData: ReadonlyArray<T>,
    newData: ReadonlyArray<T>
): EntityChange[] => {
    const { removed, pairs } = pairEntries(bucket.kind, oldData, newData);
    const out: EntityChange[] = [];
    for (const oldEntity of removed) {
        out.push(draftChange(bucket.kind, oldEntity.name, oldEntity.file, 'removed', []));
    }
    for (const [newEntity, oldEntity] of pairs) {
        if (!oldEntity) {
            out.push(draftChange(bucket.kind, newEntity.name, newEntity.file, 'added', []));
            continue;
        }
        const fieldChanges = compareEntityByKind(bucket.kind, oldEntity, newEntity);
        if (fieldChanges.length > 0) {
            out.push(
                draftChange(bucket.kind, newEntity.name, newEntity.file, 'changed', fieldChanges)
            );
        }
    }
    return out;
};

/** Total entity count across every bucket — drives the `unchanged` summary. */
const countEntities = (data: ExportData): number => {
    let total = 0;
    for (const bucket of buckets(data)) {
        total += bucket.items.length;
    }
    return total;
};

/**
 * Diff two snapshots, emitting unscored EntityChange records. The header
 * fields used by formatters survive untouched on both inputs; the
 * VOLATILE_EXPORT_FIELDS strip happens HERE only for the structural compare,
 * so the JSON output can still attribute the diff to specific compodocx
 * versions / generation timestamps.
 */
export const compare = (
    oldData: ExportData,
    newData: ExportData
): { changes: EntityChange[]; unchanged: number } => {
    // Volatile-strip is required for any byte-equal comparison the consumer
    // does (`unchanged` count, future structural-equal short-circuit). The
    // strip is iteration-driven via VOLATILE_EXPORT_FIELDS — never duplicate
    // the field list (F16).
    const oldStripped = stripVolatileFields(oldData) as ExportData;
    const newStripped = stripVolatileFields(newData) as ExportData;

    const out: EntityChange[] = [];
    for (const bucket of buckets(oldStripped)) {
        const newBucket = buckets(newStripped).find(b => b.kind === bucket.kind);
        out.push(...compareBucket(bucket, bucket.items, newBucket?.items ?? []));
    }

    // unchanged = entities present in new that don't appear as added or changed.
    // Removed entities are gone from `new` so they don't count toward unchanged.
    const totalNew = countEntities(newStripped);
    const addedOrChanged = out.filter(
        c => c.kind.endsWith('-added') || c.kind.endsWith('-changed')
    ).length;
    const unchanged = Math.max(0, totalNew - addedOrChanged);
    return { changes: out, unchanged };
};
