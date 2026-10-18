import {
    CLI_BIN,
    LEGACY_BIN_PATTERN,
    LEGACY_PACKAGE_NAME,
    LEGACY_SCRIPT_KEY_PREFIX
} from './constants';
import type { LegacyFinding, PackageJsonLike } from './detect';

export interface MigrationResult {
    packageJson: PackageJsonLike;
    /** Names of removed packages (always either empty or `['@compodoc/compodoc']`). */
    removedDeps: string[];
    /** Renamed script keys, in stable order. `to` is the post-rename key. */
    renamedScripts: Array<{ from: string; to: string }>;
    /** Script keys whose value was rewritten to use the new bin. */
    rewrittenScripts: string[];
}

function clonePackageJson(packageJson: PackageJsonLike): PackageJsonLike {
    return JSON.parse(JSON.stringify(packageJson));
}

function removeLegacyDep(
    deps: { [key: string]: string } | undefined
): { changed: boolean; deps: { [key: string]: string } | undefined } {
    if (!deps || !Object.prototype.hasOwnProperty.call(deps, LEGACY_PACKAGE_NAME)) {
        return { changed: false, deps };
    }
    const next: { [key: string]: string } = {};
    for (const [name, range] of Object.entries(deps)) {
        if (name === LEGACY_PACKAGE_NAME) {
            continue;
        }
        next[name] = range;
    }
    return { changed: true, deps: next };
}

/** Replaces the legacy binary with `compodocx`; the script prefix only names script keys. */
function rewriteValue(value: string): string {
    LEGACY_BIN_PATTERN.lastIndex = 0;
    return value.replace(LEGACY_BIN_PATTERN, `$1$2${CLI_BIN}`);
}

interface RenameScriptOptions {
    scripts: { [key: string]: string };
    legacyKeys: string[];
    scriptPrefix: string;
}

interface RenameScriptResult {
    scripts: { [key: string]: string };
    renamed: Array<{ from: string; to: string }>;
}

/**
 * Builds a fresh scripts object preserving the original insertion order.
 * Renames `compodoc:<suffix>` -> `<prefix>:<suffix>` (default `compodocx:`).
 * On collision with a different existing target value, appends `-legacy` to
 * the source key instead of overwriting.
 */
function renameLegacyScriptKeys(opts: RenameScriptOptions): RenameScriptResult {
    const { scripts, legacyKeys, scriptPrefix } = opts;
    const legacySet = new Set(legacyKeys);
    const renamed: Array<{ from: string; to: string }> = [];
    const next: { [key: string]: string } = {};

    for (const [key, value] of Object.entries(scripts)) {
        if (!legacySet.has(key)) {
            next[key] = value;
            continue;
        }

        const suffix = key.slice(LEGACY_SCRIPT_KEY_PREFIX.length);
        const candidate = `${scriptPrefix}:${suffix}`;

        if (Object.prototype.hasOwnProperty.call(next, candidate) && next[candidate] !== value) {
            const fallback = `${key}-legacy`;
            next[fallback] = value;
            renamed.push({ from: key, to: fallback });
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(scripts, candidate) && candidate !== key) {
            const existingValue = scripts[candidate];
            if (existingValue !== value) {
                const fallback = `${key}-legacy`;
                next[fallback] = value;
                renamed.push({ from: key, to: fallback });
                continue;
            }
        }
        next[candidate] = value;
        renamed.push({ from: key, to: candidate });
    }

    return { scripts: next, renamed };
}

export function migrateLegacyArtefacts(
    packageJson: PackageJsonLike,
    finding: LegacyFinding,
    scriptPrefix: string
): MigrationResult {
    const next = clonePackageJson(packageJson);
    const removedDeps: string[] = [];

    const dep = removeLegacyDep(next.dependencies);
    if (dep.changed) {
        removedDeps.push(LEGACY_PACKAGE_NAME);
        if (dep.deps && Object.keys(dep.deps).length > 0) {
            next.dependencies = dep.deps;
        } else {
            delete next.dependencies;
        }
    }

    const devDep = removeLegacyDep(next.devDependencies);
    if (devDep.changed) {
        if (!removedDeps.includes(LEGACY_PACKAGE_NAME)) {
            removedDeps.push(LEGACY_PACKAGE_NAME);
        }
        if (devDep.deps && Object.keys(devDep.deps).length > 0) {
            next.devDependencies = devDep.deps;
        } else {
            delete next.devDependencies;
        }
    }

    let scripts = next.scripts ?? {};
    let renamed: Array<{ from: string; to: string }> = [];
    if (finding.legacyScriptKeys.length > 0) {
        const result = renameLegacyScriptKeys({
            scripts,
            legacyKeys: finding.legacyScriptKeys,
            scriptPrefix
        });
        scripts = result.scripts;
        renamed = result.renamed;
    }

    const rewrittenScripts: string[] = [];
    const renameMap = new Map(renamed.map(r => [r.from, r.to]));
    for (const originalKey of finding.legacyScriptInvocations) {
        const currentKey = renameMap.get(originalKey) ?? originalKey;
        const value = scripts[currentKey];
        if (typeof value !== 'string') {
            continue;
        }
        const rewritten = rewriteValue(value);
        if (rewritten !== value) {
            scripts[currentKey] = rewritten;
            rewrittenScripts.push(currentKey);
        }
    }

    if (Object.keys(scripts).length > 0) {
        next.scripts = scripts;
    }

    return {
        packageJson: next,
        removedDeps,
        renamedScripts: renamed,
        rewrittenScripts
    };
}
