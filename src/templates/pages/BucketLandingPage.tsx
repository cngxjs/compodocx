import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { hrefFor, hrefText, isPageKind } from '../../app/links/layout';
import { placeTarget } from '../../app/links/resolve';
import { IconFolder, IconSearch } from '../components/Icons';
import { WcagBadge } from '../components/WcagBadge';
import {
    deriveLibFromBucket,
    firstSentence,
    KIND_LABELS,
    pagefindFilterBlock,
    pagefindMetaBlock,
    relativeUrl,
    t
} from '../helpers';

/**
 * Auto-generated landing page for one `@category` bucket under
 * `menuLayout: 'feature'`. Lists every public symbol that lives in the
 * bucket, grouped into:
 *   - "Organisms" — `PRIMARY_KINDS` (components, directives, pipes,
 *     injectables, classes, guards, interceptors, entities). Curated set
 *     surfaced under the Features sidebar chapter.
 *   - "Types" — reference kinds (interfaces, functions, type aliases,
 *     variables, enumerations). Exhaustive surface under the References
 *     sidebar chapter.
 *
 * URL: `categories/<bucket-id>.html` (bucket path may contain `/`, which
 * becomes a nested directory). The same URL is linked from both Features
 * and References sidebar bucket-labels.
 */

const ORGANISM_KINDS = [
    'component',
    'directive',
    'pipe',
    'injectable',
    'token',
    'class',
    'guard',
    'interceptor',
    'entity'
] as const;

const TYPE_KINDS = ['interface', 'function', 'typealias', 'variable', 'enumeration'] as const;

interface BucketItem {
    readonly name: string;
    readonly kind: string;
    readonly description?: string;
    readonly file?: string;
    readonly category?: string;
    readonly wcagLevel?: 'A' | 'AA' | 'AAA';
}

interface BucketLandingData {
    readonly bucket: string;
    readonly segments: readonly string[];
    readonly depth: number;
    readonly items: readonly BucketItem[];
    readonly aiGenerated?: string | true;
}

const buildHref = (item: BucketItem, depth: number): string => {
    const kind = item.kind;
    const name = item.name;
    if (isPageKind(kind)) {
        const link = placeTarget({ type: 'symbol', kind, name }, item, Configuration.mainData);
        return link ? hrefText(hrefFor(link.target, depth, link.anchor)) : '';
    }
    return hrefText(hrefFor({ type: 'root', page: name }, depth));
};

const KindCard = (item: BucketItem, depth: number): string => {
    const excerpt = firstSentence(item.description) ?? '';
    const kindLabel = KIND_LABELS[item.kind as keyof typeof KIND_LABELS] ?? item.kind;
    const nameLower = item.name.toLowerCase();
    const textLower = excerpt ? `${nameLower} ${excerpt.toLowerCase()}` : nameLower;
    return (
        <li
            class="cdx-bucket-card"
            data-cdx-kind={item.kind}
            data-cdx-card-name={nameLower}
            data-cdx-card-text={textLower}
            data-cdx-wcag={item.wcagLevel ?? ''}
        >
            <a class="cdx-bucket-card-link" href={buildHref(item, depth)}>
                <span
                    class={`cdx-badge cdx-badge--entity-${item.kind === 'enumeration' ? 'enum' : item.kind === 'injectable' ? 'injectable' : item.kind}`}
                >
                    {kindLabel}
                </span>
                <span class="cdx-bucket-card-name">{item.name}</span>
                {item.wcagLevel && (
                    <span class="cdx-bucket-card-wcag">
                        {WcagBadge({ wcagLevel: item.wcagLevel })}
                    </span>
                )}
                {excerpt && <span class="cdx-bucket-card-desc">{excerpt}</span>}
            </a>
        </li>
    ) as string;
};

const KindSection = (
    title: string,
    items: readonly BucketItem[],
    depth: number,
    sectionId: string
): string => {
    if (items.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section" id={sectionId}>
            <h2 class="cdx-section-heading">
                {title}
                <span class="cdx-badge cdx-badge--count">{items.length}</span>
                <a class="cdx-member-permalink" href={`#${sectionId}`}>
                    #
                </a>
            </h2>
            <ul class="cdx-bucket-card-list">{items.map(i => KindCard(i, depth))}</ul>
        </section>
    ) as string;
};

/** Threshold above which the inline filter strip renders. Below this,
 *  the page is short enough that filtering would be noise. */
const FILTER_THRESHOLD = 15;

const KindChip = (kind: string, count: number): string => {
    const kindLabel = KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? kind;
    // Saturated entity-kind badge — direct chip-to-card colour mapping
    // (the cards below carry the same `.cdx-badge--entity-<kind>` chip).
    // Bucket landings use this convention to make the chip a one-to-one
    // visual key for the card grid; the API Reference portal uses pastel
    // letter-boxes instead because it lists every kind side-by-side.
    const badgeKind = kind === 'enumeration' ? 'enum' : kind;
    return (
        <li>
            <button
                type="button"
                class="cdx-bucket-landing-kind-chip"
                data-cdx-bucket-landing-kind={kind}
                aria-pressed="false"
                title={kindLabel}
            >
                <span class={`cdx-badge cdx-badge--entity-${badgeKind}`}>{kindLabel}</span>
                <span class="cdx-bucket-landing-kind-chip-count">{count}</span>
            </button>
        </li>
    ) as string;
};

/** Ordered list of `(kind, count)` pairs present in this bucket, organised
 *  with organism kinds first then type kinds (mirrors the section order). */
const collectKindChips = (items: readonly BucketItem[]): Array<[string, number]> => {
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }
    const ordered: Array<[string, number]> = [];
    for (const k of [...ORGANISM_KINDS, ...TYPE_KINDS]) {
        const n = counts.get(k);
        if (n) {
            ordered.push([k, n]);
        }
    }
    return ordered;
};

