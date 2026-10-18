import { posix } from 'node:path';
import { isErr, type Result } from '../../../lib';
import type { ComponentPlaygroundBlock } from '../../../templates/helpers/jsdoc';
import {
    STACKBLITZ_POST_LIMIT,
    STACKBLITZ_TEMPLATE,
    STACKBLITZ_VENDOR_TOTAL_CAP
} from './constants';
import { emitFileContent } from './format-files';
import { BARE_SPEC_RE, resolvePackageRoot } from './import-specifiers';
import {
    detectMaterialImports,
    extractScssUseSpecifiers,
    type MaterialImport,
    usesMaterialThemeBridge
} from './material-imports';
import type { FileRefBundle } from './read-file-ref';
import {
    extractRawBareSpecifiers,
    pruneVendorClosure,
    type VendorPackage,
    vendorClosure
} from './vendor';
import {
    type DepGraphNode,
    type DepGraphResolver,
    type WalkOptions,
    walkDepGraph
} from './walk-dep-graph';

/**
 * The shape that ships in the per-block `<script type="application/json">`
 * payload and is consumed by `@stackblitz/sdk`'s `openProject(...)`.
 *
 * Stable contract - clients cache and replay manifests across page loads, so
 * adding optional fields is safe but renaming or removing fields is breaking.
 *
 * The client splits this into two SDK args: project body (title / description
 * / template / files / dependencies / tags) and SDK options (`openFile`,
 * `startScript`). `startScript: 'start'` is what makes WebContainer actually
 * run `npm start` (= `ng serve`) after `npm install` - without it, you get
 * stuck on "Starting dev server".
 */
export interface PlaygroundManifest {
    title: string;
    description: string;
    template: typeof STACKBLITZ_TEMPLATE;
    /** POSIX-only file paths; values may be truncated by the file emitter. */
    files: { [posixPath: string]: string };
    /** Runtime npm packages - Angular peers, ecosystem, and Angular toolchain. */
    dependencies: { [pkg: string]: string };
    /** Surfaced as StackBlitz project tags - discoverability only. */
    tags: string[];
    /** Initial file the StackBlitz editor opens after boot. */
    openFile: string;
    /** npm script WebContainer runs after install (`'start'` → `ng serve`). */
    startScript: string;
}

/**
 * Minimal subset of the consumer's `package.json` the builder reads.
 * Versions of declared `@angular/*` peers (and Material/CDK) are forwarded;
 * everything else is ignored.
 */
export interface ConsumerPackageJson {
    dependencies?: { [pkg: string]: string };
    peerDependencies?: { [pkg: string]: string };
}

export interface BuildOptions extends WalkOptions {
    /** Source root inside the StackBlitz workspace. Defaults to `src/app/`. */
    sourceRoot?: string;
    /**
     * Explicit npm dependencies to inject into the manifest. Wins over both
     * the consumer-`package.json` auto-forward AND any auto-detected version
     * (e.g. Material). Use for libraries the consumer ships but isn't a
     * direct dependency of (peer-only CSS themes, dev-time-only deps, etc.)
     * or to pin a specific version per playground.
     */
    extraDependencies?: Record<string, string>;
    /**
     * Force the Material "app shell" (Roboto and Material-Icons font links in
     * `<head>` and the `mat-typography mat-app-background` body classes) into
     * the generated `index.html`, independent of Material auto-detect. Set
     * from the `playgroundMaterialShell` config flag. Does NOT add
     * `@angular/material` / `@angular/cdk` deps or Material module imports -
     * that wiring stays gated behind the real `<mat-*>` auto-detect.
     */
    materialShell?: boolean;
    /**
     * Per-file character cap applied at the emitter (`playgroundFileCap`).
     * Defaults to `STACKBLITZ_FILE_CAP`. Bundled sources longer than this are
     * truncated with a footer.
     */
    fileCap?: number;
    /**
     * Arbitrary `<head>` entries appended to the generated `index.html` (after
     * the Material shell links, when present). From the `playgroundHead` config
     * - for fonts, meta tags, CSP, preloads. Emitted verbatim; blank entries
     * are dropped.
     */
    head?: string[];
    /**
     * Global CSS appended verbatim to the generated `src/styles.css`, after the
     * default body reset. From the `playgroundGlobalStyles` config - for fonts,
     * resets, or any global rules the example depends on.
     */
    globalStyles?: string;
    /**
     * Vendoring input from the `playgroundVendor` config. When set, any
     * imported package that matches a vendored name (plus its transitive
     * vendor-dep closure) is embedded into the file map under `vendor/<pkg>/`
     * and wired as a `file:vendor/<pkg>` dependency - overriding the registry
     * version so the playground runs against the locally built `dist/` instead
     * of the last published release. Populated by `PlaygroundVendorResolver`.
     */
    vendor?: {
        /** Available vendor packages, keyed by full package name. */
        packages: Record<string, VendorPackage>;
        /** Override for the per-closure byte cap. Defaults to the constant. */
        totalCap?: number;
    };
}

