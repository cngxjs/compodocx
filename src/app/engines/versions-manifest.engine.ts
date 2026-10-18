import { mkdirSync } from 'node:fs';
import { isErr } from '../../lib';
import { logger } from '../../utils/logger';
import {
    emptyManifest,
    mergeEntry,
    readManifest,
    writeManifest,
    writeVersionsRootIndex
} from '../../utils/versions-manifest.util';

/**
 * Reads the existing `versions.json` (or starts empty), merges in the
 * just-built version entry, and writes it back atomically. Called from
 * `application.ts` after `processResources` has finished copying assets,
 * so a successful run results in a manifest that includes the version
 * the user just built.
 *
 * Failure modes are surfaced via `logger.error` and re-thrown - a corrupt
 * manifest in a CI pipeline should fail the build, not silently skip the
 * write and leave consumers with a stale dropdown.
 *
 * Then writes the root `index.html` that opens the newest version, unless
 * the user keeps a landing page of their own there.
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
    if (isErr(read)) {
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
    if (writeVersionsRootIndex(input.versionsRoot, merged) === 'kept') {
        logger.debug('index.html in the versions root is not from compodocx; left as is');
    }
}
