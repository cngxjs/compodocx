import { mkdirSync } from 'node:fs';
import { logger } from '../../utils/logger';
import {
    emptyManifest,
    mergeEntry,
    readManifest,
    writeManifest
} from '../../utils/versions-manifest.util';

/**
 * Reads the existing `versions.json` (or starts empty), merges in the
 * just-built version entry, and writes it back atomically. Called from
 * `application.ts` after `processResources` has finished copying assets,
 * so a successful run results in a manifest that includes the version
 * the user just built.
 *
 * Failure modes are surfaced via `logger.error` and re-thrown — a corrupt
 * manifest in a CI pipeline should fail the build, not silently skip the
 * write and leave consumers with a stale dropdown.
 */
export interface VersionsManifestUpdateInput {
    versionsRoot: string;
    label: string;
    /** URL-relative folder path with trailing slash (e.g. `v1.2.3/`). */
    path: string;
    builtAt?: string;
}

export function updateVersionsManifest(input: VersionsManifestUpdateInput): void {
    mkdirSync(input.versionsRoot, { recursive: true });
    const read = readManifest(input.versionsRoot);
    const builtAt = input.builtAt ?? new Date().toISOString();
    const baseManifest = read.ok ? read.value : emptyManifest(builtAt);
    if (!read.ok) {
        logger.error(read.message);
        throw new Error(read.message);
    }
    const merged = mergeEntry(
        baseManifest,
        { label: input.label, path: input.path, builtAt },
        builtAt
    );
    writeManifest(input.versionsRoot, merged);
    logger.info(`versions.json updated (${merged.versions.length} versions)`);
}