export type BuildResult = Result<PlaygroundManifest>;

const DEFAULT_SOURCE_ROOT = 'src/app/';

// Fallback Angular major when the consumer's package.json declares no
// `@angular/*` peers. Bumped together with the rest of the toolchain.
const ANGULAR_FALLBACK_VERSION = '^21.0.0';

// Angular peers always present in the manifest. All entries align on a
// single version derived from the consumer's `@angular/core`. Independent
// `*` resolution would let StackBlitz pick mismatched majors per package
// and crash with "Class extends value undefined" inside Angular's runtime.
const ANGULAR_PEERS = [
    '@angular/core',
    '@angular/common',
    '@angular/compiler',
    '@angular/forms',
    '@angular/router',
    '@angular/animations',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic'
];

// Non-Angular runtime peers required for a default Angular CLI boot. Versions
// match the @angular/build 21.x ecosystem (mirrors what `ng new` ships).
const NON_ANGULAR_PEER_DEFAULTS: Record<string, string> = {
    'zone.js': '~0.15.0',
    rxjs: '~7.8.0',
    tslib: '^2.3.0'
};

// Angular CLI tooling that StackBlitz's WebContainer must install to run
// `ng serve`. These travel as devDependencies inside the emitted package.json
// - keeping them out of `dependencies` keeps the runtime tree honest.
const ANGULAR_DEV_PEERS = ['@angular/cli', '@angular/build', '@angular/compiler-cli'];

// TypeScript the Angular compiler accepts, by Angular major: 21 takes 5.9,
// 22 takes 6.0. Used only when the project declares no `typescript`.
const TYPESCRIPT_DEV_PEER_DEFAULT = '~5.9.2';
const TYPESCRIPT_DEV_PEER_ANGULAR_22 = '~6.0.2';

/** The TypeScript default for an Angular range: its lowest major decides. */
export const typescriptDefaultFor = (angularRange: string): string => {
    const major = Number(/(\d+)/.exec(angularRange)?.[1] ?? 0);
    return major >= 22 ? TYPESCRIPT_DEV_PEER_ANGULAR_22 : TYPESCRIPT_DEV_PEER_DEFAULT;
};

// Optional ecosystem peers - only forwarded when the consumer declares them.
const OPTIONAL_ANGULAR_PEERS = ['@angular/cdk', '@angular/material'];

const PROJECT_NAME = 'compodocx-playground';

// Specifiers handled separately by the explicit dep table above. Skipping
// these keeps auto-forward focused on the user's own libraries. Exported so
// the pre-publish import validator shares one source of "framework peers".
export const AUTO_FORWARD_SKIP = new Set<string>([
    ...ANGULAR_PEERS,
    ...OPTIONAL_ANGULAR_PEERS,
    ...Object.keys(NON_ANGULAR_PEER_DEFAULTS),
    ...ANGULAR_DEV_PEERS,
    'typescript'
]);

/**
 * Scan a source file for bare-specifier imports and return the deduped set
 * of resolved package roots, so consumer-defined libraries referenced in
 * inlined sources or HTML snippets can be auto-forwarded as runtime deps.
 * Pure - no I/O.
 */
export const extractBareSpecifiers = (source: string): Set<string> => {
    const found = new Set<string>();
    BARE_SPEC_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BARE_SPEC_RE.exec(source)) !== null) {
        const root = resolvePackageRoot(match[1]);
        if (root.length > 0) {
            found.add(root);
        }
    }
    return found;
};

const fileNameForNode = (node: DepGraphNode, sourceRoot: string): string => {
    const base = posix.basename(node.file).replaceAll('\\', '/');
    return posix.join(sourceRoot, base);
};

