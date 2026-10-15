/**
 * Snippet → Material module mapping. When a `@playground` snippet uses a
 * Material element selector (`<mat-card>`) or a Material directive
 * (`mat-button`, `matBadge`, …), the manifest builder injects the matching
 * standalone `*Module` import into `AppComponent.imports`, ships
 * `@angular/material` + `@angular/cdk` as runtime peers, and adds a prebuilt
 * theme to the project's styles list.
 *
 * Coverage is intentionally narrow - the most common Angular Material 21
 * surfaces. Adding a mapping is a one-line change.
 */

export interface MaterialImport {
    /** Standalone module symbol - the value that goes into `imports: [...]`. */
    module: string;
    /** Secondary entry to import the module from. */
    importPath: string;
}

const ELEMENT_SELECTORS: Record<string, MaterialImport> = {
    'mat-card': { module: 'MatCardModule', importPath: '@angular/material/card' },
    'mat-card-header': { module: 'MatCardModule', importPath: '@angular/material/card' },
    'mat-card-title': { module: 'MatCardModule', importPath: '@angular/material/card' },
    'mat-card-subtitle': { module: 'MatCardModule', importPath: '@angular/material/card' },
    'mat-card-content': { module: 'MatCardModule', importPath: '@angular/material/card' },
    'mat-card-actions': { module: 'MatCardModule', importPath: '@angular/material/card' },
    'mat-divider': { module: 'MatDividerModule', importPath: '@angular/material/divider' },
    'mat-icon': { module: 'MatIconModule', importPath: '@angular/material/icon' },
    'mat-form-field': { module: 'MatFormFieldModule', importPath: '@angular/material/form-field' },
    'mat-label': { module: 'MatFormFieldModule', importPath: '@angular/material/form-field' },
    'mat-hint': { module: 'MatFormFieldModule', importPath: '@angular/material/form-field' },
    'mat-error': { module: 'MatFormFieldModule', importPath: '@angular/material/form-field' },
    'mat-chip': { module: 'MatChipsModule', importPath: '@angular/material/chips' },
    'mat-chip-set': { module: 'MatChipsModule', importPath: '@angular/material/chips' },
    'mat-checkbox': { module: 'MatCheckboxModule', importPath: '@angular/material/checkbox' },
    'mat-slide-toggle': {
        module: 'MatSlideToggleModule',
        importPath: '@angular/material/slide-toggle'
    },
    'mat-progress-bar': {
        module: 'MatProgressBarModule',
        importPath: '@angular/material/progress-bar'
    },
    'mat-progress-spinner': {
        module: 'MatProgressSpinnerModule',
        importPath: '@angular/material/progress-spinner'
    },
    'mat-spinner': {
        module: 'MatProgressSpinnerModule',
        importPath: '@angular/material/progress-spinner'
    },
    'mat-toolbar': { module: 'MatToolbarModule', importPath: '@angular/material/toolbar' },
    'mat-list': { module: 'MatListModule', importPath: '@angular/material/list' },
    'mat-list-item': { module: 'MatListModule', importPath: '@angular/material/list' },
    'mat-nav-list': { module: 'MatListModule', importPath: '@angular/material/list' },
    'mat-tab-group': { module: 'MatTabsModule', importPath: '@angular/material/tabs' },
    'mat-tab': { module: 'MatTabsModule', importPath: '@angular/material/tabs' },
    'mat-expansion-panel': {
        module: 'MatExpansionModule',
        importPath: '@angular/material/expansion'
    },
    'mat-accordion': { module: 'MatExpansionModule', importPath: '@angular/material/expansion' },
    'mat-input': { module: 'MatInputModule', importPath: '@angular/material/input' },
    'mat-select': { module: 'MatSelectModule', importPath: '@angular/material/select' },
    'mat-option': { module: 'MatSelectModule', importPath: '@angular/material/select' },
    'mat-radio-group': { module: 'MatRadioModule', importPath: '@angular/material/radio' },
    'mat-radio-button': { module: 'MatRadioModule', importPath: '@angular/material/radio' }
};

