import type { Feature, FeatureId } from '../compiler/semantic/features';
import { compareText } from '../compiler/semantic/model';

export interface FeatureSegments {
    /** Page segments per feature (`pageLocation({ type: 'feature', segments })`). */
    readonly segments: ReadonlyMap<FeatureId, readonly string[]>;
    /** One line per feature whose segments clashed with another's and got a suffix. */
    readonly clashes: readonly string[];
}

const safeSegment = (segment: string): string =>
    segment
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[-.]+|-+$/g, '')
        .replace(/-{2,}/g, '-') || 'feature';

/** The `@scope/` every entry point's import path starts with, if they share one. */
export const sharedScope = (features: readonly Feature[]): string | undefined => {
    const scopes = new Set(
        features.flatMap(feature =>
            feature.entryPoint === undefined ? [] : [/^(@[^/]+)\//.exec(feature.entryPoint)?.[1]]
        )
    );
    const [scope] = scopes;
    return scopes.size === 1 && scope !== undefined ? scope : undefined;
};

const importSegments = (importPath: string, scope: string | undefined): readonly string[] => {
    const parts = importPath.split('/').filter(Boolean);
    const rest = scope !== undefined && parts[0] === scope ? parts.slice(1) : parts;
    return rest.map(part => safeSegment(part.replace(/^@/, '')));
};

/**
 * The page segments of every feature: the import path of its entry point
 * without the shared scope (a scope that differs between entry points stays
 * as a folder without `@`), then the key for a sub-feature. Features outside
 * every entry point use their key, a root feature its label. A path two
 * features would share gets `-2`, `-3`, ... on the later feature.
 */
export const featureSegments = (features: readonly Feature[]): FeatureSegments => {
    const scope = sharedScope(features);
    const segments = new Map<FeatureId, readonly string[]>();
    const taken = new Set<string>();
    const clashes: string[] = [];
    const ordered = [...features].sort(
        (a, b) => compareText(a.entryPoint ?? '', b.entryPoint ?? '') || compareText(a.key, b.key)
    );
    for (const feature of ordered) {
        const base =
            feature.entryPoint === undefined
                ? [safeSegment(feature.key || feature.label)]
                : [
                      ...importSegments(feature.entryPoint, scope),
                      ...(feature.key ? [feature.key] : [])
                  ];
        let path = base;
        for (let n = 2; taken.has(path.join('/').toLowerCase()); n++) {
            path = [...base.slice(0, -1), `${base[base.length - 1]}-${n}`];
        }
        if (path !== base) {
            clashes.push(
                `Feature ${feature.id} shares its page with another feature; using ${path.join('/')}`
            );
        }
        taken.add(path.join('/').toLowerCase());
        segments.set(feature.id, path);
    }
    return { segments, clashes };
};