const collectAllDeps = (
    manifest?: ConsumerPackageJson
): {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
} => {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {};
    const provided = {
        ...(manifest?.dependencies ?? {}),
        ...(manifest?.peerDependencies ?? {})
    };
    const angularRef =
        provided['@angular/core'] ??
        provided['@angular/common'] ??
        provided['@angular/platform-browser'] ??
        ANGULAR_FALLBACK_VERSION;

    for (const peer of ANGULAR_PEERS) {
        dependencies[peer] = provided[peer] ?? angularRef;
    }
    for (const peer of OPTIONAL_ANGULAR_PEERS) {
        if (provided[peer]) {
            dependencies[peer] = provided[peer];
        }
    }
    for (const [peer, fallback] of Object.entries(NON_ANGULAR_PEER_DEFAULTS)) {
        dependencies[peer] = provided[peer] ?? fallback;
    }
    // Angular CLI tooling - needed for `ng serve` to run inside WebContainer.
    for (const peer of ANGULAR_DEV_PEERS) {
        devDependencies[peer] = provided[peer] ?? angularRef;
    }
    devDependencies.typescript = provided.typescript ?? typescriptDefaultFor(angularRef);
    return { dependencies, devDependencies };
};

const buildPackageJson = (deps: Record<string, string>, devDeps: Record<string, string>): string =>
    `${JSON.stringify(
        {
            name: PROJECT_NAME,
            version: '0.0.0',
            private: true,
            scripts: {
                ng: 'ng',
                start: 'ng serve',
                build: 'ng build',
                watch: 'ng build --watch --configuration development'
            },
            dependencies: deps,
            devDependencies: devDeps
        },
        null,
        2
    )}\n`;

const buildAngularJson = (hasMaterial: boolean, stylesFile = 'src/styles.css'): string => {
    const styles = hasMaterial
        ? [stylesFile, '@angular/material/prebuilt-themes/azure-blue.css']
        : [stylesFile];
    return `${JSON.stringify(
        {
            version: 1,
            cli: { analytics: false },
            newProjectRoot: 'projects',
            projects: {
                [PROJECT_NAME]: {
                    projectType: 'application',
                    root: '',
                    sourceRoot: 'src',
                    prefix: 'app',
                    architect: {
                        build: {
                            // `@angular/build:application` is the modern (Angular 17+)
                            // builder. The legacy `@angular-devkit/build-angular:application`
                            // also exists but pulls a heavier toolchain into WebContainer.
                            builder: '@angular/build:application',
                            options: {
                                outputPath: `dist/${PROJECT_NAME}`,
                                index: 'src/index.html',
                                browser: 'src/main.ts',
                                polyfills: ['zone.js'],
                                tsConfig: 'tsconfig.app.json',
                                inlineStyleLanguage: 'css',
                                assets: [],
                                styles,
                                scripts: []
                            },
                            configurations: {
                                production: {
                                    budgets: [
                                        {
                                            type: 'initial',
                                            maximumWarning: '500kb',
                                            maximumError: '1mb'
                                        },
                                        {
                                            type: 'anyComponentStyle',
                                            maximumWarning: '2kb',
                                            maximumError: '4kb'
                                        }
                                    ],
                                    outputHashing: 'all'
                                },
                                development: {
                                    optimization: false,
                                    extractLicenses: false,
                                    sourceMap: true,
                                    namedChunks: true
                                }
                            },
                            defaultConfiguration: 'production'
                        },
                        serve: {
                            builder: '@angular/build:dev-server',
                            configurations: {
                                production: {
                                    buildTarget: `${PROJECT_NAME}:build:production`
                                },
                                development: {
                                    buildTarget: `${PROJECT_NAME}:build:development`
                                }
                            },
                            defaultConfiguration: 'development'
                        }
                    }
                }
            }
        },
        null,
        2
    )}\n`;
};

const buildTsconfigJson = (): string =>
    `${JSON.stringify(
        {
            compileOnSave: false,
            compilerOptions: {
                outDir: './dist/out-tsc',
                strict: true,
                noImplicitOverride: true,
                noPropertyAccessFromIndexSignature: true,
                noImplicitReturns: true,
                noFallthroughCasesInSwitch: true,
                skipLibCheck: true,
                isolatedModules: true,
                experimentalDecorators: true,
                importHelpers: true,
                target: 'ES2022',
                module: 'ES2022',
                moduleResolution: 'bundler',
                useDefineForClassFields: false,
                lib: ['ES2022', 'dom'],
                esModuleInterop: true
            },
            angularCompilerOptions: {
                enableI18nLegacyMessageIdFormat: false,
                strictInjectionParameters: true,
                strictInputAccessModifiers: true,
                strictTemplates: true
            }
        },
        null,
        2
    )}\n`;

