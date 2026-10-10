import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import type { DiView } from '../../app/di/model';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import type { EntityKind, EntityWithKind } from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText, isPageKind } from '../../app/links/layout';
import { placeTarget } from '../../app/links/resolve';
import type { TableKind } from '../../app/links/symbol-id';
import { isNonNull } from '../../lib';
import { IconSearch, IconX } from '../components/Icons';
import {
    deriveLibFromBucket,
    firstSentence,
    KIND_LABELS,
    KIND_LETTER,
    pagefindMetaBlock,
    relativeUrl,
    t
} from '../helpers';
import { featureGroups } from '../helpers/feature-info';

/**
 * Single-page API reference portal, emitted at `references.html` under
 * `menuLayout: 'feature'`: the exhaustive symbol surface laid out as one
 * section per feature (entry point, then feature), filtered client-side.
 * Mirrors the angular.dev/api experience.
 *
 * Each section lists every documented symbol of the feature regardless
 * of kind, keyed by the feature's page path (`forms/select`,
 * `forms/select/menu`). Items link to where the symbol is documented.
 */

interface BucketItem extends EntityWithKind {
    readonly wcagLevel?: 'A' | 'AA' | 'AAA';
}

const buildHref = (item: BucketItem, depth: number): string => {
    const name = (item.duplicateName as string | undefined) ?? item.name;
    const kind = item.kind;
    if (isPageKind(kind)) {
        const link = placeTarget({ type: 'symbol', kind, name }, item, Configuration.mainData);
        return link ? hrefText(hrefFor(link.target, depth, link.anchor)) : '';
    }
    return hrefText(hrefFor({ type: 'root', page: name }, depth));
};

const stabilityOf = (item: BucketItem): 'stable' | 'experimental' | 'deprecated' => {
    if (item.deprecated) {
        return 'deprecated';
    }
    if (item.beta) {
        return 'experimental';
    }
    return 'stable';
};

const KindLetterIcon = (kind: TableKind): string => {
    const letter = KIND_LETTER[kind] ?? '?';
    return (
        <span class={`cdx-ref-kind-icon cdx-ref-kind-icon--${kind}`} aria-hidden="true">
            {letter}
        </span>
    ) as string;
};

const RefItem = (item: BucketItem, depth: number, bucket: string): string => {
    const href = buildHref(item, depth);
    const stability = stabilityOf(item);
    const wcag = item.wcagLevel;
    const name = (item.duplicateName as string | undefined) ?? item.name;
    const excerpt = firstSentence(item.description) ?? '';
    return (
        <li
            class="cdx-ref-item"
            data-cdx-kind={item.kind}
            data-cdx-bucket={bucket}
            data-cdx-name={name.toLowerCase()}
            data-cdx-stability={stability}
            data-cdx-wcag={wcag ?? undefined}
        >
            <a class="cdx-ref-item-link" href={href} title={excerpt || name}>
                {KindLetterIcon(item.kind)}
                <span class="cdx-ref-item-name">{name}</span>
                <span class="cdx-ref-item-badges">
                    {stability === 'deprecated' ? (
                        <span class="cdx-badge cdx-badge--deprecated" title={t('deprecated')}>
                            DEPR
                        </span>
                    ) : (
                        ''
                    )}
                    {stability === 'experimental' ? (
                        <span class="cdx-badge cdx-badge--beta" title="Experimental">
                            EXP
                        </span>
                    ) : (
                        ''
                    )}
                    {wcag ? (
                        <span
                            class={`cdx-badge cdx-badge--wcag-${wcag.toLowerCase()}`}
                            title={`${t('wcag-level')} ${wcag}`}
                            data-cdx-wcag={wcag}
                        >
                            {wcag}
                        </span>
                    ) : (
                        ''
                    )}
                </span>
            </a>
        </li>
    ) as string;
};

const sortBucketItems = (items: readonly BucketItem[]): BucketItem[] => {
    return [...items].sort((a, b) => {
        const ak = (KIND_LABELS[a.kind] ?? a.kind).toLowerCase();
        const bk = (KIND_LABELS[b.kind] ?? b.kind).toLowerCase();
        if (ak !== bk) {
            return ak.localeCompare(bk);
        }
        return a.name.localeCompare(b.name);
    });
};

const bucketSlug = (bucket: string): string =>
    `cdx-ref-bucket-${bucket
        .replaceAll(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()}`;

