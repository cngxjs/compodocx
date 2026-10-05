import Html from '@kitajs/html';
import { t } from '../helpers';
import { resolveType } from '../helpers/link-type';

/**
 * Human-friendly labels for Angular decorator property names. Extend as needed.
 * Keys are the raw decorator property (the key used in the `@Component({...})` literal)
 * and values are the Title Case label that reads well in a docs table.
 */
const HUMAN_LABELS: Record<string, string> = {
    selector: 'Selector',
    standalone: 'Standalone',
    imports: 'Imports',
    providers: 'Providers',
    viewProviders: 'View providers',
    changeDetection: 'Change detection',
    encapsulation: 'Encapsulation',
    animations: 'Animations',
    exportAs: 'Export as',
    host: 'Host',
    hostDirectives: 'Host directives',
    interpolation: 'Interpolation',
    moduleId: 'Module ID',
    preserveWhitespaces: 'Preserve whitespaces',
    queries: 'Queries',
    entryComponents: 'Entry components',
    templateUrl: 'Template URL',
    styleUrl: 'Style URL',
    styleUrls: 'Style URLs',
    extends: 'Extends',
    implements: 'Implements',
    declarations: 'Declarations',
    exports: 'Exports',
    bootstrap: 'Bootstrap',
    schemas: 'Schemas',
    pure: 'Pure',
    name: 'Name',
    providedIn: 'Provided in',
    deps: 'Dependencies',
    tokenType: 'Token type',
    functionalKind: 'Kind',
    tag: 'Tag',
    shadow: 'Shadow',
    scoped: 'Scoped',
    assetsDir: 'Assets directory',
    assetsDirs: 'Assets directories'
};

/** Return a human-readable Title Case label for a decorator property key. */
export function humanLabel(key: string): string {
    if (HUMAN_LABELS[key]) {
        return HUMAN_LABELS[key];
    }
    // Fallback: split camelCase and title-case the first word
    const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Build a resolved type payload used by `ChipList`. Tries the dep-engine first
 * so we can colour-code entity chips. Unresolved names fall back to a neutral
 * chip with no icon.
 */
function resolveChip(name: string): { href?: string; target?: string; type?: string } {
    const resolved = resolveType(name);
    if (!resolved) {
        return {};
    }
    // Angular framework entities always link to angular.dev
    if (resolved.href.startsWith('https://angular.dev')) {
        return { href: resolved.href, target: resolved.target, type: 'module' };
    }
    // Extract entity type from the href path: "../{typePath}s/Name.html"
    // where typePath is 'component', 'directive', ..., or 'classe' (for class → classes/)
    const m = resolved.href.match(/\.\.\/([a-z]+)\//);
    if (!m) {
        return { href: resolved.href, target: resolved.target };
    }
    const raw = m[1];
    // compodoc's URL conventions. 'miscellaneous' is the only folder that
    // doesn't follow the `{type}s/` plural rule.
    const URL_TYPE_MAP: Record<string, string> = {
        components: 'component',
        directives: 'directive',
        pipes: 'pipe',
        classes: 'class',
        interfaces: 'interface',
        guards: 'guard',
        interceptors: 'interceptor',
        injectables: 'injectable',
        entities: 'entity',
        miscellaneous: 'miscellaneous'
    };
    const type = URL_TYPE_MAP[raw] ?? raw;
    return { href: resolved.href, target: resolved.target, type };
}

/** Single metadata row: `<dt>label</dt><dd>value</dd>` inside a `cdx-metadata-row`. */
export function MetadataRow(label: string, value: string, isBlock = false): string {
    return (
        <div class={`cdx-metadata-row${isBlock ? ' cdx-metadata-row--block' : ''}`}>
            <dt class="cdx-metadata-label">{humanLabel(label)}</dt>
            <dd class="cdx-metadata-value">{value}</dd>
        </div>
    ) as string;
}

/** Metadata row with value wrapped in `<code>`. */
export function MetadataCodeRow(label: string, value: string): string {
    return MetadataRow(label, `<code>${value}</code>`);
}

/**
 * Metadata row whose value is a list of entities rendered as clickable chips.
 * Each chip is colour-coded by entity type (from `--color-cdx-entity-*`).
 */
/**
 * Return true if `name` looks like a literal useValue primitive rather
 * than an entity identifier — e.g. `'2.0.0-admin'`, `"abc"`, `42`, `true`.
 * Compodoc's provider extractor sometimes passes useValue literals as
 * provider names; they should be filtered out of entity chip lists.
 */
function isLiteralPrimitive(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) {
        return true;
    }
    // Quoted string literal
    if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
        return true;
    }
    // Numeric / boolean / null / undefined literal
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return true;
    }
    if (
        trimmed === 'true' ||
        trimmed === 'false' ||
        trimmed === 'null' ||
        trimmed === 'undefined'
    ) {
        return true;
    }
    return false;
}

type HostDirective = {
    readonly name: string;
    readonly inputs?: string[];
    readonly outputs?: string[];
};

const escapeHtml = (s: string): string =>
    s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);