const WCAG_LEVELS = ['A', 'AA', 'AAA'] as const;

/** Ordered list of `(wcagLevel, count)` pairs present in this bucket. Levels
 *  ordered A → AA → AAA (basic → recommended → enhanced). Returns `[]` when
 *  no item in the bucket carries a WCAG level — so the chip rail can suppress
 *  the WCAG section entirely (no "WCAG (0)" ghost). */
const collectWcagChips = (items: readonly BucketItem[]): Array<[string, number]> => {
    const counts = new Map<string, number>();
    for (const item of items) {
        if (item.wcagLevel) {
            counts.set(item.wcagLevel, (counts.get(item.wcagLevel) ?? 0) + 1);
        }
    }
    const ordered: Array<[string, number]> = [];
    for (const lvl of WCAG_LEVELS) {
        const n = counts.get(lvl);
        if (n) {
            ordered.push([lvl, n]);
        }
    }
    return ordered;
};

const WcagChip = (level: string, count: number): string => {
    const lowered = level.toLowerCase();
    return (
        <li>
            <button
                type="button"
                class="cdx-bucket-landing-wcag-chip"
                data-cdx-bucket-landing-wcag={level}
                aria-pressed="false"
                title={`${t('wcag-level')} ${level}`}
            >
                <span class={`cdx-badge cdx-badge--wcag cdx-badge--wcag-${lowered}`}>
                    {`WCAG ${level}`}
                </span>
                <span class="cdx-bucket-landing-kind-chip-count">{count}</span>
            </button>
        </li>
    ) as string;
};

const FilterBar = (bucket: string, items: readonly BucketItem[]): string => {
    const chips = collectKindChips(items);
    const wcagChips = collectWcagChips(items);
    const placeholder = `${t('filter-entities')} (${bucket})`;
    return (
        <section
            class="cdx-bucket-landing-filter"
            data-cdx-bucket-landing-filter
            aria-label={t('filter-entities')}
        >
            <div class="cdx-ref-filter-row cdx-ref-filter-row--primary">
                <label class="cdx-bucket-landing-filter-label" for="cdx-bucket-landing-q">
                    <span class="cdx-bucket-landing-filter-icon" aria-hidden="true">
                        {IconSearch()}
                    </span>
                    <span class="sr-only">{t('filter-entities')}</span>
                    <input
                        id="cdx-bucket-landing-q"
                        type="search"
                        autocomplete="off"
                        spellcheck="false"
                        class="cdx-bucket-landing-filter-input"
                        data-cdx-bucket-landing-input
                        placeholder={placeholder}
                    />
                </label>
                <button
                    type="button"
                    class="cdx-ref-reset"
                    data-cdx-bucket-landing-reset
                    aria-label={t('reset')}
                >
                    {t('reset')}
                </button>
            </div>
            {chips.length > 1 && (
                <ul
                    class="cdx-bucket-landing-kind-chips"
                    data-cdx-bucket-landing-kinds
                    role="toolbar"
                    aria-label={t('filter-entities')}
                >
                    {chips.map(([k, n]) => KindChip(k, n))}
                </ul>
            )}
            {wcagChips.length > 0 && (
                <ul
                    class="cdx-bucket-landing-wcag-chips"
                    data-cdx-bucket-landing-wcag-chips
                    role="toolbar"
                    aria-label={t('wcag-level')}
                >
                    {wcagChips.map(([lvl, n]) => WcagChip(lvl, n))}
                </ul>
            )}
            <p class="cdx-bucket-landing-filter-empty" data-cdx-bucket-landing-empty hidden>
                <span>{t('empty-search-title')}</span>
                <button
                    type="button"
                    class="cdx-bucket-landing-filter-reset"
                    data-cdx-bucket-landing-reset
                >
                    {t('reset')}
                </button>
            </p>
        </section>
    ) as string;
};

/**
 * Top-level page renderer. `data` follows the standard page-data shape
 * (mainData ∪ page); the page-specific payload arrives as
 * `data.bucketLanding`.
 */
export const BucketLandingPage = (data: any): string => {
    const custom = renderCustomTemplate('bucket-landing', data);
    if (custom !== null) {
        return custom;
    }
    const payload = data.bucketLanding as BucketLandingData;
    if (!payload) {
        return '';
    }
    const { bucket, segments, depth, items } = payload;
    const organisms = items.filter(i => (ORGANISM_KINDS as readonly string[]).includes(i.kind));
    const types = items.filter(i => (TYPE_KINDS as readonly string[]).includes(i.kind));

    const searchMeta = pagefindMetaBlock({
        category: bucket,
        description: items
            .map(i => firstSentence(i.description))
            .filter(Boolean)
            .slice(0, 3)
            .join(' · ')
    });
    const searchFilters = pagefindFilterBlock({
        kind: 'Bucket',
        lib: deriveLibFromBucket(bucket),
        bucket,
        docsKind: 'primary'
    });

    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-text-secondary)">
                {searchMeta}
                {searchFilters}
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconFolder()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        <li>{t('categories')}</li>
                        {segments.slice(0, -1).map(seg => (
                            <li>{seg}</li>
                        ))}
                        <li aria-current="page">{segments.at(-1)}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span>{bucket}</span>
                </h1>
                <div class="cdx-entity-hero-badges">
                    <span class="cdx-badge cdx-badge--trait">{t('category')}</span>
                </div>
            </div>

            {items.length >= FILTER_THRESHOLD && FilterBar(bucket, items)}

            <div class="cdx-bucket-landing-content">
                {KindSection(t('features'), organisms, depth, 'organisms')}
                {KindSection(t('references'), types, depth, 'types')}
            </div>
        </>
    ) as string;
};