const BucketSection = (bucket: string, items: readonly BucketItem[], depth: number): string => {
    const sorted = sortBucketItems(items);
    const lib = deriveLibFromBucket(bucket) ?? '';
    const slug = bucketSlug(bucket);
    return (
        <section
            class="cdx-content-section cdx-ref-bucket-section"
            data-cdx-ref-bucket={bucket}
            data-cdx-ref-lib={lib}
            data-cdx-ref-count={items.length}
        >
            <h3 class="cdx-section-heading" id={slug}>
                {bucket}{' '}
                <span class="cdx-ref-bucket-count" data-cdx-bucket-count>
                    {items.length}
                </span>
                <a class="cdx-member-permalink" href={`#${slug}`}>
                    #
                </a>
            </h3>
            <ul class="cdx-ref-item-list">{sorted.map(item => RefItem(item, depth, bucket))}</ul>
        </section>
    ) as string;
};

const KindChip = (kind: TableKind, count: number): string => {
    const letter = KIND_LETTER[kind] ?? '?';
    const label = KIND_LABELS[kind] ?? kind;
    return (
        <button
            type="button"
            class="cdx-ref-kind-chip"
            data-cdx-ref-kind-chip={kind}
            aria-pressed="true"
            title={label}
        >
            <span class={`cdx-ref-kind-icon cdx-ref-kind-icon--${kind}`} aria-hidden="true">
                {letter}
            </span>
            <span class="cdx-ref-kind-chip-label">{label}</span>
            <span class="cdx-ref-kind-chip-count" data-cdx-ref-kind-count={kind}>
                {count}
            </span>
        </button>
    ) as string;
};

const StabilityChip = (
    stability: 'stable' | 'experimental' | 'deprecated',
    count: number
): string => {
    const labels: Record<typeof stability, string> = {
        stable: 'Stable',
        experimental: 'Experimental',
        deprecated: 'Deprecated'
    };
    // Checkbox-style visual (✓ + word) but kept as a `<button
    // aria-pressed>` toggle — the simpler semantic the client filter
    // already wires up, and the only one Biome's a11y rules accept on
    // a `<button>`. Matches the angular.dev/api stability filter idiom.
    return (
        <button
            type="button"
            class={`cdx-ref-stability-chip cdx-ref-stability-chip--${stability}`}
            data-cdx-ref-stability-chip={stability}
            aria-pressed="true"
        >
            <span class="cdx-ref-stability-check" aria-hidden="true"></span>
            <span class="cdx-ref-stability-label">{labels[stability]}</span>
            <span class="cdx-ref-stability-count" data-cdx-ref-stability-count={stability}>
                {count}
            </span>
        </button>
    ) as string;
};

const BucketOption = (bucket: string): string =>
    (<option value={bucket}>{bucket}</option>) as string;

/**
 * Top-level page renderer. Receives the page-data envelope (mainData ∪
 * page); the sections come from the feature model (`data.semantic`).
 */
/** Whether the DI view has anything for `dependency-injection.html`. */
const hasDiLanding = (view: DiView | undefined): boolean =>
    (view?.clusters.length ?? 0) + (view?.plainProviders.length ?? 0) + (view?.tokens.length ?? 0) >
    0;

const hasUtilities = (misc: any): boolean =>
    ['functions', 'variables', 'typealiases', 'enumerations'].some(
        list => (misc?.[list]?.length ?? 0) > 0
    );

/** Links to the Utilities and Dependency Injection landing pages that exist. */
const LandingLinks = (data: any): string => {
    const depth: number = data.depth ?? 0;
    const pages = [
        hasUtilities(data.miscellaneous) ? { page: 'utilities', label: t('utilities') } : undefined,
        hasDiLanding(data.di)
            ? { page: 'dependency-injection', label: t('dependency-injection') }
            : undefined
    ].filter(isNonNull);
    return pages.length > 0
        ? ((
              <p class="cdx-ref-hero-subtitle">
                  {pages
                      .map(
                          ({ page, label }) =>
                              (
                                  <a href={hrefText(hrefFor({ type: 'root', page }, depth))}>
                                      {label}
                                  </a>
                              ) as string
                      )
                      .join(' · ')}
              </p>
          ) as string)
        : '';
};