const buildTsconfigAppJson = (): string =>
    `${JSON.stringify(
        {
            extends: './tsconfig.json',
            compilerOptions: {
                outDir: './dist/out-tsc/app',
                types: []
            },
            files: ['src/main.ts'],
            include: ['src/**/*.d.ts']
        },
        null,
        2
    )}\n`;

// Material "app shell": Roboto and Material-Icons font `<link>`s for `<head>`,
// mirroring exactly what Angular Material's `ng add` schematic writes. The
// shell is intentionally DECOUPLED from Material module wiring - it can be
// emitted for a non-Material library that is merely themed to look like
// Material (see `usesMaterialThemeBridge` / the `materialShell` option).
const MATERIAL_SHELL_HEAD_LINKS = [
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">',
    '  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">'
];

// `mat-typography` and `mat-app-background` are the global hooks the prebuilt
// M3 themes (and Material theme bridges) target. Without them, Material-styled
// widgets render unstyled - even with the theme CSS loaded - because the theme
// rules are scoped under those class selectors.
const MATERIAL_SHELL_BODY_CLASS = 'mat-typography mat-app-background';

/**
 * Single `index.html` writer for every playground. `includeShell` adds the
 * Material font links + body classes; `extraHead` appends arbitrary author
 * `<head>` entries (`playgroundHead`) AFTER the shell links - fonts, meta,
 * CSP, preloads. Each entry is indented to match the surrounding markup but
 * otherwise emitted verbatim. Keeping this the ONE index.html path means the
 * shell and custom-head contributions never fork into competing writers.
 */
const buildIndexHtml = (includeShell: boolean, extraHead: string[] = []): string => {
    // Built once from a single boolean, so the shell can never be emitted
    // twice even when both the auto-detect and the heuristic/flag fire.
    const shellHead = includeShell ? MATERIAL_SHELL_HEAD_LINKS : [];
    const customHead = extraHead
        .filter(line => typeof line === 'string' && line.trim().length > 0)
        .map(line => (line.startsWith('  ') ? line : `  ${line.trim()}`));
    const bodyClass = includeShell ? ` class="${MATERIAL_SHELL_BODY_CLASS}"` : '';
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '  <meta charset="utf-8">',
        '  <title>compodocx playground</title>',
        '  <base href="/">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        ...shellHead,
        ...customHead,
        '</head>',
        `<body${bodyClass}>`,
        '  <app-root></app-root>',
        '</body>',
        '</html>',
        ''
    ].join('\n');
};

/**
 * True when the author's global styles carry a Sass-only statement prelude
 * (`@use` / `@forward`). Those resolve only when the stylesheet is compiled by
 * Sass, and the Angular application builder picks Sass purely by file
 * extension - so a global sheet carrying them must ship as `.scss`, not `.css`
 * (see the `stylesFile` selection in `buildPlaygroundManifest`). `@import` /
 * `@charset` / `@layer` are valid CSS and do NOT force `.scss`.
 */
