import { resolvePackageRoot } from './import-specifiers';

/**
 * Pre-publish breakage guard (non-vendored path).
 *
 * A `@playground` whose imports are served from the npm REGISTRY resolves
 * against the last PUBLISHED version. If the example imports a subpath or
 * symbol that only exists in the working tree (or a yet-unreleased version),
 * it compiles locally but hard-fails in the StackBlitz sandbox. This module
 * resolves each bare import against the version actually installed in the
 * consumer's `node_modules` and reports what the pinned version is missing —
 * catching the breakage at docs-build time instead of on Launch.
 *
 * Two layers: a pure source scanner (`extractImports`) and a pure validator
 * (`validateImports`) whose package I/O comes through an injected
 * {@link PackageReader}, mirroring the rest of the engine. Bias is toward
 * FEW FALSE POSITIVES: anything the static check cannot determine (legacy
 * packages without an `exports` map, wildcard re-exports in typings) is left
 * unreported rather than warned about.
 */

/** One parsed bare import: the full specifier plus the named bindings. */
export interface ParsedImport {
    /** Full module specifier, incl. subpath (`@cngx/ui/tabs`). */
    specifier: string;
    /**
     * Exported names the statement pulls in — the ORIGINAL export name, not
     * the local alias (`import { A as B }` → `A`). A default import records
     * `default`; namespace (`* as N`) and side-effect imports record nothing.
     */
    names: string[];
}

/** Minimal package.json subset the validator reads. */
interface InstalledPackageJson {
    version?: string;
    exports?: unknown;
    types?: string;
    typings?: string;
    main?: string;
    module?: string;
}

/**
 * Injected node_modules reader. `pkgRoot` is a package name (`@cngx/ui`);
 * `relPath` is POSIX-relative to that package's install dir. Implementations
 * return `null` on any miss rather than throwing.
 */
export interface PackageReader {
    hasPackage(pkgRoot: string): boolean;
    readPackageJson(pkgRoot: string): InstalledPackageJson | null;
    readPackageFile(pkgRoot: string, relPath: string): string | null;
}

export type ImportIssueKind = 'missing-subpath' | 'missing-symbol';

export interface ImportIssue {
    specifier: string;
    kind: ImportIssueKind;
    /** Symbol name for `missing-symbol`; absent for `missing-subpath`. */
    symbol?: string;
    /** Installed version the check ran against, when known. */
    pinnedVersion?: string;
    message: string;
}

// Captures `import ... from 'spec'` and `export ... from 'spec'`, keeping the
// clause (between the keyword and `from`) and the specifier. Also matches a
// bare side-effect `import 'spec'` (empty clause). Stricter than BARE_SPEC_RE
// (keywords on word boundaries, clause captured): it feeds symbol checks, so
// a prose `from 'x'` must not count as an import.
const IMPORT_STMT_RE =
    /\b(?:import|export)\b([^'";]*?)\bfrom\b\s*['"]([^'"]+)['"]|(?:\bimport\b)\s*['"]([^'"]+)['"]/g;

const subpathOf = (specifier: string, root: string): string => {
    const rest = specifier.slice(root.length);
    return rest.length === 0 ? '.' : `.${rest}`;
};

/**
 * Parse the named bindings out of an import clause. Handles `{ A, B as C }`,
 * a leading default (`D, { ... }`), and `* as N` (recorded as no names).
 */
const parseClause = (clause: string): string[] => {
    const names: string[] = [];
    const trimmed = clause.trim();
    if (trimmed.length === 0) {
        return names;
    }
    // Named group `{ ... }`.
    const braceMatch = trimmed.match(/\{([^}]*)\}/);
    if (braceMatch) {
        for (const part of braceMatch[1].split(',')) {
            const token = part.trim();
            if (token.length === 0 || token === 'type') {
                continue;
            }
            // `Original as Local` → the package must export `Original`.
            const original = token
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/)[0]
                .trim();
            if (original.length > 0) {
                names.push(original);
            }
        }
    }
    // Default import: a bare identifier before any `{`/`*`.
    const beforeBrace = trimmed.split(/[{*]/)[0].trim().replace(/,$/, '').trim();
    if (
        beforeBrace.length > 0 &&
        beforeBrace !== 'type' &&
        /^[A-Za-z_$][\w$]*$/.test(beforeBrace)
    ) {
        names.push('default');
    }
    return names;
};

/**
 * Scan TS/JS source for bare (non-relative) imports. Relative imports are
 * skipped — they ship inlined, not from the registry. Deduped by specifier,
 * with names merged. Pure.
 */
export function extractImports(source: string): ParsedImport[] {
    if (typeof source !== 'string' || source.length === 0) {
        return [];
    }
    const bySpecifier = new Map<string, Set<string>>();
    IMPORT_STMT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_STMT_RE.exec(source)) !== null) {
        const specifier = match[2] ?? match[3];
        if (!specifier || specifier.startsWith('.')) {
            continue;
        }
        const names = match[2] ? parseClause(match[1] ?? '') : [];
        const set = bySpecifier.get(specifier) ?? new Set<string>();
        for (const name of names) {
            set.add(name);
        }
        bySpecifier.set(specifier, set);
    }
    return Array.from(bySpecifier.entries()).map(([specifier, names]) => ({
        specifier,
        names: Array.from(names)
    }));
}