const DIRECTIVE_TOKENS: Record<string, MaterialImport> = {
    'mat-button': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    'mat-raised-button': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    'mat-icon-button': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    'mat-flat-button': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    'mat-stroked-button': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    'mat-fab': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    'mat-mini-fab': { module: 'MatButtonModule', importPath: '@angular/material/button' },
    matBadge: { module: 'MatBadgeModule', importPath: '@angular/material/badge' },
    matTooltip: { module: 'MatTooltipModule', importPath: '@angular/material/tooltip' },
    matRipple: { module: 'MatRippleModule', importPath: '@angular/material/core' },
    matInput: { module: 'MatInputModule', importPath: '@angular/material/input' }
};

/**
 * Detect Material modules referenced by an HTML snippet. Returns one entry
 * per unique module (deduped by module name), ordered alphabetically so the
 * resulting manifest is byte-stable across runs.
 */
export function detectMaterialImports(snippet: string): MaterialImport[] {
    if (typeof snippet !== 'string' || snippet.length === 0) {
        return [];
    }
    const found = new Map<string, MaterialImport>();

    for (const [selector, imp] of Object.entries(ELEMENT_SELECTORS)) {
        const re = new RegExp(`<\\s*${selector}\\b`, 'i');
        if (re.test(snippet)) {
            found.set(imp.module, imp);
        }
    }

    for (const [token, imp] of Object.entries(DIRECTIVE_TOKENS)) {
        // Directive tokens may appear as bare attributes (`mat-button`),
        // attribute names (`matBadge="3"`), or selectors. Word-boundary match.
        const re = new RegExp(`(?:^|[\\s"'\`<\\[(])${token}(?=$|[\\s"'\`>=\\]\\)])`);
        if (re.test(snippet)) {
            found.set(imp.module, imp);
        }
    }

    return Array.from(found.values()).sort((a, b) => a.module.localeCompare(b.module));
}

// Sass `@use` of a Material theme bridge - e.g.
// `@use '@cngx/themes/material/azure-theme';`. A non-Material component
// library themed to LOOK like Material pulls in Roboto / Material-Icons fonts
// and the M3 body background via such a bridge, but renders no `<mat-*>`
// element, so the element/directive auto-detect never fires. Matching this
// opts the playground into the Material SHELL (font links and body classes)
// WITHOUT the Material MODULE wiring (deps + AppComponent imports).
const MATERIAL_THEME_BRIDGE_RE = /@use\s+['"][^'"]*material[^'"]*theme/i;

/**
 * True when `source` contains a Sass `@use` of a Material theme bridge.
 * Pure - no I/O. Scan any bundled file (component `.scss`, snippet, walked
 * source) and OR the results to decide whether to emit the Material shell.
 */
export function usesMaterialThemeBridge(source: string): boolean {
    return typeof source === 'string' && MATERIAL_THEME_BRIDGE_RE.test(source);
}

// Sass `@use` / `@forward` of a BARE specifier (package path, not a relative
// `./partial`). e.g. `@use '@cngx/themes/material/azure-theme' as t;` →
// `@cngx/themes/material/azure-theme`. The leading char class excludes `.`,
// `/`, `~` so only package-rooted specifiers match. Trailing `as`/`with`/`;`
// is left outside the capture.
const SCSS_USE_SPEC_RE = /@(?:use|forward)\s+['"]([^'".~/][^'"]*)['"]/g;

/**
 * Every bare-specifier `@use`/`@forward` target in a Sass source, verbatim
 * (subpath kept). Pure. An SCSS-only dependency - a theme bridge a component
 * pulls in via `@use '@cngx/themes/…'` - is invisible to the TS import scan, so
 * the vendor closure must seed from these too or it ships the dep stale from
 * the registry.
 */
export function extractScssUseSpecifiers(source: string): string[] {
    if (typeof source !== 'string' || source.length === 0) {
        return [];
    }
    const out: string[] = [];
    SCSS_USE_SPEC_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SCSS_USE_SPEC_RE.exec(source)) !== null) {
        out.push(m[1]);
    }
    return out;
}
