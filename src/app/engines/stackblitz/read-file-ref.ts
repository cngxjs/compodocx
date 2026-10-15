import { posix } from 'node:path';
import { isErr, type Result } from '../../../lib';
import { extractBareSpecifiers } from './build-playground-manifest';
import { STACKBLITZ_FILE_COUNT_CAP } from './constants';
import { rewriteDecoratorUrls, rewriteRelativeImports } from './rewrite-imports';

/**
 * Tiny FS abstraction so the engine module stays I/O-free at its boundary.
 * Production wiring in `application.ts` plugs `readFileSync`/`existsSync`;
 * tests pass a static map. `readFile` returns `null` (not throw) on miss -
 * keeping the result type local to this module.
 */
export interface FsReader {
    readFile(path: string): string | null;
    exists(path: string): boolean;
}

/**
 * Outcome of reading a `@playground` file reference. The two modes share
 * one type so the manifest builder branches on `replacesAppComponent`.
 *
 * - HTML mode (`.html`):
 *   `htmlSnippet` carries the file body, `replacesAppComponent` is `false`,
 *   `files` is empty. The manifest builder rebuilds the inline-snippet path
 *   with `htmlSnippet` swapped in.
 *
 * - TS mode (`.ts`):
 *   `replacesAppComponent` is `true`, `files['src/app/app.component.ts']` is
 *   the rewritten entry source, and any decorator siblings + transitive
 *   relative imports are packed under flat `src/app/<basename>` paths.
 *   `bareSpecifiers` carries third-party package roots seen in any walked
 *   file so the manifest builder can auto-forward them.
 */
export interface FileRefBundle {
    /** POSIX-formatted resolved path of the entry file. */
    entry: string;
    /** Flat `src/app/<basename>` → contents. */
    files: Record<string, string>;
    /** Bare-specifier roots discovered across all walked files. */
    bareSpecifiers: Set<string>;
    /** `true` for `.ts` mode, `false` for `.html` mode. */
    replacesAppComponent: boolean;
    /** Set only when the file ref resolved to an `.html` file. */
    htmlSnippet?: string;
}

export type FileRefResult = Result<FileRefBundle>;

const APP_COMPONENT_PATH = 'src/app/app.component.ts';
const APP_CONFIG_PATH = 'src/app/app.config.ts';
const APP_DIR = 'src/app';

