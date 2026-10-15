import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Result } from '../lib';
// `dirname` is used inside walkUpForPackageJson; the linter flags it
// when only the `walkUp` helper is invoked but the import remains active.

/**
 * Resolves the version label, output folder, and `versions.json` root for
 * a multi-version build.
 *
 * Resolution precedence:
 *   1. Explicit `--versionLabel` flag
 *   2. `version` field of the nearest `package.json` walking up from
 *      `projectRoot` (and then from cwd if that walk turns up nothing).
 *      `1.2.3` becomes `v1.2.3`; pre-prefixed labels (`v1.2.3`, `next`)
 *      pass through unchanged.
 *   3. Hard error - caller is expected to surface the message and exit.
 *
 * Returns a `Result` so the caller decides how to surface failure (CLI prints
 * and exits 2; tests assert on `message`). No `process.exit` here.
 */

export interface ResolvedVersion {
    label: string;
    folder: string;
    root: string;
}

export type ResolveVersionResult = Result<ResolvedVersion>;

export interface ResolveVersionInput {
    /** Value of the `--versionLabel` flag, if the user passed one. */
    explicitLabel?: string;
    /** Final value of the `-d` / `--output` flag (already resolved to abs path). */
    outputFolder: string;
    /** Value of the `--versionsRoot` flag if the user passed one. */
    explicitRoot?: string;
    /** Project root (typically dirname of the resolved tsconfig). */
    projectRoot?: string;
    /** Directory the CLI was invoked from. */
    cwd?: string;
}

const PACKAGE_JSON = 'package.json';

export function resolveVersion(input: ResolveVersionInput): ResolveVersionResult {
    const explicit = input.explicitLabel?.trim();
    const label = explicit && explicit.length > 0 ? explicit : detectFromPackageJson(input);

    if (!label) {
        return {
            ok: false,
            message:
                'Cannot determine version label. ' +
                'Pass --versionLabel <name> (for example --versionLabel main) ' +
                'or --no-multiVersion to keep the previous flat output layout.'
        };
    }

    const normalised = normaliseLabel(label);
    const outputAbs = resolve(input.outputFolder);
    const folder = join(outputAbs, normalised);
    // versions.json sits next to the version subfolders (i.e. inside the
    // user's `-d` directory) so consumers can deploy `-d` as the document
    // root and `/versions.json` resolves correctly. The `--versionsRoot`
    // override exists for split-repo CI setups that build each version
    // separately and stitch them under a different deploy root later.
    const root = input.explicitRoot ? resolve(input.explicitRoot) : outputAbs;

    return { ok: true, value: { label: normalised, folder, root } };
}

function detectFromPackageJson(input: ResolveVersionInput): string | undefined {
    const startPoints = [input.projectRoot, input.cwd].filter(
        (p): p is string => typeof p === 'string' && p.length > 0
    );
    for (const start of startPoints) {
        const pkg = walkUpForPackageJson(resolve(start));
        if (pkg) {
            const version = readVersion(pkg);
            if (version) {
                return version;
            }
        }
    }
    return undefined;
}

function walkUpForPackageJson(start: string): string | undefined {
    let current = start;
    while (true) {
        const candidate = join(current, PACKAGE_JSON);
        if (existsSync(candidate)) {
            return candidate;
        }
        const parent = dirname(current);
        if (parent === current) {
            return undefined;
        }
        current = parent;
    }
}

function readVersion(pkgPath: string): string | undefined {
    try {
        const contents = readFileSync(pkgPath, 'utf8');
        const parsed = JSON.parse(contents);
        const version = typeof parsed?.version === 'string' ? parsed.version.trim() : '';
        return version.length > 0 ? version : undefined;
    } catch {
        return undefined;
    }
}

function normaliseLabel(label: string): string {
    const trimmed = label.trim();
    if (/^\d+\.\d+\.\d+/.test(trimmed)) {
        return `v${trimmed}`;
    }
    return trimmed;
}
