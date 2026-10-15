import { globToRegExp, isFeatureKey } from './features';
import type { AxisTag } from './model';

/** One declared classification axis, validated. */
export interface AxisConfig {
    readonly label: string;
    /** Declared values, in config order, without duplicates. */
    readonly values: readonly string[];
    /** Glob over cwd-relative file paths -> value; the first match in object order wins. */
    readonly paths: Readonly<Record<string, string>>;
    readonly default?: string;
    /** Symbol kinds the axis applies to; every kind when absent. */
    readonly kinds?: readonly string[];
}

export interface AxesConfigResult {
    readonly axes: Readonly<Record<string, AxisConfig>>;
    readonly warnings: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/** A value is one word: the tag reads `@axis <name> <value>`. */
const isAxisValue = (value: unknown): value is string =>
    typeof value === 'string' && /^\S+$/.test(value);

const axisValues = (name: string, raw: unknown, warnings: string[]): string[] => {
    if (!Array.isArray(raw)) {
        warnings.push(`classificationAxes: "${name}" needs a list of values; axis ignored`);
        return [];
    }
    const values: string[] = [];
    for (const value of raw) {
        if (!isAxisValue(value)) {
            warnings.push(
                `classificationAxes: "${name}" ignores value ${JSON.stringify(value)} (expected one word)`
            );
        } else if (!values.includes(value)) {
            values.push(value);
        }
    }
    if (values.length === 0) {
        warnings.push(`classificationAxes: "${name}" has no valid values; axis ignored`);
    }
    return values;
};

const axisPaths = (
    name: string,
    raw: unknown,
    values: readonly string[],
    warnings: string[]
): Record<string, string> => {
    if (raw === undefined) {
        return {};
    }
    if (!isRecord(raw)) {
        warnings.push(
            `classificationAxes: "${name}.paths" expected an object of glob -> value; ignored`
        );
        return {};
    }
    const paths: Record<string, string> = {};
    for (const [glob, value] of Object.entries(raw)) {
        if (typeof value === 'string' && values.includes(value)) {
            paths[glob] = value;
        } else {
            warnings.push(
                `classificationAxes: "${name}.paths" ignores "${glob}": ${JSON.stringify(value)} is not a declared value`
            );
        }
    }
    return paths;
};

const axisDefault = (
    name: string,
    raw: unknown,
    values: readonly string[],
    warnings: string[]
): { default?: string } => {
    if (raw === undefined) {
        return {};
    }
    if (typeof raw === 'string' && values.includes(raw)) {
        return { default: raw };
    }
    warnings.push(
        `classificationAxes: "${name}.default" ${JSON.stringify(raw)} is not a declared value; ignored`
    );
    return {};
};

const axisKinds = (
    name: string,
    raw: unknown,
    isKind: (kind: string) => boolean,
    warnings: string[]
): { kinds?: readonly string[] } => {
    if (raw === undefined) {
        return {};
    }
    if (!Array.isArray(raw)) {
        warnings.push(
            `classificationAxes: "${name}.kinds" expected a list of symbol kinds; ignored`
        );
        return {};
    }
    const kinds: string[] = [];
    for (const kind of raw) {
        if (typeof kind === 'string' && isKind(kind)) {
            kinds.push(kind);
        } else {
            warnings.push(
                `classificationAxes: "${name}.kinds" ignores ${JSON.stringify(kind)} (not a symbol kind)`
            );
        }
    }
    return kinds.length > 0 ? { kinds } : {};
};

const axisLabel = (name: string, raw: unknown, warnings: string[]): string => {
    if (raw === undefined) {
        return name;
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
        return raw.trim();
    }
    warnings.push(`classificationAxes: "${name}.label" expected a non-empty string; ignored`);
    return name;
};

/**
 * The `classificationAxes` config value, validated. Invalid parts warn once
 * each and are dropped; an axis without a valid value is dropped whole.
 */
export const parseAxesConfig = (
    raw: unknown,
    isKind: (kind: string) => boolean
): AxesConfigResult => {
    if (!isRecord(raw)) {
        return {
            axes: {},
            warnings: ['classificationAxes: expected an object of axis name -> axis; ignored']
        };
    }
    const warnings: string[] = [];
    const axes: Record<string, AxisConfig> = {};
    for (const [name, axis] of Object.entries(raw)) {
        if (!isFeatureKey(name)) {
            warnings.push(
                `classificationAxes: ignoring "${name}" (expected one segment [a-z0-9][a-z0-9-]*)`
            );
            continue;
        }
        if (!isRecord(axis)) {
            warnings.push(`classificationAxes: "${name}" expected an object; axis ignored`);
            continue;
        }
        const values = axisValues(name, axis.values, warnings);
        if (values.length === 0) {
            continue;
        }
        axes[name] = {
            label: axisLabel(name, axis.label, warnings),
            values,
            paths: axisPaths(name, axis.paths, values, warnings),
            ...axisDefault(name, axis.default, values, warnings),
            ...axisKinds(name, axis.kinds, isKind, warnings)
        };
    }
    return { axes, warnings };
};

/** A documented symbol to classify. */
export interface AxisSymbol {
    /** Fact key. */
    readonly key: string;
    /** File path relative to the working directory. */
    readonly file: string;
    readonly name: string;
    /** Symbol table kind. */
    readonly kind: string;
    readonly tags?: readonly AxisTag[];
}

export interface AxisValueCount {
    readonly value: string;
    readonly count: number;
}

export interface AxisSummary {
    readonly name: string;
    readonly label: string;
    /** Every declared value with its symbol count, in config order. */
    readonly values: readonly AxisValueCount[];
    readonly classified: number;
    readonly unclassified: number;
}

export interface AxisModel {
    readonly axes: readonly AxisSummary[];
    /** Fact key -> axis name -> value; symbols without a value are absent. */
    readonly valuesOf: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

export interface AxisClassification {
    /** Absent when no axis is declared. */
    readonly model?: AxisModel;
    readonly warnings: readonly string[];
}

const SHOWN_LOCATIONS = 3;

/** Problems collected per message, reported once each with their locations. */
const findings = () => {
    const byMessage = new Map<string, string[]>();
    return {
        add: (message: string, symbol: AxisSymbol) => {
            const list = byMessage.get(message) ?? [];
            list.push(`${symbol.file}#${symbol.name}`);
            byMessage.set(message, list);
        },
        lines: (): string[] =>
            [...byMessage].map(([message, at]) => {
                const shown = at.slice(0, SHOWN_LOCATIONS).join(', ');
                const more =
                    at.length > SHOWN_LOCATIONS ? `, ... ${at.length - SHOWN_LOCATIONS} more` : '';
                return `Axes: ${message} (${at.length}: ${shown}${more})`;
            })
    };
};

const appliesTo = (axis: AxisConfig, kind: string): boolean =>
    axis.kinds === undefined || axis.kinds.includes(kind);

/** The tagged values of one symbol, checked against the declared axes. */
const taggedValues = (
    symbol: AxisSymbol,
    axes: Readonly<Record<string, AxisConfig>>,
    report: ReturnType<typeof findings>
): Map<string, string> => {
    const tagged = new Map<string, string>();
    for (const tag of symbol.tags ?? []) {
        const axis = Object.hasOwn(axes, tag.name) ? axes[tag.name] : undefined;
        if (tag.name === '') {
            report.add('@axis without an axis name', symbol);
        } else if (tag.value === undefined) {
            report.add(`@axis ${tag.name} has no value`, symbol);
        } else if (!axis) {
            report.add(`@axis "${tag.name}" is not a declared axis`, symbol);
        } else if (!axis.values.includes(tag.value)) {
            report.add(`@axis ${tag.name} "${tag.value}" is not a declared value`, symbol);
        } else if (!appliesTo(axis, symbol.kind)) {
            report.add(`@axis ${tag.name} does not apply to kind ${symbol.kind}`, symbol);
        } else if (tagged.has(tag.name)) {
            report.add(`@axis ${tag.name} given more than once, first one kept`, symbol);
        } else {
            tagged.set(tag.name, tag.value);
        }
    }
    return tagged;
};

/**
 * Give every symbol its value on each declared axis: the `@axis` tag, else
 * the first matching path glob, else the axis default. Symbols of a kind the
 * axis does not apply to are not counted. Values never move a symbol.
 */
export const classifyAxes = (
    symbols: readonly AxisSymbol[],
    axes: Readonly<Record<string, AxisConfig>>
): AxisClassification => {
    const names = Object.keys(axes);
    if (names.length === 0) {
        const tags = symbols.reduce((sum, symbol) => sum + (symbol.tags?.length ?? 0), 0);
        return tags === 0
            ? { warnings: [] }
            : {
                  warnings: [
                      `Axes: ${tags} @axis tags found, no classificationAxes declared; ignored`
                  ]
              };
    }
    const report = findings();
    const globs = new Map(
        names.map(name => [
            name,
            Object.entries(axes[name].paths).map(([glob, value]) => ({
                re: globToRegExp(glob),
                value
            }))
        ])
    );
    const valuesOf = new Map<string, ReadonlyMap<string, string>>();
    const counts = new Map(names.map(name => [name, new Map<string, number>()]));
    const unclassified = new Map(names.map(name => [name, 0]));
    for (const symbol of symbols) {
        const tagged = taggedValues(symbol, axes, report);
        const values = new Map<string, string>();
        for (const name of names) {
            const axis = axes[name];
            if (!appliesTo(axis, symbol.kind)) {
                continue;
            }
            const value =
                tagged.get(name) ??
                globs.get(name)?.find(g => g.re.test(symbol.file))?.value ??
                axis.default;
            if (value === undefined) {
                unclassified.set(name, (unclassified.get(name) ?? 0) + 1);
                continue;
            }
            values.set(name, value);
            const perValue = counts.get(name);
            perValue?.set(value, (perValue.get(value) ?? 0) + 1);
        }
        if (values.size > 0) {
            valuesOf.set(symbol.key, values);
        }
    }
    const summaries = names.map((name): AxisSummary => {
        const axis = axes[name];
        const values = axis.values.map(value => ({
            value,
            count: counts.get(name)?.get(value) ?? 0
        }));
        return {
            name,
            label: axis.label,
            values,
            classified: values.reduce((sum, v) => sum + v.count, 0),
            unclassified: unclassified.get(name) ?? 0
        };
    });
    return { model: { axes: summaries, valuesOf }, warnings: report.lines() };
};

/** The one-line build log summary of the axes. */
export const formatAxesSummary = (model: AxisModel): string =>
    `Axes: ${model.axes
        .map(axis => {
            const total = axis.classified + axis.unclassified;
            const rest = axis.unclassified > 0 ? ` (${axis.unclassified} unclassified)` : '';
            return `${axis.name} ${axis.classified}/${total} classified${rest}`;
        })
        .join(', ')}`;
