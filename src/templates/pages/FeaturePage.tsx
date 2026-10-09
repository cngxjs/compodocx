import Html from '@kitajs/html';
import type { SemanticModel } from '../../app/compiler/semantic/model';
import type { DiView } from '../../app/di/model';
import { hrefFor, hrefText } from '../../app/links/layout';
import { placedLink, symbolTarget } from '../../app/links/resolve';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';
import type {
    FeatureCard,
    FeatureMembers,
    FeaturePageData
} from '../../app/page-generator/feature-page-generator';
import { DiBadges } from '../components/DiBadges';
import { IconFolder } from '../components/Icons';
import { firstSentence, t } from '../helpers';
import { entryFacts } from '../helpers/symbol-facts';

/**
 * The page of a feature (`features/<entry point>/<key>.html`): import path,
 * README, sub-features of an entry point, the members by role (each row
 * linking to where the member is documented), and the features of other
 * entry points it builds on or that extend it.
 *
 * Override name: `feature`.
 */

interface MemberSection {
    readonly id: string;
    readonly titleKey: string;
    readonly lists: readonly (keyof FeatureMembers)[];
}

const SECTIONS: readonly MemberSection[] = [
    {
        id: 'components-and-directives',
        titleKey: 'components-and-directives',
        lists: ['components', 'directives']
    },
    { id: 'pipes', titleKey: 'pipes', lists: ['pipes'] },
    { id: 'services', titleKey: 'services', lists: ['services'] },
    { id: 'configuration', titleKey: 'configuration', lists: ['configuration'] },
    { id: 'utilities', titleKey: 'utilities', lists: ['utilities'] },
    { id: 'constants', titleKey: 'constants', lists: ['constants'] },
    { id: 'types', titleKey: 'types', lists: ['types'] },
    { id: 'classes', titleKey: 'classes', lists: ['classes'] }
];

interface Context {
    readonly table: SymbolTable;
    readonly di: DiView | undefined;
    readonly semantic: SemanticModel | undefined;
    readonly depth: number;
}

const featureHref = (segments: readonly string[], depth: number): string =>
    hrefText(hrefFor({ type: 'feature', segments }, depth));

const memberHref = (entry: SymbolEntry, ctx: Context): string | undefined => {
    const link = placedLink(ctx.table, entry, ctx.di, { duplicate: true });
    return link ? hrefText(hrefFor(link.target, ctx.depth, link.anchor)) : undefined;
};

const Heading = (id: string, title: string, count?: number): string =>
    (
        <h2 class="cdx-section-heading" id={id}>
            {title}
            {count === undefined ? '' : <span class="cdx-badge cdx-badge--count">{count}</span>}
            <a class="cdx-member-permalink" href={`#${id}`}>
                #
            </a>
        </h2>
    ) as string;

const MemberRow = (entry: SymbolEntry, ctx: Context): string => {
    const href = memberHref(entry, ctx);
    const name = <code>{entry.ref.name}</code>;
    const summary = firstSentence((entry.data as { description?: unknown }).description);
    return (
        <tr data-cdx-feature-member={entry.ref.kind}>
            <td>
                {href ? <a href={href}>{name}</a> : name}
                {DiBadges({ facts: entryFacts(ctx.semantic, entry) })}
            </td>
            <td>{summary ?? ''}</td>
        </tr>
    ) as string;
};

const Members = (section: MemberSection, members: FeatureMembers, ctx: Context): string => {
    const entries = section.lists.flatMap(list => members[list]);
    if (entries.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading(section.id, t(section.titleKey), entries.length)}
            <table class="cdx-table">
                <thead>
                    <tr>
                        <th scope="col">{t('name')}</th>
                        <th scope="col">{t('description')}</th>
                    </tr>
                </thead>
                <tbody>{entries.map(entry => MemberRow(entry, ctx))}</tbody>
            </table>
        </section>
    ) as string;
};