const hasSassPrelude = (styles?: string): boolean =>
    typeof styles === 'string' && /@(?:use|forward)\b[^;{]*;/i.test(styles);

/**
 * Global-stylesheet writer for `playgroundGlobalStyles`. `extraStyles` is
 * emitted around the default body reset: any leading `@import` / `@charset` /
 * `@layer` / `@use` / `@forward` statement at-rules are hoisted ABOVE the reset
 * (CSS drops `@import`/`@charset` that follow a rule, and Sass errors on a
 * `@use`/`@forward` that follows one), and the remaining author CSS is emitted
 * AFTER the reset so it can still override it. The caller writes the result to
 * `src/styles.scss` when {@link hasSassPrelude} holds and `src/styles.css`
 * otherwise, so `playgroundGlobalStyles: "@import '...';"` (or `@use`) actually
 * loads.
 */
const buildStylesCss = (extraStyles = ''): string => {
    const reset = [
        'body {',
        '  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;',
        '  margin: 0;',
        '  padding: 1.5rem;',
        '  color: #1c1c1c;',
        '}'
    ];
    const trimmed = typeof extraStyles === 'string' ? extraStyles.trim() : '';
    if (trimmed.length === 0) {
        return `${reset.join('\n')}\n`;
    }

    // `@import` / `@charset` / `@layer name;` / `@use` / `@forward` are statement
    // at-rules that must come before any style rule. Match the statement form
    // only (terminated by `;` with no block), so a `@layer x { ... }` block stays
    // with the body CSS. `@use`/`@forward` are Sass preludes and are even
    // stricter - Sass errors if they follow any rule - so they are hoisted too.
    const preludeRe = /@(?:import|charset|layer|use|forward)\b[^;{]*;/gi;
    const prelude = trimmed.match(preludeRe) ?? [];
    const rest = trimmed.replace(preludeRe, '').trim();

    const out: string[] = [];
    if (prelude.length > 0) {
        out.push(prelude.join('\n'), '');
    }
    out.push(...reset);
    if (rest.length > 0) {
        out.push('', rest);
    }
    out.push('');
    return out.join('\n');
};

const buildMainTs = (): string =>
    [
        "import { bootstrapApplication } from '@angular/platform-browser';",
        "import { AppComponent } from './app/app.component';",
        "import { appConfig } from './app/app.config';",
        '',
        'bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));',
        ''
    ].join('\n');

const buildAppConfigTs = (): string =>
    [
        "import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';",
        '',
        'export const appConfig: ApplicationConfig = {',
        '    providers: [provideZoneChangeDetection({ eventCoalescing: true })]',
        '};',
        ''
    ].join('\n');

const escapeBacktick = (s: string): string => s.replaceAll('\\', '\\\\').replaceAll('`', '\\`');

/**
 * Re-indent a flat HTML snippet line-by-line. TypeScript's JSDoc parser
 * strips per-line leading whitespace, so the snippet arrives at the manifest
 * builder without nesting. Without this the emitted `template: \`…\``
 * literal looks like a wall of left-aligned tags.
 *
 * The indenter is intentionally simple - counts `<tag>` opens vs. `</tag>`
 * closes per line, ignoring self-closing tags. Multi-line attribute lists
 * inside a single tag are not supported (rare in playground snippets).
 */
const TAG_TOKEN_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;

const reindentHtmlSnippet = (snippet: string, unit = '  '): string => {
    const lines = snippet
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
    let depth = 0;
    const out: string[] = [];
    for (const line of lines) {
        const startsWithClose = /^<\/[a-zA-Z]/.test(line);
        const renderDepth = startsWithClose ? Math.max(0, depth - 1) : depth;
        out.push(unit.repeat(renderDepth) + line);

        let opens = 0;
        let closes = 0;
        TAG_TOKEN_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = TAG_TOKEN_RE.exec(line)) !== null) {
            const isClose = match[1] === '/';
            const isSelfClosed = /\/\s*$/.test(match[3]);
            if (isClose) {
                closes++;
            } else if (!isSelfClosed) {
                opens++;
            }
        }
        depth += opens - closes;
        if (depth < 0) {
            depth = 0;
        }
    }
    return out.join('\n');
};

const buildAppComponentTs = (
    componentName: string,
    componentImportPath: string,
    snippet: string,
    language: string,
    materialImports: MaterialImport[]
): string => {
    const isTypescript = language === 'typescript' || language === 'javascript';

    // Body indent: 8 spaces = inside the 4-space `@Component({` block and 4 more
    // for the template content. Closing backtick aligns with `template:`.
    const BODY_INDENT = '        ';
    const CLOSE_INDENT = '    ';

    let templateLiteral: string;
    if (isTypescript) {
        templateLiteral = `\`<pre><code>${escapeBacktick(snippet)}</code></pre>\``;
    } else {
        const reindented = reindentHtmlSnippet(escapeBacktick(snippet));
        const prefixed = reindented
            .split('\n')
            .map(l => (l.length === 0 ? l : BODY_INDENT + l))
            .join('\n');
        templateLiteral = `\`\n${prefixed}\n${CLOSE_INDENT}\``;
    }

    const materialImportLines = materialImports.map(
        m => `import { ${m.module} } from '${m.importPath}';`
    );
    const allImports = [componentName, ...materialImports.map(m => m.module)].join(', ');

    const lines = [
        "import { Component } from '@angular/core';",
        `import { ${componentName} } from '${componentImportPath}';`,
        ...materialImportLines,
        '',
        '@Component({',
        "    selector: 'app-root',",
        '    standalone: true,',
        `    imports: [${allImports}],`,
        `    template: ${templateLiteral}`,
        '})',
        'export class AppComponent {}',
        ''
    ];
    return lines.join('\n');
};