/**
 * Renders a metadata row for Angular host directives as flat rows.
 * Each directive gets its own line with the name linked, followed by
 * `inputs` / `outputs` labels with chip tokens.
 */
export function MetadataHostDirectivesRow(hostDirectives: HostDirective[]): string {
    if (!hostDirectives?.length) {
        return '';
    }

    const chip = (name: string) => `<span class="cdx-host-dir-chip">${escapeHtml(name)}</span>`;

    const items = hostDirectives.map(hd => {
        const resolved = resolveType(hd.name);
        const nameHtml = resolved
            ? `<a class="cdx-host-dir-name" href="${resolved.href}" target="${resolved.target}">${hd.name}</a>`
            : `<span class="cdx-host-dir-name">${hd.name}</span>`;

        let html = `<div class="cdx-host-dir-entry-name">${nameHtml}</div>`;
        if (hd.inputs?.length) {
            html += `<div class="cdx-host-dir-entry-io"><span class="cdx-host-dir-label">inputs</span> ${hd.inputs.map(n => chip(n)).join(' ')}</div>`;
        }
        if (hd.outputs?.length) {
            html += `<div class="cdx-host-dir-entry-io"><span class="cdx-host-dir-label">outputs</span> ${hd.outputs.map(n => chip(n)).join(' ')}</div>`;
        }

        return `<div class="cdx-host-dir-entry">${html}</div>`;
    });

    return MetadataRow('hostDirectives', `<div class="cdx-host-dir-flat">${items.join('')}</div>`);
}

/**
 * Structured host literal entry. Matches the `HostEntry` type emitted by
 * `ComponentHelper.getComponentHostStructured`; kept local here to avoid a
 * cross-layer import from the compiler package.
 */
type HostEntry = {
    readonly key: string;
    readonly kind:
        | 'static'
        | 'attr-binding'
        | 'property-binding'
        | 'class-binding'
        | 'style-binding'
        | 'event'
        | 'raw';
    readonly value: string;
    readonly target?: string;
};

/**
 * Renders a metadata row for the `@Component({ host: { ... } })` literal as a
 * code-style object that mirrors the original source. Reuses the
 * `cdx-host-dir-*` token classes from the host directives renderer because the
 * visual grammar (punctuation, keys, linkable names) is identical.
 *
 * Keys are rendered verbatim (with their quotes or bracket / paren wrapping)
 * and values as plain tokens. The kind classification from the extractor is
 * reflected by giving event keys the directive entity color, so they stand
 * out against static attributes and property bindings.
 */
export function MetadataHostRow(entries: HostEntry[]): string {
    if (!entries?.length) {
        return '';
    }

    const punct = (s: string) => `<span class="cdx-host-dir-punct">${s}</span>`;
    const keyToken = (k: string) => `<span class="cdx-host-dir-key">${escapeHtml(k)}</span>`;
    const plainValue = (v: string) => `<span class="cdx-host-dir-token">${escapeHtml(v)}</span>`;

    // Match `[this.]identifier[(args)]` so binding / listener values like
    // `onEscape($event)` or `this.save($event)` get their leading identifier
    // wrapped as an anchor pointing at the member card on the current page.
    // Static attribute values are passed through untouched because their
    // content is data, not a code symbol.
    const METHOD_CALL_RE = /^(this\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)(\(.*\))?$/;

    const linkedValue = (v: string): string => {
        const match = METHOD_CALL_RE.exec(v);
        if (!match) {
            return plainValue(v);
        }
        const thisPrefix = match[1] ?? '';
        const identifier = match[2];
        const rest = match[3] ?? '';
        return (
            `${escapeHtml(thisPrefix)}` +
            `<a class="cdx-host-dir-name" href="#${identifier}">${escapeHtml(identifier)}</a>` +
            `${escapeHtml(rest)}`
        );
    };

    const renderValue = (entry: HostEntry): string =>
        entry.kind === 'static' || entry.kind === 'raw'
            ? plainValue(entry.value)
            : linkedValue(entry.value);

    const lines = entries.map(e => `  ${keyToken(e.key)}${punct(':')} ${renderValue(e)}`);
    const body = lines.join(`${punct(',')}\n`);
    const block = `<div class="cdx-host-dir-object">${punct('{')}\n${body}\n${punct('}')}</div>`;

    return MetadataRow('host', `<div class="cdx-host-dir-list">${block}</div>`);
}

/**
 * Structured provider entry. Matches the `ProviderEntry` type emitted by
 * `SymbolHelper.getProviderEntries`; kept local here to avoid a cross-layer
 * import from the compiler package.
 */
type ProviderEntry = {
    readonly name: string;
    readonly kind: 'class' | 'useClass' | 'useValue' | 'useFactory' | 'useExisting';
    readonly provide?: string;
    readonly useClass?: string;
    readonly useValue?: string;
    readonly valueKind?: 'literal' | 'identifier' | 'expression';
    readonly factory?: string;
    readonly deps?: string[];
    readonly useExisting?: string;
    readonly multi?: boolean;
};

