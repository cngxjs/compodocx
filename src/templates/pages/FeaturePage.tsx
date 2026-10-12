import Html from '@kitajs/html';
import type { SemanticModel } from '../../app/compiler/semantic/model';
import type { DiView } from '../../app/di/model';
import type { MainDataInterface } from '../../app/interfaces/main-data.interface';
import { hrefFor, hrefText, routeAnchor } from '../../app/links/layout';
import { placedLink, symbolTarget } from '../../app/links/resolve';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';
import type {
    FeatureCard,
    FeatureMembers,
    FeaturePageData
} from '../../app/page-generator/feature-page-generator';
import type { RouteNode, RouteTarget, RoutingModel } from '../../app/routing/model';
import { unlinkedTokenFiles } from '../../app/styles/design-tokens';
import { isDocumentedToken, type StyleFile } from '../../app/styles/model';
import { markedAcl } from '../../utils/marked.acl';
import { DiBadges } from '../components/DiBadges';
import { IconFolder } from '../components/Icons';
import { firstSentence, t } from '../helpers';
import { entryFacts } from '../helpers/symbol-facts';
import { hasTheming, themingFor } from '../helpers/theming';

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
    /** The route model; undefined when routes are disabled. */
    readonly routing: RoutingModel | undefined;
    readonly depth: number;
    readonly mainData: Pick<MainDataInterface, 'styles' | 'symbols'>;
}

const featureHref = (segments: readonly string[], depth: number): string =>
    hrefText(hrefFor({ type: 'feature', segments }, depth));

const memberHref = (entry: SymbolEntry, ctx: Context): string | undefined => {
    const link = placedLink(ctx.table, entry, ctx.di);
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
                                        <a href={featureHref(card.segments, depth)}>
                                            <code>{card.label}</code>
                                        </a>
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
                                        <a href={featureHref(card.segments, depth)}>
                                            <code>{card.label}</code>
                                        </a>
                                    </td>
                                    <td>{card.entryPoint ?? ''}</td>
                                </tr>
                            ) as string
                    )}
                </tbody>
            </table>
        </section>
    ) as string;
};

/** A style page row: link, first sentence of its overview, token and mixin counts. */
const StyleRow = (entry: SymbolEntry, ctx: Context): string => {
    const file = entry.data as StyleFile;
    const summary = firstSentence(file.overview ? (markedAcl(file.overview) as string) : '');
    const tokens = file.tokens.filter(isDocumentedToken).length;
    const counts = [
        tokens > 0 ? `${tokens} ${t('tokens')}` : '',
        file.mixins.length > 0 ? `${file.mixins.length} ${t('mixins')}` : ''
    ].filter(Boolean);
    return (
        <li data-cdx-feature-member="style">
            <a href={hrefText(hrefFor(symbolTarget(entry), ctx.depth))}>
                <code>{fileName(file.file)}</code>
            </a>
            {summary ? <span class="cdx-feature-style-summary"> {summary}</span> : ''}
            {counts.length > 0 ? (
                <span class="cdx-feature-style-counts"> ({counts.join(', ')})</span>
            ) : (
                ''
            )}
        </li>
    ) as string;
};

/** The routes whose component, or whose lazily loaded route array, is a member of the feature. */
const routesOf = (members: FeatureMembers, model: RoutingModel): RouteNode[] => {
    const ids = new Set(Object.values(members).flatMap(list => list.map(entry => entry.id)));
    const isMember = (target: RouteTarget | undefined) =>
        target?.symbol !== undefined && ids.has(target.symbol);
    const found: RouteNode[] = [];
    const walk = (nodes: readonly RouteNode[]): void => {
        for (const node of nodes) {
            if (isMember(node.component) || isMember(node.childrenFrom)) {
                found.push(node);
            }
            walk(node.children);
        }
    };
    for (const root of model.roots) {
        walk(root.routes);
    }
    return found;
};

const routeTargetName = (node: RouteNode): string => {
    const target = node.component ?? node.childrenFrom;
    return target ? `${target.name}${target.lazy ? ` (${t('lazy')})` : ''}` : '';
};

const FeatureRoutes = (members: FeatureMembers, ctx: Context): string => {
    const nodes = ctx.routing ? routesOf(members, ctx.routing) : [];
    if (nodes.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section" data-compodoc="feature-routes">
            {Heading('routes', t('routes'), nodes.length)}
            <table class="cdx-table">
                <thead>
                    <tr>
                        <th scope="col">{t('full-path')}</th>
                        <th scope="col">{t('route-target')}</th>
                    </tr>
                </thead>
                <tbody>
                    {nodes.map(node => (
                        <tr>
                            <td>
                                <a
                                    href={hrefText(
                                        hrefFor(
                                            { type: 'root', page: 'routes' },
                                            ctx.depth,
                                            routeAnchor(node.id)
                                        )
                                    )}
                                >
                                    <code>{Html.escapeHtml(node.fullPath)}</code>
                                </a>
                            </td>
                            <td>
                                <code>{Html.escapeHtml(routeTargetName(node))}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    ) as string;
};

const fileName = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

/**
 * The feature's style pages, its components and directives with a Theming
 * tab (linked to it), and the design tokens page when one of the feature's
 * style files feeds it.
 */
const Theming = (members: FeatureMembers, styles: readonly SymbolEntry[], ctx: Context): string => {
    const themedOf = (entries: readonly SymbolEntry[], kind: 'component' | 'directive') =>
        entries.filter(entry => hasTheming(themingFor(entry.data as never, kind, ctx.mainData)));
    const themed = [
        ...themedOf(members.components, 'component'),
        ...themedOf(members.directives, 'directive')
    ];
    const tokenPage = styles.some(
        entry => unlinkedTokenFiles([entry.data as StyleFile]).length > 0
    );
    if (themed.length === 0 && styles.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading('theming', t('theming'), themed.length + styles.length)}
            {styles.length > 0 ? (
                <ul class="cdx-feature-styles">{styles.map(entry => StyleRow(entry, ctx))}</ul>
            ) : (
                ''
            )}
            {tokenPage ? (
                <p class="cdx-feature-design-tokens">
                    <a href={hrefText(hrefFor({ type: 'root', page: 'design-tokens' }, ctx.depth))}>
                        {t('design-tokens')}
                    </a>
                </p>
            ) : (
                ''
            )}
            {themed.length > 0 ? (
                <ul>
                    {themed.map(
                        entry =>
                            (
                                <li>
                                    <a
                                        href={hrefText(
                                            hrefFor(symbolTarget(entry), ctx.depth, 'theming')
                                        )}
                                    >
                                        <code>{entry.ref.name}</code>
                                    </a>
                                </li>
                            ) as string
                    )}
                </ul>
            ) : (
                ''
            )}
        </section>
    ) as string;
};

export const FeaturePage = (data: any): string => {
    const feature: FeaturePageData = data.feature;
    const ctx: Context = {
        table: data.symbols,
        di: data.di,
        semantic: data.semantic,
        routing: data.disableRoutes ? undefined : data.routing,
        depth: data.depth,
        mainData: { styles: data.styles, symbols: data.symbols }
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
            {FeatureRoutes(feature.members, ctx)}
            {Theming(feature.members, feature.styles ?? [], ctx)}
            {Related('builds-on', t('builds-on'), feature.buildsOn, ctx.depth)}
            {Related('extended-by', t('extended-by'), feature.extendedBy, ctx.depth)}
        </>
    ) as string;
};
