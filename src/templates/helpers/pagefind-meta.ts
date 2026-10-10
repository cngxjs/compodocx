import type { TableKind } from '../../app/links/symbol-id';

/**
 * User-facing labels for entity kinds. Surfaced on Pagefind search-result
 * chips so a search hit reads "ToastConfig — Interface — ui/feedback/toast"
 * instead of the legacy "Docs" placeholder. Kept in lockstep with the
 * sidebar's per-kind chip colours via `cdx-badge--entity-<kind>` tokens.
 */
export const KIND_LABELS: Record<TableKind, string> = {
    component: 'Component',
    directive: 'Directive',
    pipe: 'Pipe',
    injectable: 'Injectable',
    token: 'Token',
    class: 'Class',
    interface: 'Interface',
    guard: 'Guard',
    interceptor: 'Interceptor',
    resolver: 'Resolver',
    entity: 'Entity',
    function: 'Function',
    variable: 'Variable',
    typealias: 'Type Alias',
    enumeration: 'Enumeration'
};

/**
 * Compact 1–2 character identifier used inside the pastel
 * `.cdx-ref-kind-icon` letter-box that appears in API Reference rows and
 * API Reference filter chips. The
 * letter is decorative — the full label travels alongside as visible
 * text and is also exposed via the chip's `title` attribute for
 * screen-reader users.
 */
export const KIND_LETTER: Record<TableKind, string> = {
    component: 'C',
    directive: 'D',
    pipe: 'P',
    injectable: 'I',
    token: 'Tk',
    class: 'Cl',
    interface: 'If',
    guard: 'G',
    interceptor: 'X',
    resolver: 'R',
    entity: 'E',
    function: 'F',
    variable: 'V',
    typealias: 'Tp',
    enumeration: 'En'
};

/**
 * Strip HTML tags from a rendered description and return the first
 * sentence, truncated to ~120 chars for use as a Pagefind search excerpt.
 * Source is the entity's already-rendered `description` HTML (markdown →
 * marked → HTML); we re-strip rather than re-render to avoid markdown
 * residue like backticks or asterisks bleeding into the search index.
 *
 * Returns `undefined` when the input is empty or strips to whitespace —
 * callers omit the meta block entirely in that case so the Pagefind index
 * stays small.
 */
export function firstSentence(html: unknown): string | undefined {
    if (typeof html !== 'string' || html.length === 0) {
        return undefined;
    }
    // Drop tags first, then collapse whitespace runs (markdown line breaks
    // leave `<br/>` followed by whitespace; both vanish here).
    const stripped = html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!stripped) {
        return undefined;
    }
    // First sentence — split on `.`, `!`, `?` followed by whitespace OR
    // anchored at end-of-string. Fallback: the entire stripped string when
    // no sentence terminator exists (single-clause descriptions are common).
    // Trim trailing sentence terminators so the excerpt reads naturally.
    const split = stripped.split(/[.!?](?:\s|$)/)[0] ?? stripped;
    const sentence = split.replace(/[.!?]+$/, '').trim();
    const value = sentence || stripped;
    if (value.length <= 120) {
        return value;
    }
    return `${value.slice(0, 117)}...`;
}

/**
 * Inputs for the Pagefind meta block.
 *
 * Pagefind reads metadata from elements carrying a `data-pagefind-meta`
 * attribute — either in `key:value` literal form or in inner-text form
 * (`data-pagefind-meta="key"` with text content as the value). The
 * `data-pagefind-meta-X="..."` per-key attribute form looks plausible but
 * is NOT discovered by Pagefind's static scan, so an earlier iteration of
 * this helper silently produced no meta keys at all. See
 * <https://pagefind.app/docs/metadata/> for the supported syntax.
 */
export interface PagefindMetaInput {
    readonly kind?: TableKind | 'cluster';
    /** Label of the symbol's feature; the search palette shows it. */
    readonly feature?: string;
    readonly description?: string;
}

/**
 * Render a Pagefind-discoverable meta block as a string fragment of hidden
 * spans. Each span carries one `data-pagefind-meta` attribute:
 *
 *   - `kind` and `feature` use the literal `key:value` form (short, safe
 *     values, no commas or colons in real-world content).
 *   - `description` uses the inner-text form so values containing commas,
 *     colons, or quotes survive without escaping the `data-pagefind-meta`
 *     attribute parser.
 *
 * Empty / whitespace-only fields are omitted entirely — Pagefind index
 * stays small. The block is rendered inside the entity hero and hidden
 * with the `hidden` attribute (Pagefind's static HTML scan still picks it
 * up; the browser does not render it).
 */
