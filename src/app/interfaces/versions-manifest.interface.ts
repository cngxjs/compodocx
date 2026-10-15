/**
 * Schema version of `versions.json`, the manifest file written next to the
 * deployment root when `--multiVersion` is on.
 *
 * Bump this constant whenever the shape of `VersionsManifest` (or any nested
 * field) changes in a way that breaks the client-side switcher widget or any
 * downstream tool that reads the manifest. Pre-v0.3.0 deployments have no
 * manifest at all; older manifests with a lower `schemaVersion` are rejected
 * with a guidance message that points the user at re-running the build.
 */
export const VERSIONS_JSON_SCHEMA_VERSION = 1 as const;

export type VersionsManifestSchemaVersion = typeof VERSIONS_JSON_SCHEMA_VERSION;

/**
 * Single entry in the `versions` array. `path` is the URL-relative folder
 * the version's `index.html` lives in, with a trailing slash. `builtAt` is
 * an ISO 8601 timestamp.
 */
export interface VersionsManifestEntry {
    label: string;
    path: string;
    builtAt: string;
}

/**
 * Shape of `versions.json`.
 *
 * The `versions` array is sorted descending by semver (with a lexicographic
 * tail for non-semver labels like `main` / `next`). The first entry is
 * implicitly the "latest" - there is intentionally no `isLatest` flag,
 * because that would race when two builds for different labels run in
 * parallel.
 */
export interface VersionsManifest {
    schemaVersion: VersionsManifestSchemaVersion;
    updatedAt: string;
    versions: VersionsManifestEntry[];
}
