import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VERSIONS_JSON_SCHEMA_VERSION } from '../../../src/app/interfaces/versions-manifest.interface';
import {
    emptyManifest,
    getManifestPath,
    mergeEntry,
    readManifest,
    sortVersions,
    writeManifest
} from '../../../src/utils/versions-manifest.util';

let tempRoot: string;

beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'versions-manifest-'));
});

afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
});

function entry(label: string, path = `${label}/`, builtAt = '2026-05-08T00:00:00.000Z') {
    return { label, path, builtAt };
}

describe('readManifest', () => {
    it('returns an empty manifest when versions.json is absent', () => {
        const result = readManifest(tempRoot);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.versions).toEqual([]);
            expect(result.value.schemaVersion).toBe(VERSIONS_JSON_SCHEMA_VERSION);
        }
    });

    it('reads an existing well-formed manifest', () => {
        const manifest = {
            schemaVersion: VERSIONS_JSON_SCHEMA_VERSION,
            updatedAt: '2026-05-08T00:00:00.000Z',
            versions: [entry('v1.0.0')]
        };
        writeFileSync(getManifestPath(tempRoot), JSON.stringify(manifest));
        const result = readManifest(tempRoot);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.versions).toHaveLength(1);
        }
    });

    it('rejects a future schemaVersion with an upgrade hint', () => {
        writeFileSync(
            getManifestPath(tempRoot),
            JSON.stringify({ schemaVersion: 999, updatedAt: 'x', versions: [] })
        );
        const result = readManifest(tempRoot);
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/newer than/);
        }
    });

    it('rejects an unsupported (older / non-numeric) schemaVersion with a regen hint', () => {
        writeFileSync(
            getManifestPath(tempRoot),
            JSON.stringify({ schemaVersion: 0, updatedAt: 'x', versions: [] })
        );
        const result = readManifest(tempRoot);
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/Delete the file/);
        }
    });

    it('rejects a corrupted JSON payload', () => {
        writeFileSync(getManifestPath(tempRoot), '{ not json');
        const result = readManifest(tempRoot);
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/Failed to parse/);
        }
    });

    it('rejects a manifest missing the versions array', () => {
        writeFileSync(
            getManifestPath(tempRoot),
            JSON.stringify({ schemaVersion: VERSIONS_JSON_SCHEMA_VERSION })
        );
        const result = readManifest(tempRoot);
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/versions/);
        }
    });
});

describe('mergeEntry', () => {
    it('appends a new entry when label is unseen', () => {
        const next = mergeEntry(emptyManifest(), entry('v1.0.0'));
        expect(next.versions.map(v => v.label)).toEqual(['v1.0.0']);
    });

    it('replaces an existing entry with the same label and updates builtAt', () => {
        const initial = mergeEntry(emptyManifest(), entry('v1.0.0', 'v1.0.0/', 'old'));
        const next = mergeEntry(initial, entry('v1.0.0', 'v1.0.0/', 'new'));
        expect(next.versions).toHaveLength(1);
        expect(next.versions[0].builtAt).toBe('new');
    });

    it('preserves neighbouring entries when re-merging', () => {
        let manifest = mergeEntry(emptyManifest(), entry('v1.0.0'));
        manifest = mergeEntry(manifest, entry('v2.0.0'));
        manifest = mergeEntry(manifest, entry('v2.0.0', 'v2.0.0/', 'updated'));
        expect(manifest.versions.map(v => v.label)).toEqual(['v2.0.0', 'v1.0.0']);
    });
});

describe('sortVersions', () => {
    it('sorts semver labels descending (newest first)', () => {
        const sorted = sortVersions([entry('v1.2.0'), entry('v2.0.1'), entry('v1.10.0')]);
        expect(sorted.map(v => v.label)).toEqual(['v2.0.1', 'v1.10.0', 'v1.2.0']);
    });

    it('places non-semver labels after all semver entries', () => {
        const sorted = sortVersions([entry('main'), entry('v1.0.0'), entry('next')]);
        expect(sorted.map(v => v.label)).toEqual(['v1.0.0', 'main', 'next']);
    });

    it('sorts non-semver labels lexicographically', () => {
        const sorted = sortVersions([entry('next'), entry('beta'), entry('main')]);
        expect(sorted.map(v => v.label)).toEqual(['beta', 'main', 'next']);
    });
});

describe('writeManifest', () => {
    it('writes versions.json atomically (no leftover temp file)', () => {
        mkdirSync(tempRoot, { recursive: true });
        writeManifest(tempRoot, mergeEntry(emptyManifest(), entry('v1.0.0')));
        expect(existsSync(getManifestPath(tempRoot))).toBe(true);
        const leftover = require('node:fs')
            .readdirSync(tempRoot)
            .filter((f: string) => f.includes('.tmp'));
        expect(leftover).toEqual([]);
    });

    it('round-trips through readManifest preserving entries', () => {
        const written = mergeEntry(mergeEntry(emptyManifest(), entry('v1.0.0')), entry('v2.0.0'));
        writeManifest(tempRoot, written);
        const back = readManifest(tempRoot);
        expect(back.ok).toBe(true);
        if (back.ok) {
            expect(back.value.versions.map(v => v.label)).toEqual(['v2.0.0', 'v1.0.0']);
        }
    });

    it('produces JSON content with a trailing newline', () => {
        writeManifest(tempRoot, mergeEntry(emptyManifest(), entry('v1.0.0')));
        const body = readFileSync(getManifestPath(tempRoot), 'utf8');
        expect(body.endsWith('\n')).toBe(true);
        expect(body).toMatch(/"schemaVersion":\s*1/);
    });
});