/**
 * Render a metadata row for a providers / viewProviders array. Each entry
 * becomes a source-like code-object literal or (for bare class providers)
 * a single linkable chip on its own line. Reuses the `cdx-host-dir-*` token
 * classes from `MetadataHostDirectivesRow` and `MetadataHostRow` so the
 * visual grammar stays consistent across all three renderers.
 *
 * Linkable tokens — the provide target for kind: class, the useClass or
 * useExisting target, the factory function, and each entry in deps[] — are
 * resolved through `resolveType` and rendered as anchors when the dep
 * engine knows about them. Unresolved tokens fall back to plain spans.
 *
 * String-literal provide targets like `'AuditToken'` are rendered verbatim
 * (quotes included) as a muted token rather than a linkable name, so they
 * visually read as strings in the rendered block.
 */
/**
 * Renders provider entries as code-object literal blocks. Used both by
 * `MetadataProvidersRow` (inside metadata card) and `ProvidersListHtml`
 * (standalone section).
 */
export function renderProvidersListHtml(entries: ProviderEntry[]): string {
    if (!entries?.length) {
        return '';
    }

    const punct = (s: string) => `<span class="cdx-host-dir-punct">${s}</span>`;
    const key = (k: string) => `<span class="cdx-host-dir-key">${k}</span>`;
    const token = (t: string) => `<span class="cdx-host-dir-token">${escapeHtml(t)}</span>`;

    const isStringLiteralName = (name: string): boolean =>
        name.length >= 2 &&
        ((name.startsWith("'") && name.endsWith("'")) ||
            (name.startsWith('"') && name.endsWith('"')));

    const nameToken = (name: string): string => {
        if (isStringLiteralName(name)) {
            return token(name);
        }
        const resolved = resolveType(name);
        if (resolved) {
            return `<a class="cdx-host-dir-name" href="${resolved.href}" target="${resolved.target}">${name}</a>`;
        }
        return `<span class="cdx-host-dir-name">${escapeHtml(name)}</span>`;
    };

    const renderDeps = (deps: string[]): string =>
        `${punct('[')}${deps.map(d => nameToken(d)).join(punct(', '))}${punct(']')}`;

    const items = entries.map(entry => {
        if (entry.kind === 'class') {
            return `<div class="cdx-host-dir-object">${nameToken(entry.name)}</div>`;
        }

        const lines: string[] = [];
        lines.push(`  ${key('provide:')} ${nameToken(entry.name)}`);

        if (entry.kind === 'useClass' && entry.useClass) {
            lines.push(`  ${key('useClass:')} ${nameToken(entry.useClass)}`);
        } else if (entry.kind === 'useValue' && entry.useValue !== undefined) {
            const valueHtml =
                entry.valueKind === 'identifier'
                    ? nameToken(entry.useValue)
                    : token(entry.useValue);
            lines.push(`  ${key('useValue:')} ${valueHtml}`);
        } else if (entry.kind === 'useFactory') {
            if (entry.factory) {
                lines.push(`  ${key('useFactory:')} ${nameToken(entry.factory)}`);
            }
            if (entry.deps?.length) {
                lines.push(`  ${key('deps:')} ${renderDeps(entry.deps)}`);
            }
        } else if (entry.kind === 'useExisting' && entry.useExisting) {
            lines.push(`  ${key('useExisting:')} ${nameToken(entry.useExisting)}`);
        }

        if (entry.multi) {
            lines.push(`  ${key('multi:')} ${token('true')}`);
        }

        const body = lines.join(`${punct(',')}\n`);
        return `<div class="cdx-host-dir-object">${punct('{')}\n${body}\n${punct('}')}</div>`;
    });

    return `<div class="cdx-host-dir-list">${items.join('')}</div>`;
}

export function MetadataProvidersRow(label: string, entries: ProviderEntry[]): string {
    const html = renderProvidersListHtml(entries);
    if (!html) {
        return '';
    }
    return MetadataRow(label, html);
}

export function MetadataChipsRow(label: string, names: Array<string | { name: string }>): string {
    const items = names
        .map(n => (typeof n === 'string' ? n : n.name))
        .filter(Boolean)
        .filter(n => !isLiteralPrimitive(n));
    if (items.length === 0) {
        return '';
    }
    const chips = items.map(name => {
        const chip = resolveChip(name);
        const kindClass = chip.type ? ` cdx-chip--${chip.type}` : '';
        if (chip.href) {
            return `<a class="cdx-chip${kindClass}" href="${chip.href}" target="${chip.target}">${name}</a>`;
        }
        return `<span class="cdx-chip${kindClass}">${name}</span>`;
    });
    return MetadataRow(label, `<div class="cdx-chip-list">${chips.join('')}</div>`);
}

/** Full metadata section: `<section>` + `<h3>` + `<dl>` wrapping pre-rendered rows. */
export function MetadataSection(props: {
    readonly title?: string;
    readonly rows: string[];
}): string {
    const rows = props.rows.filter(r => !!r);
    if (rows.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section" data-compodoc="block-metadata">
            <h3 class="cdx-section-heading" id="metadata">
                {props.title ?? t('metadata')}
                <a class="cdx-member-permalink" href="#metadata">
                    #
                </a>
            </h3>
            <dl class="cdx-metadata-card">{rows.join('')}</dl>
        </section>
    ) as string;
}
