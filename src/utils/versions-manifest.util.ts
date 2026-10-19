import {
    closeSync,
    existsSync,
    fsyncSync,
    openSync,
    readFileSync,
    renameSync,
    unlinkSync,
    writeFileSync,
    writeSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
    VERSIONS_JSON_SCHEMA_VERSION,
    type VersionsManifest,
    type VersionsManifestEntry
} from '../app/interfaces/versions-manifest.interface';
import type { Result } from '../lib';

/**
 * Read/merge/write helpers for `versions.json`.
 *
 * Read:  tolerates missing files (returns an empty manifest); rejects
 *        manifests with an unknown future schemaVersion or with a structurally
 *        broken shape.
 * Merge: append-only, deduped by `label`. Re-running a build for the same
 *        label updates `builtAt` in place; never deletes neighbours.
 * Sort:  semver descending; non-semver labels (`main`, `next`) tail-sort
 *        lexicographically AFTER any semver entry.
 * Write: atomic via temp file + rename, with a final fsync on the temp file
 *        so concurrent build agents see a consistent file.
 */

const MANIFEST_FILE_NAME = 'versions.json';

export type ReadManifestResult = Result<VersionsManifest>;

export function getManifestPath(versionsRoot: string): string {
    return join(versionsRoot, MANIFEST_FILE_NAME);
}

export function emptyManifest(now: string = new Date().toISOString()): VersionsManifest {
    return {
        schemaVersion: VERSIONS_JSON_SCHEMA_VERSION,
        updatedAt: now,
        versions: []
    };
}

export function readManifest(versionsRoot: string): ReadManifestResult {
    const path = getManifestPath(versionsRoot);
    if (!existsSync(path)) {
        return { ok: true, value: emptyManifest() };
    }
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch (err) {
        return {
            ok: false,
            message: `Failed to read ${path}: ${(err as Error).message}`
        };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        return {
            ok: false,
            message:
                `Failed to parse ${path}: ${(err as Error).message}. ` +
                'Delete the file and re-run the build to regenerate it.'
        };
    }
    return validateManifest(parsed, path);
}

