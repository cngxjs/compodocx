import { posix } from 'node:path';
import { BARE_SPEC_RE } from './import-specifiers';

/**
 * Vendoring the locally built library into the StackBlitz file map.
 *
 * StackBlitz resolves registry `dependencies` against the last PUBLISHED
 * version, never the working tree - so a playground that imports an
 * unreleased symbol hard-fails in the sandbox. compodocx already inlines the
 * example sources into the project file map; vendoring is the same mechanism
 * one level deeper: read the locally built `dist/<pkg>` at docs-build time and
 * embed those files into the same payload, wiring each package as a local
 * `file:` dependency so the WebContainer's `npm install` resolves it (and its
 * inter-package deps) locally instead of from the registry.
 *
 * This module is the PURE half - directory walking and file reads come through
 * an injected {@link VendorFsReader}, mirroring `read-file-ref.ts`. The
 * page-generator wrapper plugs the real `fs`.
 */

/** One resolved vendor package, ready to embed into a manifest file map. */
export interface VendorPackage {
    /** Full npm package name (the value matched against a vendor pattern). */
    name: string;
    /** Files under the package dir, keyed by POSIX path relative to the dir. */
    files: Record<string, string>;
    /**
     * Names of OTHER vendored packages this one depends on - the closure
     * edges. Computed as `(dependencies ∪ peerDependencies) ∩ vendoredNames`,
     * so registry-only peers (`@angular/*`, `rxjs`, `tslib`) are excluded.
     */
    vendorDeps: string[];
    /** Sum of `files` content byte lengths - drives the payload size guard. */
    byteSize: number;
}

/**
 * Tiny FS abstraction kept local to the vendor resolver. `listFiles` returns
 * the recursive set of file paths under `dir` (POSIX-joined onto `dir`);
 * `readFile` returns `null` on miss rather than throwing.
 */
export interface VendorFsReader {
    exists(path: string): boolean;
    readFile(path: string): string | null;
    listFiles(dir: string): string[];
}

export interface VendorResolveResult {
    /** Resolved packages keyed by full package name. */
    packages: Record<string, VendorPackage>;
    /** Non-fatal notices (e.g. a glob that matched nothing). */
    warnings: string[];
    /** Fatal problems (missing root, an explicitly-named package absent). */
    errors: string[];
}

/** Knobs for the read loop's non-runtime-file slimming. */
export interface VendorResolveOptions {
    /**
     * Keep `*.map` sourcemaps in the vendored set. Default `false` - sourcemaps
     * are dead weight in the WebContainer and a large slice of FESM byte size.
     * Set from the `playgroundVendorIncludeSourcemaps` config key.
     */
    includeSourcemaps?: boolean;
}

const toPosix = (p: string): string => p.replaceAll('\\', '/');