const SubFeatures = (cards: readonly FeatureCard[], depth: number): string => {
    if (cards.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading('features', t('features'), cards.length)}
            <table class="cdx-table">
                <thead>
                    <tr>
                        <th scope="col">{t('name')}</th>
                        <th scope="col">{t('members')}</th>
                        <th scope="col">{t('description')}</th>
                    </tr>
                </thead>
                <tbody>
                    {cards.map(
                        card =>
                            (
                                <tr data-cdx-feature-card={card.id}>
                                    <td>
                                        <a href={featureHref(card.segments, depth)}>{card.label}</a>
                                    </td>
                                    <td>{String(card.memberCount)}</td>
                                    <td>{(card.summary ?? '') as string}</td>
                                </tr>
                            ) as string
                    )}
                </tbody>
            </table>
        </section>
    ) as string;
};

/** Features of other entry points, with their import path. */
const Related = (
    id: string,
    title: string,
    cards: readonly FeatureCard[],
    depth: number
): string => {
    if (cards.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading(id, title, cards.length)}
            <table class="cdx-table">
                <thead>
                    <tr>
                        <th scope="col">{t('name')}</th>
                        <th scope="col">{t('import')}</th>
                    </tr>
                </thead>
                <tbody>
                    {cards.map(
                        card =>
                            (
                                <tr data-cdx-feature-related={card.id}>
                                    <td>
                                        <a href={featureHref(card.segments, depth)}>{card.label}</a>
                                    </td>
                                    <td>{card.entryPoint ? <code>{card.entryPoint}</code> : ''}</td>
                                </tr>
                            ) as string
                    )}
                </tbody>
            </table>
        </section>
    ) as string;
};

/** Components with a Theming tab, linked to it. */
const Theming = (members: FeatureMembers, ctx: Context): string => {
    const themed = members.components.filter(entry => {
        const data = entry.data as { themeTokens?: unknown[]; themeOverview?: unknown };
        return (data.themeTokens?.length ?? 0) > 0 || !!data.themeOverview;
    });
    if (themed.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading('theming', t('theming'), themed.length)}
            <ul>
                {themed.map(
                    entry =>
                        (
                            <li>
                                <a
                                    href={hrefText(
                                        hrefFor(
                                            symbolTarget(entry, { duplicate: true }),
                                            ctx.depth,
                                            'theming'
                                        )
                                    )}
                                >
                                    <code>{entry.ref.name}</code>
                                </a>
                            </li>
                        ) as string
                )}
            </ul>
        </section>
    ) as string;
};

export const FeaturePage = (data: any): string => {
    const feature: FeaturePageData = data.feature;
    const ctx: Context = {
        table: data.symbols,
        di: data.di,
        semantic: data.semantic,
        depth: data.depth ?? 1
    };
    return (
        <>
            <div
                class="cdx-entity-hero"
                style="--cdx-hero-color: var(--color-cdx-text-secondary)"
                data-cdx-feature={feature.id}
            >
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconFolder()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        {feature.parent ? (
                            <li>
                                <a href={featureHref(feature.parent.segments, ctx.depth)}>
                                    {feature.parent.label}
                                </a>
                            </li>
                        ) : (
                            <li>{t('features')}</li>
                        )}
                        <li aria-current="page">{feature.label}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span>{feature.label}</span>
                </h1>
                {feature.importPath ? (
                    <p class="cdx-entity-hero-selector">
                        <code>{`import { ... } from '${feature.importPath}';`}</code>
                    </p>
                ) : (
                    ''
                )}
                <div class="cdx-entity-hero-badges">
                    <span
                        class="cdx-badge cdx-badge--outline"
                        data-cdx-feature-detector={feature.detector}
                    >
                        {t(`feature-detector-${feature.detector}`)}
                    </span>
                </div>
            </div>
            {feature.readme ? (
                <section class="cdx-content-section">
                    {Heading('overview', t('overview'))}
                    <div class="cdx-readme">{feature.readme.html as string}</div>
                </section>
            ) : (
                ''
            )}
            {SubFeatures(feature.subFeatures, ctx.depth)}
            {SECTIONS.map(section => Members(section, feature.members, ctx))}
            {Theming(feature.members, ctx)}
            {Related('builds-on', t('builds-on'), feature.buildsOn, ctx.depth)}
            {Related('extended-by', t('extended-by'), feature.extendedBy, ctx.depth)}
        </>
    ) as string;
};