/** Meta kind label of a feature type page (providers and features on one page). */
export const CLUSTER_KIND_LABEL = 'Cluster';

const metaKindLabel = (kind: PagefindMetaInput['kind']): string | undefined =>
    kind === 'cluster' ? CLUSTER_KIND_LABEL : kind && KIND_LABELS[kind];

export function pagefindMetaBlock(input: PagefindMetaInput): string {
    const parts: string[] = [];
    const kindLabel = metaKindLabel(input.kind);
    if (kindLabel) {
        const label = escapeAttr(kindLabel);
        parts.push(`<span hidden data-pagefind-meta="kind:${label}"></span>`);
    }
    if (input.feature?.trim()) {
        parts.push(
            `<span hidden data-pagefind-meta="feature:${escapeAttr(input.feature.trim())}"></span>`
        );
    }
    const excerpt = firstSentence(input.description);
    if (excerpt) {
        const text = escapeText(excerpt);
        parts.push(`<span hidden data-pagefind-meta="description">${text}</span>`);
    }
    return parts.join('');
}

function escapeAttr(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeText(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Inputs for the Pagefind filter block. Filter attributes are distinct
 * from meta attributes: meta shows up in result rendering, filters power
 * the facet UI.
 *
 * Pagefind 1.x only recognises the canonical
 * `data-pagefind-filter="dim:value"` attribute form during its static
 * HTML scan. The plausible-looking per-suffix variant
 * `data-pagefind-filter-<dim>="value"` is silently ignored — verified
 * against `pagefind@1.5.2` (the version bundled with compodocx). One span
 * is emitted per dimension so each carries exactly one `dim:value` pair.
 */
export interface PagefindFilterInput {
    readonly kind?: TableKind | 'Module' | 'Provider';
    readonly lib?: string;
    /** Label of the symbol's feature. */
    readonly feature?: string;
    /** Import path of the symbol's entry point. */
    readonly entryPoint?: string;
    readonly wcag?: 'A' | 'AA' | 'AAA';
}

/** Map an TableKind to its facet-UI label. Non-entity rows (Module,
 *  Provider) are passed through verbatim. */
function kindFilterLabel(kind: TableKind | 'Module' | 'Provider' | undefined): string | undefined {
    if (!kind) {
        return undefined;
    }
    if (kind === 'Module' || kind === 'Provider') {
        return kind;
    }
    return KIND_LABELS[kind];
}

/**
 * Render Pagefind filter spans for an entity hero. Empty fields are
 * omitted so the index does not carry phantom facet values. The block is
 * hidden visually (`hidden` attribute) but stays in the static HTML so
 * Pagefind's build-time scan picks it up.
 *
 * Each dimension gets its own span carrying a single canonical
 * `data-pagefind-filter="dim:value"` attribute — that is the only form
 * Pagefind's static scan registers; multi-attribute siblings like
 * `data-pagefind-filter-lib="…"` are silently dropped on the indexer
 * floor.
 */
export function pagefindFilterBlock(input: PagefindFilterInput): string {
    const spans: string[] = [];
    const kindLabel = kindFilterLabel(input.kind);
    if (kindLabel) {
        spans.push(filterSpan('kind', kindLabel));
    }
    if (input.lib?.trim()) {
        spans.push(filterSpan('lib', input.lib.trim()));
    }
    if (input.feature?.trim()) {
        spans.push(filterSpan('feature', input.feature.trim()));
    }
    if (input.entryPoint?.trim()) {
        spans.push(filterSpan('entryPoint', input.entryPoint.trim()));
    }
    if (input.wcag) {
        spans.push(filterSpan('wcag', input.wcag));
    }
    return spans.join('');
}

function filterSpan(dim: string, value: string): string {
    return `<span hidden data-pagefind-filter="${escapeAttr(dim)}:${escapeAttr(value)}"></span>`;
}

/**
 * Derive the "library" facet value from a bucket id (e.g.
 * `ui/feedback/toast` → `ui`). When the bucket id is empty, fall back to
 * the leading segment of the source-file path so single-app workspaces
 * still surface their top-level folders as facet values.
 */
export function deriveLibFromBucket(bucketOrFile: string | undefined): string | undefined {
    if (!bucketOrFile) {
        return undefined;
    }
    const normalised = bucketOrFile.replaceAll('\\', '/').trim();
    if (!normalised) {
        return undefined;
    }
    const first = normalised.split('/').filter(Boolean)[0];
    return first || undefined;
}