const APP_COMPONENT_PATH = 'src/app/app.component.ts';

/**
 * Pure builder. Result-typed (F14) - caller decides how to surface failure
 * (typically: render a static "project assembly failed" fallback and route
 * the message through `logger.warn`).
 *
 * Emits a complete Angular CLI 21 standalone project: package.json with
 * `npm start` → `ng serve`, angular.json wired to `@angular-devkit/build-angular:application`,
 * tsconfig pair, polyfills via the builder, and a single `AppComponent`
 * that hosts the user's snippet and imports the consumed component.
 *
 * Three input modes (mutually exclusive, dispatched by `block.fileRef` upstream):
 *  1. inline (no `fileBundle`): existing behaviour - `block.snippet` becomes the
 *     AppComponent template.
 *  2. HTML-mode `fileBundle` (`htmlSnippet` set): synthesizes an inline-block
 *     from the file body so the rest of the pipeline (Material auto-detect,
 *     AppComponent template) stays unchanged.
 *  3. TS-mode `fileBundle` (`replacesAppComponent: true`): the entry source
 *     IS the AppComponent - read-file-ref already rewrote relative imports
 *     and decorator urls, packed siblings and transitive imports into
 *     `fileBundle.files` under flat `src/app/<basename>` paths. Merge wins
 *     over the dep-graph walked copy on collision.
 */
