import { isFeatureKey } from './features';

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