export const ApiReferencePage = (data: any): string => {
    const custom = renderCustomTemplate('api-reference', data);
    if (custom !== null) {
        return custom;
    }

    const buckets = featureGroups(data.semantic, data.symbols, data.di, 'all') as Record<
        string,
        BucketItem[]
    >;
    const bucketKeys = Object.keys(buckets).sort();
    const depth = 0;
    const heading = t('api-reference');

    if (bucketKeys.length === 0) {
        return (
            <>
                <div class="cdx-entity-hero">
                    <h1 class="cdx-entity-hero-name">
                        <span>{heading}</span>
                    </h1>
                </div>
                <div class="cdx-ref-empty-page">{t('empty-overview-desc')}</div>
            </>
        ) as string;
    }

    // Per-kind and per-stability counts for the chip rail. Kinds with
    // zero items don't render a chip — empty dimensions stay invisible
    // (matches the search-palette facet UX).
    const kindCounts = new Map<TableKind, number>();
    const stabilityCounts: Record<'stable' | 'experimental' | 'deprecated', number> = {
        stable: 0,
        experimental: 0,
        deprecated: 0
    };
    let totalItems = 0;
    for (const k of bucketKeys) {
        for (const item of buckets[k]) {
            totalItems += 1;
            kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
            stabilityCounts[stabilityOf(item)] += 1;
        }
    }
    const presentKinds = [...kindCounts.keys()].sort((a, b) =>
        (KIND_LABELS[a] ?? a).localeCompare(KIND_LABELS[b] ?? b)
    );
    const hasExperimental = stabilityCounts.experimental > 0;
    const hasDeprecated = stabilityCounts.deprecated > 0;
    const showStabilityRow = hasExperimental || hasDeprecated;

    const searchMeta = pagefindMetaBlock({
        description: `${heading} — ${totalItems} symbols across ${bucketKeys.length} features`
    });

    return (
        <>
            <div class="cdx-ref-hero">
                {searchMeta}
                <h1 class="cdx-ref-hero-title">{heading}</h1>
                <p class="cdx-ref-hero-subtitle">
                    {totalItems} {t('members').toLowerCase()} · {bucketKeys.length}{' '}
                    {t('features').toLowerCase()}
                </p>
                {LandingLinks(data)}
            </div>

            <div class="cdx-ref-page" data-cdx-page="api-reference" data-cdx-ref-total={totalItems}>
                <section class="cdx-ref-filter-bar" aria-label={heading}>
                    <div class="cdx-ref-filter-row cdx-ref-filter-row--primary">
                        <label class="cdx-ref-search">
                            <span class="cdx-ref-search-icon" aria-hidden="true">
                                {IconSearch()}
                            </span>
                            <input
                                type="search"
                                class="cdx-ref-search-input"
                                data-cdx-ref-search
                                placeholder={t('filter-entities')}
                                aria-label={t('filter-entities')}
                                autocomplete="off"
                                spellcheck="false"
                            />
                            <button
                                type="button"
                                class="cdx-ref-search-clear"
                                data-cdx-ref-search-clear
                                aria-label={t('reset')}
                                hidden
                            >
                                {IconX()}
                            </button>
                        </label>
                        <select
                            class="cdx-ref-bucket-select"
                            data-cdx-ref-bucket-select
                            aria-label={t('features')}
                        >
                            <option value="">{t('all-features')}</option>
                            {bucketKeys.map(BucketOption)}
                        </select>
                        <button
                            type="button"
                            class="cdx-ref-reset"
                            data-cdx-ref-reset
                            aria-label={t('reset')}
                        >
                            {t('reset')}
                        </button>
                    </div>

                    {showStabilityRow ? (
                        <div class="cdx-ref-filter-row cdx-ref-filter-row--stability">
                            {StabilityChip('stable', stabilityCounts.stable)}
                            {hasExperimental
                                ? StabilityChip('experimental', stabilityCounts.experimental)
                                : ''}
                            {hasDeprecated
                                ? StabilityChip('deprecated', stabilityCounts.deprecated)
                                : ''}
                        </div>
                    ) : (
                        ''
                    )}

                    <div class="cdx-ref-filter-row cdx-ref-filter-row--kinds">
                        {presentKinds.map(k => KindChip(k, kindCounts.get(k) ?? 0))}
                    </div>
                </section>

                <div class="cdx-ref-empty-state" data-cdx-ref-empty hidden>
                    <p>{t('empty-search-title')}</p>
                    <button type="button" class="cdx-ref-reset-inline" data-cdx-ref-reset>
                        {t('reset')}
                    </button>
                </div>

                <div class="cdx-ref-bucket-list">
                    {bucketKeys.map(k => BucketSection(k, buckets[k], depth))}
                </div>
            </div>
        </>
    ) as string;
};