export function buildPlaygroundManifest(
    componentName: string,
    block: ComponentPlaygroundBlock,
    resolve: DepGraphResolver,
    workspaceManifest?: ConsumerPackageJson,
    options: BuildOptions = {},
    fileBundle?: FileRefBundle
): BuildResult {
    const sourceRoot = (options.sourceRoot ?? DEFAULT_SOURCE_ROOT).replaceAll('\\', '/');

    // Per-file truncation cap, configurable via `playgroundFileCap`. Bound once
    // here so every file written below shares the same limit.
    const emit = (content: unknown): string => emitFileContent(content, options.fileCap);

    const walk = walkDepGraph(componentName, resolve, options);
    if (isErr(walk)) {
        return walk;
    }

    // HTML-mode fileBundle re-uses the inline-block code path. TS-mode
    // fileBundle sidesteps `buildAppComponentTs` entirely; the entry source
    // pre-rewritten by read-file-ref lives at `src/app/app.component.ts`
    // inside `fileBundle.files`.
    const replacesAppComponent = fileBundle?.replacesAppComponent === true;
    const effectiveBlock: ComponentPlaygroundBlock =
        fileBundle?.htmlSnippet !== undefined
            ? { ...block, snippet: fileBundle.htmlSnippet, language: 'html' }
            : block;

    // The class identifier and the file basename rarely match -
    // `ButtonComponent` lives at `button.component.ts`, so the AppComponent
    // must `import {...} from './button.component'`.
    const rootBasename = posix.basename(walk.value[0].file.replaceAll('\\', '/'), '.ts');
    const componentImportPath = `./${rootBasename}`;

    const { dependencies, devDependencies } = collectAllDeps(workspaceManifest);

    // Auto-detect Material modules. For TS-mode fileBundle scan the entry
    // (which is the actual AppComponent body); otherwise scan the snippet.
    const materialScanSource = replacesAppComponent
        ? (fileBundle?.files[APP_COMPONENT_PATH] ?? '')
        : (effectiveBlock.snippet ?? '');
    const materialImports = detectMaterialImports(materialScanSource);
    const hasMaterial = materialImports.length > 0;
    if (hasMaterial) {
        const angularRef = dependencies['@angular/core'] ?? ANGULAR_FALLBACK_VERSION;
        if (!dependencies['@angular/material']) {
            dependencies['@angular/material'] = angularRef;
        }
        if (!dependencies['@angular/cdk']) {
            dependencies['@angular/cdk'] = angularRef;
        }
    }

    // Material SHELL (font links and body classes) is decoupled from Material
    // MODULE wiring. Emit the shell when ANY of: the real `<mat-*>` auto-detect
    // fired; the `playgroundMaterialShell` config flag forced it; or a bundled
    // file `@use`s a Material theme bridge (a non-Material lib themed to look
    // like Material). Deps / module imports / the prebuilt theme stay gated on
    // `hasMaterial` alone - the heuristic/flag never pull `@angular/material`.
    const shellFromHeuristic =
        usesMaterialThemeBridge(effectiveBlock.snippet ?? '') ||
        walk.value.some(node => usesMaterialThemeBridge(node.sourceCode)) ||
        (fileBundle
            ? Object.values(fileBundle.files).some(content => usesMaterialThemeBridge(content))
            : false);
    const emitMaterialShell = hasMaterial || options.materialShell === true || shellFromHeuristic;

    // Auto-forward consumer-declared third-party packages referenced in the
    // inlined source, the snippet itself, and any fileBundle bare-specifier
    // discovered by read-file-ref's BFS walk. The consumer's `package.json`
    // dictates the version - packages it doesn't declare are skipped silently
    // (their build is already broken). `options.extraDependencies` overrides.
    const consumerDeps: Record<string, string> = {
        ...(workspaceManifest?.dependencies ?? {}),
        ...(workspaceManifest?.peerDependencies ?? {})
    };
    const importedSpecs = new Set<string>();
    for (const node of walk.value) {
        for (const spec of extractBareSpecifiers(node.sourceCode)) {
            importedSpecs.add(spec);
        }
    }
    if (effectiveBlock.snippet) {
        for (const spec of extractBareSpecifiers(effectiveBlock.snippet)) {
            importedSpecs.add(spec);
        }
    }
    if (fileBundle?.bareSpecifiers) {
        for (const spec of fileBundle.bareSpecifiers) {
            importedSpecs.add(spec);
        }
    }
    for (const spec of importedSpecs) {
        if (AUTO_FORWARD_SKIP.has(spec)) {
            continue;
        }
        if (consumerDeps[spec]) {
            dependencies[spec] = consumerDeps[spec];
        }
    }
    if (options.extraDependencies) {
        for (const [pkg, version] of Object.entries(options.extraDependencies)) {
            dependencies[pkg] = version;
        }
    }

    // Vendor the locally built library (`playgroundVendor`). Seed the closure
    // from the packages this playground actually imports, walk their
    // vendor-dep edges to the FULL closure, and embed each under `vendor/<pkg>/`
    // wired as a `file:` dependency. The `file:` entry is authoritative - it
    // overwrites any registry version auto-forward added AND overrides
    // transitive semver ranges inside the WebContainer's `npm install`, so no
    // closure package is pulled stale from the registry. Vendored files bypass
    // the per-file truncation cap (emitted raw below) - a sliced FESM bundle is
    // a broken FESM bundle; the closure is size-guarded as a whole instead.
    let vendorFiles: Record<string, string> | null = null;
    if (options.vendor && Object.keys(options.vendor.packages).length > 0) {
        const vendorPackages = options.vendor.packages;

        // Raw subpath specifiers (`@cngx/ui/tabs`, not just `@cngx/ui`) from the
        // SAME sources the Material-shell heuristic scans: walked TS, the
        // snippet, and the fileBundle. TS imports/exports AND SCSS `@use` both
        // count - an SCSS-only theme bridge must seed the closure or it ships
        // stale from the registry. These also drive the entry-point prune.
        const rawSpecs = new Set<string>();
        const scanSources = [
            effectiveBlock.snippet ?? '',
            ...walk.value.map(node => node.sourceCode),
            ...(fileBundle ? Object.values(fileBundle.files) : [])
        ];
        for (const src of scanSources) {
            for (const spec of extractRawBareSpecifiers(src)) {
                rawSpecs.add(spec);
            }
            for (const spec of extractScssUseSpecifiers(src)) {
                rawSpecs.add(spec);
            }
        }

        // Seed the closure from TS-import roots AND the raw subpath roots (which
        // include the SCSS `@use` packages), then walk vendor-dep edges.
        const seeds = new Set<string>(importedSpecs);
        for (const spec of rawSpecs) {
            seeds.add(resolvePackageRoot(spec));
        }
        const closure = vendorClosure(seeds, vendorPackages);

        if (closure.length > 0) {
            const pruned = pruneVendorClosure(closure, vendorPackages, rawSpecs);
            const cap = options.vendor.totalCap ?? STACKBLITZ_VENDOR_TOTAL_CAP;
            const perPkgBytes: Record<string, number> = {};
            const staged: Record<string, string> = {};
            let totalBytes = 0;
            for (const name of closure) {
                let bytes = 0;
                for (const [rel, content] of Object.entries(pruned[name] ?? {})) {
                    staged[`vendor/${name}/${rel}`] = content;
                    bytes += content.length;
                }
                perPkgBytes[name] = bytes;
                totalBytes += bytes;
            }
            if (totalBytes > cap) {
                const breakdown = closure
                    .map(name => `${name} (${perPkgBytes[name] ?? 0} B)`)
                    .sort()
                    .join(', ');
                const overPost =
                    totalBytes > STACKBLITZ_POST_LIMIT
                        ? ` This also exceeds StackBlitz's ~${STACKBLITZ_POST_LIMIT} B project-POST limit, so the playground would fail to launch with HTTP 413 — reduce the imported surface or split the example.`
                        : '';
                return {
                    ok: false,
                    message: `Playground vendor closure for "${componentName}" is ${totalBytes} B after slimming + pruning, over the ${cap} B cap: ${breakdown}.${overPost}`
                };
            }
            vendorFiles = staged;
            for (const name of closure) {
                dependencies[name] = `file:vendor/${name}`;
            }
        }
    }

    // A global sheet carrying a Sass prelude (`@use`/`@forward`) must ship as
    // `.scss` so the Angular builder runs Sass on it; `@import`-only styles
    // stay `.css` to avoid pulling the Sass toolchain in needlessly.
    const stylesFile = hasSassPrelude(options.globalStyles) ? 'src/styles.scss' : 'src/styles.css';

    const files: Record<string, string> = {};
    files['package.json'] = emit(buildPackageJson(dependencies, devDependencies));
    files['angular.json'] = emit(buildAngularJson(hasMaterial, stylesFile));
    files['tsconfig.json'] = emit(buildTsconfigJson());
    files['tsconfig.app.json'] = emit(buildTsconfigAppJson());
    files['src/index.html'] = emit(buildIndexHtml(emitMaterialShell, options.head));
    files[stylesFile] = emit(buildStylesCss(options.globalStyles));
    files['src/main.ts'] = emit(buildMainTs());
    files['src/app/app.config.ts'] = emit(buildAppConfigTs());

    if (replacesAppComponent && fileBundle) {
        // Entry source pre-rewritten by read-file-ref - relative imports and
        // decorator urls already flattened. Just emit-format and ship.
        files[APP_COMPONENT_PATH] = emit(fileBundle.files[APP_COMPONENT_PATH] ?? '');
    } else {
        files[APP_COMPONENT_PATH] = emit(
            buildAppComponentTs(
                componentName,
                componentImportPath,
                effectiveBlock.snippet ?? '',
                effectiveBlock.language ?? 'html',
                materialImports
            )
        );
    }

    // Dep-graph walked sources land at flat `src/app/<basename>` paths.
    // Skipped in ts-mode: the fileBundle entry IS the AppComponent, imports
    // the documented component via bare specifier (auto-forwarded as an npm
    // dependency), and never references the walked sources. Emitting them
    // would only litter the StackBlitz file tree with dead code.
    if (!replacesAppComponent) {
        for (const node of walk.value) {
            const path = fileNameForNode(node, sourceRoot);
            files[path] = emit(node.sourceCode);
        }
    }

    // fileBundle's siblings and transitive imports come last so they win on
    // collision (e.g. when the example imports the documented component, the
    // BFS-walked rewritten copy supersedes the dep-graph copy at the same key).
    // The AppComponent is already handled above; skip here to avoid double-emit.
    if (fileBundle) {
        for (const [path, content] of Object.entries(fileBundle.files)) {
            if (path === APP_COMPONENT_PATH) {
                continue;
            }
            files[path] = emit(content);
        }
    }

    // Vendored dist files ship verbatim - NOT through `emitFileContent`, whose
    // per-file truncation would corrupt a FESM bundle. CRLF is still normalised
    // for byte-stability across platforms.
    if (vendorFiles) {
        for (const [path, content] of Object.entries(vendorFiles)) {
            files[path] = content.replaceAll('\r\n', '\n');
        }
    }

    return {
        ok: true,
        value: {
            title: block.title,
            description: `Runnable playground for ${componentName}: ${block.title}`,
            template: STACKBLITZ_TEMPLATE,
            files,
            dependencies,
            tags: ['compodocx', 'angular', 'playground'],
            openFile: 'src/app/app.component.ts',
            startScript: 'start'
        }
    };
}