// Decorator-url extractors. The quote class includes the backtick so a plain
// template literal (`templateUrl: \`./x.html\``) is supported like a string
// literal. Interpolated (`${…}`) or computed values are caught separately and
// reported, never silently dropped (see the `*_PRESENT` guards below).
const TEMPLATE_URL_RE = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/;
const STYLE_URL_RE = /styleUrl\s*:\s*['"`]([^'"`]+)['"`]/;

/**
 * Result of resolving a `@playgroundConfig` reference: the config file (placed
 * at `src/app/app.config.ts`) plus its transitive relative-import closure,
 * ready to merge into a playground's file map. `bareSpecifiers` feed the
 * manifest's dependency auto-forward.
 */
export interface PlaygroundConfigBundle {
    files: Record<string, string>;
    bareSpecifiers: Set<string>;
}

export type PlaygroundConfigResult = Result<PlaygroundConfigBundle>;
const STYLE_URLS_RE = /styleUrls\s*:\s*\[([^\]]+)\]/;
const STYLE_URLS_ITEM_RE = /['"`]([^'"`]+)['"`]/g;
// "Key is present" detectors - used to turn a key whose value our extractor
// can't parse (computed identifier, interpolated literal) into a clear error
// instead of a silently-missing sibling.
const TEMPLATE_URL_PRESENT = /\btemplateUrl\s*:/;
const STYLE_URL_PRESENT = /\bstyleUrl\s*:/;
const STYLE_URLS_PRESENT = /\bstyleUrls\s*:/;
// Matches both `from '...'` (named/namespace imports + re-exports) and
// side-effect `import '...'`. The `from` form covers `import { X } from '..'`,
// `import X from '..'`, `import * as N from '..'`, and `export ... from '..'`;
// the bare `import` form covers `import './polyfill';`. Only `./` and `../`
// (user sources, not bundles), and quote kinds may differ: it only reads paths.
const RELATIVE_IMPORT_FROM_RE = /(?:\bfrom\b|\bimport\b)\s+['"](\.\.?\/[^'"]+)['"]/g;

const toPosix = (p: string): string => p.replaceAll('\\', '/');

const flatPath = (resolved: string): string => `${APP_DIR}/${posix.basename(resolved)}`;

/**
 * Resolve a `@playground` file reference and (for `.ts` mode) walk its
 * decorator siblings + transitive relative imports into a flat bundle. Pure
 * apart from the injected `FsReader` - easy to unit-test against a static map.
 *
 * Result.err on:
 *  - unsupported extension (anything other than `.html` or `.ts`)
 *  - missing entry file
 *  - missing `templateUrl` / `styleUrl` / `styleUrls` sibling
 *  - relative-import target that the FS reader cannot find
 *  - file walk that exceeds `maxFiles` (defaults to STACKBLITZ_FILE_COUNT_CAP)
 */
export function readFileRef(
    fileRef: string,
    hostFile: string,
    fs: FsReader,
    options: { maxFiles?: number } = {}
): FileRefResult {
    const maxFiles = options.maxFiles ?? STACKBLITZ_FILE_COUNT_CAP;
    const hostDir = posix.dirname(toPosix(hostFile));
    const entryPath = posix.normalize(posix.join(hostDir, fileRef));

    const ext = posix.extname(entryPath);
    if (ext !== '.html' && ext !== '.ts') {
        return {
            ok: false,
            message: `Playground fileRef must end in .html or .ts: ${fileRef}`
        };
    }

    const entryContent = fs.readFile(entryPath);
    if (entryContent === null) {
        return { ok: false, message: `Cannot find playground file: ${fileRef}` };
    }

    if (ext === '.html') {
        return {
            ok: true,
            value: {
                entry: entryPath,
                files: {},
                bareSpecifiers: new Set(),
                replacesAppComponent: false,
                htmlSnippet: entryContent
            }
        };
    }

    return readTsFileRef(entryPath, entryContent, fs, maxFiles);
}

const readTsFileRef = (
    entryPath: string,
    entryContent: string,
    fs: FsReader,
    maxFiles: number
): FileRefResult => {
    const files: Record<string, string> = {};
    const bareSpecifiers = new Set<string>();
    const entryDir = posix.dirname(entryPath);

    // Decorator siblings - templateUrl / styleUrl / styleUrls. Each is parsed
    // from a string OR plain template literal; a key that is present but whose
    // value our extractor can't resolve (computed identifier or interpolated
    // literal) is reported, never silently skipped into a broken playground.
    const tplMatch = entryContent.match(TEMPLATE_URL_RE);
    if (tplMatch) {
        const sibling = readSibling(entryDir, tplMatch[1], 'templateUrl', fs);
        if (isErr(sibling)) {
            return sibling;
        }
        files[flatPath(sibling.value.path)] = sibling.value.content;
    } else if (TEMPLATE_URL_PRESENT.test(entryContent)) {
        return { ok: false, message: unparseableUrlError('templateUrl') };
    }

    const styleUrlMatch = entryContent.match(STYLE_URL_RE);
    if (styleUrlMatch) {
        const sibling = readSibling(entryDir, styleUrlMatch[1], 'styleUrl', fs);
        if (isErr(sibling)) {
            return sibling;
        }
        files[flatPath(sibling.value.path)] = sibling.value.content;
    } else if (STYLE_URL_PRESENT.test(entryContent)) {
        return { ok: false, message: unparseableUrlError('styleUrl') };
    }

    const styleUrlsMatch = entryContent.match(STYLE_URLS_RE);
    if (styleUrlsMatch) {
        STYLE_URLS_ITEM_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        let matchedAny = false;
        while ((m = STYLE_URLS_ITEM_RE.exec(styleUrlsMatch[1])) !== null) {
            matchedAny = true;
            const sibling = readSibling(entryDir, m[1], 'styleUrls', fs);
            if (isErr(sibling)) {
                return sibling;
            }
            files[flatPath(sibling.value.path)] = sibling.value.content;
        }
        // `styleUrls: [foo]` (non-literal items) - array found, nothing parsed.
        if (!matchedAny) {
            return { ok: false, message: unparseableUrlError('styleUrls') };
        }
    } else if (STYLE_URLS_PRESENT.test(entryContent)) {
        return { ok: false, message: unparseableUrlError('styleUrls') };
    }

    // Pack the entry as app.component.ts. Both transforms run - relative
    // imports flatten to './basename', decorator urls flatten to './basename'.
    // Then append an `AppComponent` alias so `src/main.ts`'s
    // `import { AppComponent } from './app/app.component'` resolves regardless
    // of the entry's actual class name (e.g. `FullComponentExample`).
    const rewritten = rewriteDecoratorUrls(rewriteRelativeImports(entryContent));
    files[APP_COMPONENT_PATH] = appendAppComponentAlias(rewritten);
    for (const spec of extractBareSpecifiers(entryContent)) {
        bareSpecifiers.add(spec);
    }

    // BFS walk of relative imports. Entry counts as collected file #1.
    const visited = new Set<string>([entryPath]);
    const queue: string[] = [];
    enqueueRelativeImports(entryContent, entryDir, visited, queue);

    let collectedCount = 1;
    while (queue.length > 0) {
        const next = queue.shift();
        if (next === undefined) {
            break;
        }
        const content = fs.readFile(next);
        if (content === null) {
            return { ok: false, message: `Cannot find imported file: ${next}` };
        }
        collectedCount++;
        if (collectedCount > maxFiles) {
            const walked = [...Object.keys(files), posix.basename(next)]
                .map(p => posix.basename(p))
                .join(', ');
            return {
                ok: false,
                message:
                    `Playground file walk from ${posix.basename(entryPath)} exceeded the ` +
                    `${maxFiles}-file cap (playgroundFileCountCap). Walked: ${walked}. ` +
                    `Trim the example's imports or raise playgroundFileCountCap.`
            };
        }
        files[flatPath(next)] = rewriteRelativeImports(content);
        for (const spec of extractBareSpecifiers(content)) {
            bareSpecifiers.add(spec);
        }
        enqueueRelativeImports(content, posix.dirname(next), visited, queue);
    }

    return {
        ok: true,
        value: {
            entry: entryPath,
            files,
            bareSpecifiers,
            replacesAppComponent: true
        }
    };
};

/**
 * Resolve a `@playgroundConfig <path>` reference. Reads the config `.ts`,
 * places it at `src/app/app.config.ts` (where `src/main.ts` imports
 * `appConfig` from), rewrites its relative imports, and BFS-walks the
 * transitive relative-import closure into flat `src/app/<basename>` paths -
 * the same packing the TS file-ref walk uses. The config file must export
 * `appConfig`.
 *
 * Result.err on: non-`.ts` extension, missing entry, an unresolved relative
 * import, or a walk that exceeds `maxFiles`.
 */
export function readPlaygroundConfig(
    configRef: string,
    hostFile: string,
    fs: FsReader,
    options: { maxFiles?: number } = {}
): PlaygroundConfigResult {
    const maxFiles = options.maxFiles ?? STACKBLITZ_FILE_COUNT_CAP;
    const hostDir = posix.dirname(toPosix(hostFile));
    const entryPath = posix.normalize(posix.join(hostDir, configRef));

    if (posix.extname(entryPath) !== '.ts') {
        return { ok: false, message: `Playground config must be a .ts file: ${configRef}` };
    }
    const entryContent = fs.readFile(entryPath);
    if (entryContent === null) {
        return { ok: false, message: `Cannot find playground config file: ${configRef}` };
    }

    const files: Record<string, string> = {};
    const bareSpecifiers = new Set<string>();
    const entryDir = posix.dirname(entryPath);

    files[APP_CONFIG_PATH] = rewriteRelativeImports(entryContent);
    for (const spec of extractBareSpecifiers(entryContent)) {
        bareSpecifiers.add(spec);
    }

    const visited = new Set<string>([entryPath]);
    const queue: string[] = [];
    enqueueRelativeImports(entryContent, entryDir, visited, queue);

    let collectedCount = 1;
    while (queue.length > 0) {
        const next = queue.shift();
        if (next === undefined) {
            break;
        }
        const content = fs.readFile(next);
        if (content === null) {
            return { ok: false, message: `Cannot find imported file: ${next}` };
        }
        collectedCount++;
        if (collectedCount > maxFiles) {
            return { ok: false, message: `Playground config walk exceeded ${maxFiles} files` };
        }
        files[flatPath(next)] = rewriteRelativeImports(content);
        for (const spec of extractBareSpecifiers(content)) {
            bareSpecifiers.add(spec);
        }
        enqueueRelativeImports(content, posix.dirname(next), visited, queue);
    }

    return { ok: true, value: { files, bareSpecifiers } };
}

type SiblingResult = Result<{ path: string; content: string }>;

/**
 * Clear message for a decorator url whose value is present but not a plain
 * string / template literal - a computed identifier or an interpolated
 * `${…}` path the file-ref walker can't statically resolve.
 */
const unparseableUrlError = (label: string): string =>
    `Playground entry uses a non-literal ${label} (computed value or interpolated ` +
    `template literal). Use a plain string or template-literal path so the file ` +
    `can be bundled, or inline the template/styles.`;

const readSibling = (
    entryDir: string,
    rawPath: string,
    label: string,
    fs: FsReader
): SiblingResult => {
    if (rawPath.includes('${')) {
        return { ok: false, message: unparseableUrlError(label) };
    }
    const resolved = posix.normalize(posix.join(entryDir, rawPath));
    const content = fs.readFile(resolved);
    if (content === null) {
        return {
            ok: false,
            message: `Cannot find ${label} sibling: ${rawPath} (resolved ${resolved})`
        };
    }
    return { ok: true, value: { path: resolved, content } };
};

/**
 * The scaffold's `src/main.ts` does `import { AppComponent } from './app/app.component'`,
 * so a TS-mode entry whose class is named anything other than `AppComponent`
 * (e.g. `FullComponentExample`, `LibraryButtonExample`) breaks the build with
 * `TS2305: Module ... has no exported member 'AppComponent'`. Append an alias
 * `export { OriginalName as AppComponent };` after the original source so the
 * import resolves regardless of the entry's class name. If the entry already
 * exports an `AppComponent` (or no top-level exported class can be found),
 * leave the source untouched.
 */
const TOP_EXPORTED_CLASS_RE = /^export\s+class\s+([A-Za-z_$][\w$]*)/m;

const appendAppComponentAlias = (source: string): string => {
    if (/\bexport\s+class\s+AppComponent\b/.test(source)) {
        return source;
    }
    if (/\bexport\s*\{\s*[^}]*\bas\s+AppComponent\b[^}]*\}/.test(source)) {
        return source;
    }
    const match = source.match(TOP_EXPORTED_CLASS_RE);
    if (!match) {
        return source;
    }
    const className = match[1];
    const trailingNewline = source.endsWith('\n') ? '' : '\n';
    return `${source}${trailingNewline}export { ${className} as AppComponent };\n`;
};

/**
 * Append `.ts` unless the path already ends in a known TS-resolvable
 * extension. `posix.extname` is unreliable here because filenames like
 * `button.component` would report `.component` as the extension.
 */
const resolveTsImport = (raw: string): string => {
    if (raw.endsWith('.ts') || raw.endsWith('.tsx') || raw.endsWith('.js')) {
        return raw;
    }
    return `${raw}.ts`;
};

const enqueueRelativeImports = (
    source: string,
    fromDir: string,
    visited: Set<string>,
    queue: string[]
): void => {
    RELATIVE_IMPORT_FROM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RELATIVE_IMPORT_FROM_RE.exec(source)) !== null) {
        const resolved = resolveTsImport(posix.normalize(posix.join(fromDir, m[1])));
        if (!visited.has(resolved)) {
            visited.add(resolved);
            queue.push(resolved);
        }
    }
};