const asExportsObject = (exports: unknown): Record<string, unknown> | null =>
    typeof exports === 'object' && exports !== null && !Array.isArray(exports)
        ? (exports as Record<string, unknown>)
        : null;

/**
 * Decide whether `subpath` (`.` or `./tabs`) resolves in an `exports` map.
 * Honours exact keys and a single trailing `*` wildcard. When `exports` is a
 * string (single entry) only `.` resolves.
 */
const subpathResolves = (exports: unknown, subpath: string): boolean => {
    if (typeof exports === 'string') {
        return subpath === '.';
    }
    const obj = asExportsObject(exports);
    if (!obj) {
        return false;
    }
    if (Object.hasOwn(obj, subpath)) {
        return true;
    }
    for (const key of Object.keys(obj)) {
        if (key.endsWith('/*')) {
            const prefix = key.slice(0, -1); // keep trailing '/'
            if (subpath.startsWith(prefix)) {
                return true;
            }
        }
    }
    return false;
};

/** Pick the `.d.ts` path for `subpath` from the package.json, if discoverable. */
const typesPathFor = (pkg: InstalledPackageJson, subpath: string): string | null => {
    const obj = asExportsObject(pkg.exports);
    if (obj) {
        const entry = obj[subpath];
        if (typeof entry === 'string') {
            return entry.endsWith('.d.ts') ? entry : null;
        }
        const entryObj = asExportsObject(entry);
        const types = entryObj?.types ?? entryObj?.default;
        if (typeof types === 'string' && types.endsWith('.d.ts')) {
            return types;
        }
    }
    if (subpath === '.') {
        return pkg.types ?? pkg.typings ?? null;
    }
    return null;
};

const normalizeRel = (p: string): string => p.replace(/^\.?\//, '');

/**
 * Heuristic export-presence check over a `.d.ts`. Returns `true` if the symbol
 * is exported, `false` if it is provably absent, and `null` when the file
 * re-exports via wildcard (`export * from`) so presence can't be determined
 * statically — callers treat `null` as "don't warn".
 */
const symbolPresence = (dts: string, symbol: string): boolean | null => {
    if (symbol === 'default') {
        return /\bexport\s+default\b/.test(dts) ? true : null;
    }
    const direct = new RegExp(
        `\\bexport\\b[^\\n;]*\\b(?:declare\\s+)?(?:class|interface|type|enum|const|function|abstract)\\b[^\\n;]*\\b${symbol}\\b`
    );
    const reexport = new RegExp(`\\bexport\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`);
    if (direct.test(dts) || reexport.test(dts)) {
        return true;
    }
    if (/\bexport\s*\*\s*from\b/.test(dts)) {
        return null; // wildcard re-export — indeterminate
    }
    return false;
};

/**
 * Validate every bare import in `imports` against the installed version of its
 * package. `skip` holds specifiers/roots handled elsewhere (Angular peers,
 * vendored `file:` packages). Packages not installed are skipped silently —
 * the manifest's auto-forward already dropped them. Pure apart from `reader`.
 */
export function validateImports(
    imports: ParsedImport[],
    reader: PackageReader,
    skip: Set<string>
): ImportIssue[] {
    const issues: ImportIssue[] = [];
    for (const imp of imports) {
        const root = resolvePackageRoot(imp.specifier);
        if (skip.has(root) || skip.has(imp.specifier)) {
            continue;
        }
        if (!reader.hasPackage(root)) {
            continue;
        }
        const pkg = reader.readPackageJson(root);
        if (!pkg) {
            continue;
        }
        const subpath = subpathOf(imp.specifier, root);

        // Subpath check — only meaningful when the package declares `exports`.
        if (pkg.exports !== undefined && !subpathResolves(pkg.exports, subpath)) {
            issues.push({
                specifier: imp.specifier,
                kind: 'missing-subpath',
                pinnedVersion: pkg.version,
                message: `subpath "${subpath}" is not exported by ${root}@${pkg.version ?? '?'} — the playground would fail in StackBlitz`
            });
            continue; // can't check symbols of an unresolved subpath
        }

        // Symbol check — read the entry typings and look for each name.
        if (imp.names.length === 0) {
            continue;
        }
        const typesPath = typesPathFor(pkg, subpath);
        if (!typesPath) {
            continue; // legacy / no typings → indeterminate
        }
        const dts = reader.readPackageFile(root, normalizeRel(typesPath));
        if (dts === null) {
            continue;
        }
        for (const name of imp.names) {
            if (symbolPresence(dts, name) === false) {
                issues.push({
                    specifier: imp.specifier,
                    kind: 'missing-symbol',
                    symbol: name,
                    pinnedVersion: pkg.version,
                    message: `"${name}" is not exported by ${imp.specifier} in ${root}@${pkg.version ?? '?'} — the playground would fail in StackBlitz`
                });
            }
        }
    }
    return issues;
}