const stripDotSlash = (p: string): string => p.replace(/^\.\//, '');

/**
 * Legacy / duplicate bundle directories ng-packagr emits alongside
 * `fesm2022/`. Only `fesm2022` is consumed by the esbuild-based Angular builder
 * the StackBlitz `node` template runs; the rest (per-file `esm2022` linker
 * output, older targets, UMD `bundles/`) are never resolved and only inflate
 * the POST payload. Matched anywhere in the relative path.
 */
const LEGACY_BUNDLE_DIR_RE = /(?:^|\/)(?:esm2022|esm2020|esm2015|fesm2020|fesm2015|bundles)\//;

/**
 * True when a vendored file is a runtime artifact the WebContainer build needs.
 * Drops `*.map` sourcemaps (unless `includeSourcemaps`) and legacy bundle dirs;
 * keeps `fesm2022/*.mjs`, typings (`*.d.ts`, needed for AOT template
 * typecheck), and every `package.json` (root + secondary entry points).
 */
const isVendorRuntimeFile = (rel: string, includeSourcemaps: boolean): boolean => {
    if (!includeSourcemaps && rel.endsWith('.map')) {
        return false;
    }
    return !LEGACY_BUNDLE_DIR_RE.test(rel);
};

const isGlob = (pattern: string): boolean => pattern.includes('*');

/**
 * Match a package name against a vendor pattern. `*` matches any run of
 * characters (including `/`), so `@cngx/*` matches `@cngx/ui` and an exact
 * name matches only itself. Intentionally simple - vendor patterns are short
 * package globs, not full minimatch.
 */
const matchesPattern = (name: string, pattern: string): boolean => {
    if (!isGlob(pattern)) {
        return name === pattern;
    }
    const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`).replaceAll('*', '.*');
    return new RegExp(`^${escaped}$`).test(name);
};

const matchesAnyPattern = (name: string, patterns: string[]): boolean =>
    patterns.some(p => matchesPattern(name, p));

const depth = (dir: string): number => dir.split('/').length;

const isAncestorDir = (ancestor: string, dir: string): boolean =>
    dir === ancestor || dir.startsWith(`${ancestor}/`);

/**
 * Resolve the set of vendor packages available under `vendorRoot` that match
 * any of `patterns`. Primary package roots are detected by `package.json`
 * `name` (convention-free - works regardless of the dist directory layout);
 * secondary-entry-point `package.json`s nested inside a primary root are kept
 * as files but never treated as their own package. Pure apart from `fs`.
 */
export function resolveVendorPackages(
    patterns: string[],
    vendorRoot: string,
    fs: VendorFsReader,
    options: VendorResolveOptions = {}
): VendorResolveResult {
    const includeSourcemaps = options.includeSourcemaps === true;
    const warnings: string[] = [];
    const errors: string[] = [];
    const packages: Record<string, VendorPackage> = {};

    if (patterns.length === 0) {
        return { packages, warnings, errors };
    }

    const root = toPosix(vendorRoot);
    if (!fs.exists(root)) {
        errors.push(
            `playgroundVendor: vendor root "${vendorRoot}" not found — build the libraries before compodocx`
        );
        return { packages, warnings, errors };
    }

    const allFiles = fs.listFiles(root).map(toPosix);

    // Discover package roots by their package.json `name`. The shallowest dir
    // with a name wins; deeper ones nested inside it are secondary entry points.
    type RootInfo = { dir: string; name: string; deps: string[] };
    const candidates: RootInfo[] = [];
    for (const file of allFiles) {
        if (posix.basename(file) !== 'package.json' || file.includes('/node_modules/')) {
            continue;
        }
        const raw = fs.readFile(file);
        if (raw === null) {
            continue;
        }
        let parsed: {
            name?: unknown;
            dependencies?: unknown;
            peerDependencies?: unknown;
        };
        try {
            parsed = JSON.parse(raw);
        } catch {
            continue;
        }
        if (typeof parsed.name !== 'string' || parsed.name.length === 0) {
            continue;
        }
        const deps = {
            ...(typeof parsed.dependencies === 'object' && parsed.dependencies !== null
                ? (parsed.dependencies as Record<string, string>)
                : {}),
            ...(typeof parsed.peerDependencies === 'object' && parsed.peerDependencies !== null
                ? (parsed.peerDependencies as Record<string, string>)
                : {})
        };
        candidates.push({
            dir: posix.dirname(file),
            name: parsed.name,
            deps: Object.keys(deps)
        });
    }

    candidates.sort((a, b) => depth(a.dir) - depth(b.dir));
    const primaries: RootInfo[] = [];
    for (const cand of candidates) {
        if (!primaries.some(p => isAncestorDir(p.dir, cand.dir))) {
            primaries.push(cand);
        }
    }

    const matchedPrimaries = primaries.filter(p => matchesAnyPattern(p.name, patterns));
    const vendoredNames = new Set(matchedPrimaries.map(p => p.name));

    for (const primary of matchedPrimaries) {
        const files: Record<string, string> = {};
        let byteSize = 0;
        const prefix = `${primary.dir}/`;
        for (const file of allFiles) {
            if (!file.startsWith(prefix) || file.includes('/node_modules/')) {
                continue;
            }
            const rel = file.slice(prefix.length);
            // Slim the vendored set: drop sourcemaps and legacy bundle dirs the
            // WebContainer build never reads. byteSize then reflects only what
            // actually ships, so the closure cap measures the real payload.
            if (!isVendorRuntimeFile(rel, includeSourcemaps)) {
                continue;
            }
            const content = fs.readFile(file);
            if (content === null) {
                continue;
            }
            files[rel] = content;
            byteSize += content.length;
        }
        packages[primary.name] = {
            name: primary.name,
            files,
            vendorDeps: primary.deps.filter(d => vendoredNames.has(d)),
            byteSize
        };
    }

    // An explicitly-named (non-glob) package that didn't resolve is fatal:
    // the author asked for it by name and the build can't honour that.
    for (const pattern of patterns) {
        if (isGlob(pattern)) {
            if (!matchedPrimaries.some(p => matchesPattern(p.name, pattern))) {
                warnings.push(
                    `playgroundVendor: pattern "${pattern}" matched no package under ${vendorRoot}`
                );
            }
        } else if (!vendoredNames.has(pattern)) {
            errors.push(
                `playgroundVendor: "${pattern}" not found under ${vendorRoot} — run the library build before compodocx`
            );
        }
    }

    return { packages, warnings, errors };
}

/**
 * Walk the vendor dependency closure for one playground. Given the package
 * roots the playground's imports reference directly (`seeds`), follow each
 * vendored package's `vendorDeps` to collect the FULL set that must ship - so
 * vendoring `@cngx/ui` also vendors `@cngx/common`/`@cngx/core` rather than
 * pulling them stale from the registry. Pure graph traversal over the
 * in-memory package map. Seeds not present in `packages` are ignored.
 */
export function vendorClosure(
    seeds: Iterable<string>,
    packages: Record<string, VendorPackage>
): string[] {
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const seed of seeds) {
        if (packages[seed]) {
            queue.push(seed);
        }
    }
    while (queue.length > 0) {
        const next = queue.shift();
        if (next === undefined || visited.has(next)) {
            continue;
        }
        visited.add(next);
        for (const dep of packages[next].vendorDeps) {
            if (!visited.has(dep) && packages[dep]) {
                queue.push(dep);
            }
        }
    }
    return Array.from(visited);
}

// ---------------------------------------------------------------------------
// Entry-point pruning
//
// A vendored package ships a FESM chunk + typings per ENTRY POINT (`@cngx/ui`,
// `@cngx/ui/tabs`, …). Embedding all of them when the playground imports only
// one is the main payload lever. `pruneVendorClosure` keeps, per package, only
// the entry points actually reachable: the ones imported from the playground
// sources, plus any sibling/cross-package entry point a kept FESM chunk (or its
// typings) references - followed transitively. Everything unreached is dropped.
// On any structural ambiguity it falls back to shipping the whole (slimmed)
// package: a wrong prune breaks the build, a fat one only costs bytes.
// ---------------------------------------------------------------------------

/**
 * Relative (`.`-prefixed) import/export specifier scanner for intra-dir FESM.
 * Looser than the user-source scanners (no whitespace needed after the
 * keyword, any `.` prefix): it runs on built bundles, where a missed sibling
 * breaks the pruned package and an extra one only costs bytes.
 */
const RELATIVE_SPEC_RE = /(?:from|import|export\s+[^'"]*from)\s*['"](\.[^'"]*)['"]/g;

/**
 * Every bare-specifier import/export in `source`, verbatim (subpath kept -
 * `@cngx/ui/tabs`, not `@cngx/ui`). Pure. Distinct from the manifest builder's
 * `extractBareSpecifiers`, which collapses to package roots for dependency
 * lookup; pruning needs the subpath to map to an entry point.
 */
export const extractRawBareSpecifiers = (source: string): string[] => {
    if (typeof source !== 'string' || source.length === 0) {
        return [];
    }
    const out: string[] = [];
    BARE_SPEC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BARE_SPEC_RE.exec(source)) !== null) {
        out.push(m[1]);
    }
    return out;
};

/** Every relative (`./…`, `../…`) import/export specifier in `source`. Pure. */
export const extractRelativeImports = (source: string): string[] => {
    if (typeof source !== 'string' || source.length === 0) {
        return [];
    }
    const out: string[] = [];
    RELATIVE_SPEC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RELATIVE_SPEC_RE.exec(source)) !== null) {
        out.push(m[1]);
    }
    return out;
};

/** One resolved entry point of a vendored package, ready to keep or drop. */
interface EntryPoint {
    /** Full import specifier (`@cngx/ui` for root, `@cngx/ui/tabs` otherwise). */
    specifier: string;
    /** Directory relative to the package root (`''` for root, `tabs`, …). */
    dir: string;
    /** FESM chunk path relative to package root, if resolvable. */
    fesm: string | null;
    /** Files this entry point owns (FESM chunk + entry-dir typings + pkg.json). */
    files: Set<string>;
}

/** Parsed entry-point map for one package; `keepAll` when structure is opaque. */
interface EntryIndex {
    name: string;
    /** Always-kept files (root `package.json` + root-level `*.d.ts`). */
    rootFiles: Set<string>;
    bySpecifier: Map<string, EntryPoint>;
    /** Reverse: FESM chunk path → owning entry specifier. */
    fesmToSpecifier: Map<string, string>;
    /** When true the package is shipped whole (unparseable / no entry points). */
    keepAll: boolean;
}

const safeParse = (raw: string | undefined): Record<string, unknown> | null => {
    if (typeof raw !== 'string') {
        return null;
    }
    try {
        const v = JSON.parse(raw);
        return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
    } catch {
        return null;
    }
};

/** Pick the first conditional-export / package-field value that names a kept
 * `.mjs` chunk (FESM, never the dropped `esm2022` per-file output). */
const pickFesm = (
    fields: Record<string, unknown> | null,
    baseDir: string,
    files: Record<string, string>
): string | null => {
    if (!fields) {
        return null;
    }
    // `default`/`module`/`fesm2022` point at the FESM bundle; `esm2022`/`esm`
    // point at the per-file output we drop, so they are deliberately skipped.
    const order = ['fesm2022', 'default', 'module', 'browser', 'import', 'node'];
    for (const key of order) {
        const v = fields[key];
        if (typeof v !== 'string' || !v.endsWith('.mjs')) {
            continue;
        }
        const rel = stripDotSlash(posix.normalize(posix.join(baseDir, v)));
        if (rel in files && !LEGACY_BUNDLE_DIR_RE.test(rel)) {
            return rel;
        }
    }
    return null;
};

/** Resolve an entry's typings via the `types`/`typings` export condition.
 * ng-packagr emits per-entry typings into a FLAT `types/` dir and points at
 * them through this condition (`@cngx/ui/tabs` → `./types/cngx-ui-tabs.d.ts`),
 * NOT into the entry's own directory - so they must be resolved from the
 * condition, never by directory prefix. Without this the entry FESM ships but
 * its `.d.ts` is dropped, and the AOT build fails with TS7016 → NG1010. */
const pickTypes = (
    fields: Record<string, unknown> | null,
    baseDir: string,
    files: Record<string, string>
): string | null => {
    if (!fields) {
        return null;
    }
    for (const key of ['types', 'typings']) {
        const v = fields[key];
        if (typeof v !== 'string' || !v.endsWith('.d.ts')) {
            continue;
        }
        const rel = stripDotSlash(posix.normalize(posix.join(baseDir, v)));
        if (rel in files) {
            return rel;
        }
    }
    return null;
};

const buildEntryIndex = (pkg: VendorPackage): EntryIndex => {
    const files = pkg.files;
    const root = safeParse(files['package.json']);
    const name = pkg.name;
    const index: EntryIndex = {
        name,
        rootFiles: new Set<string>(),
        bySpecifier: new Map(),
        fesmToSpecifier: new Map(),
        keepAll: false
    };
    // Only prune packages whose entry-point structure we can read with
    // confidence: a parseable root `package.json` with an `exports` map (every
    // ng-packagr build since Angular 13 emits one). Anything older / hand-rolled
    // is shipped whole - a fat payload beats a wrong prune.
    const exportsMap = root?.exports;
    if (!root || !exportsMap || typeof exportsMap !== 'object') {
        index.keepAll = true;
        return index;
    }

    // Root always-keep: package.json (resolution surface) + root-level typings.
    if ('package.json' in files) {
        index.rootFiles.add('package.json');
    }
    for (const rel of Object.keys(files)) {
        if (!rel.includes('/') && rel.endsWith('.d.ts')) {
            index.rootFiles.add(rel);
        }
    }

    // Typings resolved via the `types` export condition (see `pickTypes`) -
    // tracked so the directory-prefix fallback below does not re-assign them to
    // the root entry (their `types/` path never matches a secondary entry dir).
    const claimedTypings = new Set<string>();

    const addEntry = (
        specifier: string,
        dir: string,
        fesm: string | null,
        types: string | null
    ): void => {
        if (index.bySpecifier.has(specifier)) {
            return;
        }
        const entry: EntryPoint = { specifier, dir, fesm, files: new Set() };
        if (fesm && fesm in files) {
            entry.files.add(fesm);
            index.fesmToSpecifier.set(fesm, specifier);
        }
        if (types && types in files) {
            entry.files.add(types);
            claimedTypings.add(types);
        }
        const secondaryPkg = dir === '' ? 'package.json' : `${dir}/package.json`;
        if (secondaryPkg in files) {
            entry.files.add(secondaryPkg);
        }
        index.bySpecifier.set(specifier, entry);
    };

    // Primary source of entry points: the root `exports` map (ng-packagr emits
    // one key per entry point, even when there is no secondary package.json).
    for (const [key, cond] of Object.entries(exportsMap as Record<string, unknown>)) {
        if (key === './package.json' || !key.startsWith('.')) {
            continue;
        }
        const dir = key === '.' ? '' : stripDotSlash(key);
        const specifier = key === '.' ? name : `${name}/${dir}`;
        const condObj =
            typeof cond === 'object' && cond !== null ? (cond as Record<string, unknown>) : null;
        addEntry(specifier, dir, pickFesm(condObj, '', files), pickTypes(condObj, '', files));
    }

    // Secondary entry points expressed as nested package.json (older layouts /
    // no exports map). Each resolves its FESM relative to its own directory.
    for (const rel of Object.keys(files)) {
        if (posix.basename(rel) !== 'package.json' || rel === 'package.json') {
            continue;
        }
        const dir = posix.dirname(rel);
        const specifier = `${name}/${dir}`;
        if (index.bySpecifier.has(specifier)) {
            continue;
        }
        const sub = safeParse(files[rel]);
        addEntry(specifier, dir, pickFesm(sub, dir, files), pickTypes(sub, dir, files));
    }

    // Root entry from package-level fields when no `.` export existed.
    if (!index.bySpecifier.has(name)) {
        addEntry(name, '', pickFesm(root, '', files), pickTypes(root, '', files));
    }

    // Assign remaining typings to the deepest entry directory that owns them
    // (root entry gets only root-level files; `tabs/*.d.ts` → the tabs entry).
    const entriesByDepth = [...index.bySpecifier.values()].sort(
        (a, b) => b.dir.length - a.dir.length
    );
    for (const rel of Object.keys(files)) {
        if (
            index.fesmToSpecifier.has(rel) ||
            claimedTypings.has(rel) ||
            posix.basename(rel) === 'package.json'
        ) {
            continue;
        }
        const owner = entriesByDepth.find(
            e => e.dir === '' || rel === e.dir || rel.startsWith(`${e.dir}/`)
        );
        if (owner) {
            owner.files.add(rel);
        }
    }

    return index;
};

/** Longest closure-package name that owns `specifier` (`name` or `name/...`). */
const ownerOf = (specifier: string, names: string[]): string | null => {
    let best: string | null = null;
    for (const n of names) {
        if (
            (specifier === n || specifier.startsWith(`${n}/`)) &&
            (best === null || n.length > best.length)
        ) {
            best = n;
        }
    }
    return best;
};

/**
 * Prune each package in a vendor closure down to the entry points reachable
 * from the playground's own imports (`importedRawSpecs` - raw subpaths from TS
 * imports AND SCSS `@use`), following intra- and cross-package entry-point
 * references transitively. Returns the kept file map per package, keyed by full
 * package name. Packages whose structure can't be read, or for which an
 * imported subpath matches no known entry point, are returned whole (slimmed).
 *
 * Pure - operates entirely on the in-memory package map.
 */
export function pruneVendorClosure(
    closureNames: string[],
    packages: Record<string, VendorPackage>,
    importedRawSpecs: Iterable<string>
): Record<string, Record<string, string>> {
    const names = closureNames.filter(n => packages[n]);
    const indexes = new Map<string, EntryIndex>();
    for (const n of names) {
        indexes.set(n, buildEntryIndex(packages[n]));
    }

    const keepAll = new Set<string>(names.filter(n => indexes.get(n)?.keepAll));
    const keptEntries = new Set<string>(); // `${pkg} ${specifier}`
    const extraFiles = new Map<string, Set<string>>(); // orphan FESM chunks per pkg
    const queue: Array<{ pkg: string; specifier: string }> = [];

    const requestEntry = (specifier: string): void => {
        const pkg = ownerOf(specifier, names);
        if (pkg === null || keepAll.has(pkg)) {
            return;
        }
        const idx = indexes.get(pkg);
        if (!idx) {
            return;
        }
        if (idx.bySpecifier.has(specifier)) {
            queue.push({ pkg, specifier });
        } else {
            // Imported subpath we can't map to an entry point → ship the whole
            // package rather than guess and risk a broken build.
            keepAll.add(pkg);
        }
    };

    for (const spec of importedRawSpecs) {
        requestEntry(spec);
    }

    while (queue.length > 0) {
        const { pkg, specifier } = queue.shift()!;
        const key = `${pkg} ${specifier}`;
        if (keptEntries.has(key) || keepAll.has(pkg)) {
            continue;
        }
        keptEntries.add(key);
        const idx = indexes.get(pkg);
        const entry = idx?.bySpecifier.get(specifier);
        if (!idx || !entry) {
            continue;
        }
        const files = packages[pkg].files;
        // Follow what this entry's shipped sources reference: FESM chunk for
        // runtime edges, typings for type-only cross-package edges.
        for (const rel of entry.files) {
            const content = files[rel];
            if (content === undefined) {
                continue;
            }
            for (const bare of extractRawBareSpecifiers(content)) {
                requestEntry(bare);
            }
            if (entry.fesm && rel === entry.fesm) {
                const fromDir = posix.dirname(entry.fesm);
                for (const relSpec of extractRelativeImports(content)) {
                    const target = stripDotSlash(posix.normalize(posix.join(fromDir, relSpec)));
                    if (!(target in files)) {
                        continue;
                    }
                    const ownerSpec = idx.fesmToSpecifier.get(target);
                    if (ownerSpec) {
                        queue.push({ pkg, specifier: ownerSpec });
                    } else {
                        (extraFiles.get(pkg) ?? extraFiles.set(pkg, new Set()).get(pkg)!).add(
                            target
                        );
                    }
                }
            }
        }
    }

    const result: Record<string, Record<string, string>> = {};
    for (const pkg of names) {
        const allFiles = packages[pkg].files;
        if (keepAll.has(pkg)) {
            result[pkg] = { ...allFiles };
            continue;
        }
        const idx = indexes.get(pkg)!;
        const keep = new Set<string>(idx.rootFiles);
        for (const entry of idx.bySpecifier.values()) {
            if (keptEntries.has(`${pkg} ${entry.specifier}`)) {
                for (const f of entry.files) {
                    keep.add(f);
                }
            }
        }
        for (const f of extraFiles.get(pkg) ?? []) {
            keep.add(f);
        }
        const out: Record<string, string> = {};
        for (const rel of keep) {
            if (rel in allFiles) {
                out[rel] = allFiles[rel];
            }
        }
        result[pkg] = out;
    }
    return result;
}