function validateManifest(value: unknown, path: string): ReadManifestResult {
    if (!isPlainObject(value)) {
        return { ok: false, message: `${path} is not a JSON object.` };
    }
    const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
    if (schemaVersion !== VERSIONS_JSON_SCHEMA_VERSION) {
        if (typeof schemaVersion === 'number' && schemaVersion > VERSIONS_JSON_SCHEMA_VERSION) {
            return {
                ok: false,
                message:
                    `${path} has schemaVersion ${schemaVersion} which is newer than the ` +
                    `${VERSIONS_JSON_SCHEMA_VERSION} this CLI supports. ` +
                    'Upgrade @cngxjs/compodocx and re-run.'
            };
        }
        return {
            ok: false,
            message:
                `${path} has unsupported schemaVersion ${String(schemaVersion)}. ` +
                'Delete the file and re-run the build to regenerate it.'
        };
    }
    const versions = (value as { versions?: unknown }).versions;
    if (!Array.isArray(versions) || !versions.every(isManifestEntry)) {
        return {
            ok: false,
            message:
                `${path} is missing a valid "versions" array. ` +
                'Delete the file and re-run the build to regenerate it.'
        };
    }
    const updatedAt = (value as { updatedAt?: unknown }).updatedAt;
    return {
        ok: true,
        value: {
            schemaVersion: VERSIONS_JSON_SCHEMA_VERSION,
            updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString(),
            versions: versions as VersionsManifestEntry[]
        }
    };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isManifestEntry(value: unknown): value is VersionsManifestEntry {
    if (!isPlainObject(value)) {
        return false;
    }
    return (
        typeof value.label === 'string' &&
        typeof value.path === 'string' &&
        typeof value.builtAt === 'string'
    );
}

/**
 * Insert (or replace) the given entry into the manifest, then re-sort.
 * Returns a new manifest object - does NOT mutate the input.
 */
export function mergeEntry(
    manifest: VersionsManifest,
    entry: VersionsManifestEntry,
    now: string = new Date().toISOString()
): VersionsManifest {
    const others = manifest.versions.filter(v => v.label !== entry.label);
    const next = sortVersions([...others, entry]);
    return {
        schemaVersion: VERSIONS_JSON_SCHEMA_VERSION,
        updatedAt: now,
        versions: next
    };
}

/**
 * Semver-descending sort with a lexicographic tail for non-semver labels.
 * Non-semver labels are pushed AFTER all semver entries so the implicit-
 * latest invariant (first entry is latest) survives mixed-label deploys.
 */
export function sortVersions(versions: VersionsManifestEntry[]): VersionsManifestEntry[] {
    return [...versions].sort(compareEntries);
}

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

function parseSemver(label: string): [number, number, number, string] | null {
    const m = SEMVER_RE.exec(label);
    if (!m) {
        return null;
    }
    return [Number(m[1]), Number(m[2]), Number(m[3]), label];
}

function compareEntries(a: VersionsManifestEntry, b: VersionsManifestEntry): number {
    const sa = parseSemver(a.label);
    const sb = parseSemver(b.label);
    if (sa && sb) {
        for (let i = 0; i < 3; i++) {
            if (sa[i] !== sb[i]) {
                return (sb[i] as number) - (sa[i] as number);
            }
        }
        return a.label.localeCompare(b.label);
    }
    if (sa && !sb) {
        return -1;
    }
    if (!sa && sb) {
        return 1;
    }
    return a.label.localeCompare(b.label);
}

/**
 * Atomic write: serialise to a sibling temp file, fsync, then rename over
 * the destination. Renames are atomic on POSIX and on NTFS, which covers the
 * platforms `engines.node >=22` deploys to.
 */
export function writeManifest(versionsRoot: string, manifest: VersionsManifest): void {
    const target = getManifestPath(versionsRoot);
    const dir = dirname(target);
    const tempPath = join(dir, `${MANIFEST_FILE_NAME}.${process.pid}.${Date.now()}.tmp`);
    const body = `${JSON.stringify(manifest, null, 4)}\n`;
    writeFileSync(tempPath, body, 'utf8');
    let fd: number | undefined;
    try {
        fd = openSync(tempPath, 'r+');
        writeSync(fd, '');
        fsyncSync(fd);
    } catch {
        /* fsync best-effort - rename still atomic */
    } finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
            } catch {
                /* ignore */
            }
        }
    }
    try {
        renameSync(tempPath, target);
    } catch (err) {
        try {
            unlinkSync(tempPath);
        } catch {
            /* ignore */
        }
        throw err;
    }
}

/** `generator` meta of the root `index.html` compodocx writes; only such a file is replaced. */
export const VERSIONS_ROOT_INDEX_MARKER = 'compodocx-versions-root';

const ROOT_INDEX_FILE_NAME = 'index.html';

const escapeHtml = (text: string): string =>
    text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

/**
 * Root `index.html` of a multi-version deploy: redirects to the newest
 * version (the first manifest entry) with a relative URL, plus a plain link.
 * No scripts, styles or external resources.
 */
export function versionsRootIndexHtml(manifest: VersionsManifest): string {
    const latest = manifest.versions[0];
    const href = escapeHtml(`${encodeURI(latest.path)}index.html`);
    const label = escapeHtml(latest.label);
    return (
        [
            '<!doctype html>',
            '<html>',
            '<head>',
            '<meta charset="utf-8">',
            `<meta name="generator" content="${VERSIONS_ROOT_INDEX_MARKER}">`,
            `<meta http-equiv="refresh" content="0; url=${href}">`,
            `<title>${label}</title>`,
            '</head>',
            '<body>',
            `<p><a href="${href}">${label}</a></p>`,
            '</body>',
            '</html>'
        ].join('\n') + '\n'
    );
}

/**
 * Writes the root `index.html` next to `versions.json`. A file without the
 * compodocx marker is the user's own landing page and is kept (`'kept'`);
 * a manifest without versions writes nothing (`'skipped'`).
 */
export function writeVersionsRootIndex(
    versionsRoot: string,
    manifest: VersionsManifest
): 'written' | 'kept' | 'skipped' {
    if (manifest.versions.length === 0) {
        return 'skipped';
    }
    const target = join(versionsRoot, ROOT_INDEX_FILE_NAME);
    const ours = `<meta name="generator" content="${VERSIONS_ROOT_INDEX_MARKER}">`;
    if (existsSync(target) && !readFileSync(target, 'utf8').includes(ours)) {
        return 'kept';
    }
    writeFileSync(target, versionsRootIndexHtml(manifest), 'utf8');
    return 'written';
}
