import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { type DiView, hasOwnPage } from '../../app/di/model';
import {
    buildGroupTree,
    type EntityKind,
    type EntityWithKind,
    type GroupNode
} from '../../app/engines/dependencies.engine';
import {
    hrefFor,
    hrefText,
    isPageKind,
    type PageKind,
    pageFile,
    pageLocation,
    pagePath,
    ROOT_DEPTH,
    type UtilityKind
} from '../../app/links/layout';
import { itemTarget, placedLink, placeTarget } from '../../app/links/resolve';
import type { SymbolId, TableKind } from '../../app/links/symbol-id';
import { entryInFile, type SymbolTable } from '../../app/links/symbol-table';
import { isAdditionalGroup } from '../../app/page-generator/additional-page-tree';
import { unlinkedTokenFiles } from '../../app/styles/design-tokens';
import { t } from '../helpers';
import { type AdditionalTreeNode, additionalTree } from '../helpers/additional-tree';
import {
    appRootPath,
    type FeatureMenuTiers,
    featureGroups,
    featureMenu,
    featurePagePaths,
    groupItemsByFeature
} from '../helpers/feature-info';
import { isToggled } from '../helpers/menu-helpers';
import {
    IconBarChart,
    IconBook,
    IconChevronRight,
    IconClass,
    IconComponent,
    IconCube,
    IconDirective,
    IconEntity,
    IconEnum,
    IconFolder,
    IconFunction,
    IconGitBranch,
    IconGrid,
    IconGuard,
    IconHome,
    IconInjectable,
    IconInterceptor,
    IconInterface,
    IconList,
    IconPalette,
    IconPipe,
    IconPodium,
    IconSettings,
    IconToken,
    IconTypealias,
    IconVariable
} from './Icons';

/** Menu types come in plural form (`components`, `directives`, `classes`).
 * Naive `replace(/s$/, '')` produces `classe` for `classes`. Handle the
 * irregular case explicitly. */
const singularizeType = (type: string): string => {
    if (type === 'classes') {
        return 'class';
    }
    return type.replace(/s$/, '');
};

// `singularizeType('tokens')` → `'token'` via the generic strip; explicit
// here so future readers don't reach for a special-case.

type MenuProps = {
    readonly data: any;
};

/** Chevron icon - CSS rotation handles open/closed state */
const chevron = (): string => IconChevronRight('cdx-chevron');

/** Config-only `collapsedAll: true` forces every chapter AND every nested folder
 * group to start collapsed, regardless of `toggleMenuItems` or `groupDepth`. */
const isCollapsedAll = (): boolean => Configuration.mainData.collapsedAll === true;

/** Whether a top-level chapter should render expanded on first load. */
const chapterOpen = (type: string): boolean => !isCollapsedAll() && isToggled(type);

/** Kinds whose same-name copies the symbol table numbers (not the engine object). */
/** Root-relative href of the own page of an engine object of `kind`; the router adds the prefix. */
const entityHref = (kind: PageKind, item: any): string =>
    hrefText(hrefFor(itemTarget(Configuration.mainData.symbols, kind, item), ROOT_DEPTH), 'bare');

/** Folder groups shallower than this start expanded (unless `collapsedAll`). */
const GROUP_EXPAND_DEPTH = 2;

/** Root-relative link to a top-level page; the client router adds the depth prefix. */
const rootHref = (page: string): string =>
    hrefText(hrefFor({ type: 'root', page }, ROOT_DEPTH), 'bare');

const UTILITY_GROUPS: readonly { kind: UtilityKind; list: string; labelKey: string }[] = [
    { kind: 'function', list: 'functions', labelKey: 'functions' },
    { kind: 'variable', list: 'variables', labelKey: 'variables' },
    { kind: 'typealias', list: 'typealiases', labelKey: 'type-aliases' },
    { kind: 'enumeration', list: 'enumerations', labelKey: 'enums' }
];

/** One menu entry per symbol of a group, deduplicated by page (overloads share one). */
const utilityItems = (items: readonly any[], kind: UtilityKind): any[] => {
    const seen = new Set<string>();
    return items
        .map(item => ({ ...item, kind }))
        .filter(item => {
            const key = entityHref(kind, item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
};

interface ChapterGroup {
    /** Element id suffix of the group. */
    readonly id: string;
    readonly label: string;
    readonly links: readonly string[];
}

/**
 * A chapter with a link to its landing page, then one collapsible group
 * per list. Groups of up to 20 entries start expanded.
 */
const GroupedChapter = (props: {
    readonly key: string;
    readonly icon: string;
    readonly label: string;
    readonly landing: string;
    readonly groups: readonly ChapterGroup[];
}): string => {
    const groups = props.groups.filter(group => group.links.length > 0);
    if (groups.length === 0) {
        return '';
    }
    const listId = `${props.key}-links`;
    return (
        <li class="chapter">
            <button
                class="simple menu-toggler"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${listId}`}
                aria-expanded={chapterOpen(props.key) ? 'true' : 'false'}
                aria-controls={listId}
            >
                {chevron()}
                {props.icon}
                <span>{props.label}</span>
            </button>
            <ul class={`links collapse${chapterOpen(props.key) ? ' in' : ''}`} id={listId}>
                <li class="link">
                    <a href={rootHref(props.landing)} data-type="entity-link">
                        {t('overview')}
                    </a>
                </li>
                {groups.map(group => {
                    const id = `${props.key}-group-${group.id}`;
                    const startExpanded = !isCollapsedAll() && group.links.length <= 20;
                    return (
                        <li class="chapter inner" style="--depth: 0">
                            <button
                                class="simple menu-toggler"
                                type="button"
                                data-cdx-toggle="collapse"
                                data-cdx-target={`#${id}`}
                                aria-expanded={startExpanded ? 'true' : 'false'}
                                aria-controls={id}
                            >
                                {IconChevronRight('cdx-chevron')}
                                <span class="link-name">{group.label}</span>
                                <span class="cdx-badge cdx-badge--count">{group.links.length}</span>
                            </button>
                            <ul class={`links collapse${startExpanded ? ' in' : ''}`} id={id}>
                                {group.links.join('')}
                            </ul>
                        </li>
                    );
                })}
            </ul>
        </li>
    ) as string;
};

/** The Utilities chapter: a link to the landing page, then one group per kind. */
const UtilitiesChapter = (d: any): string =>
    GroupedChapter({
        key: 'utilities',
        icon: IconCube(),
        label: t('utilities'),
        landing: 'utilities',
        groups: UTILITY_GROUPS.map(group => ({
            id: group.list,
            label: t(group.labelKey),
            links: utilityItems(d.miscellaneous[group.list] ?? [], group.kind).map(item =>
                EntityLink({
                    href: entityHref(group.kind, item),
                    name: item.name,
                    deprecated: item.deprecated,
                    beta: item.beta,
                    entityType: group.kind,
                    description: item.description
                })
            )
        }))
    });

/** Root-relative link to where the DI view documents a table entry. */
const placedHref = (d: any, id: SymbolId): string | undefined => {
    const table: SymbolTable | undefined = d.symbols;
    const entry = table?.byId.get(id);
    const link = table && entry && placedLink(table, entry, d.di);
    return link ? hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor), 'bare') : undefined;
};

/**
 * The Dependency Injection chapter: a link to the landing page, the
 * providers (one entry per feature type page, then the plain providers) and
 * the tokens.
 */
const DependencyInjectionChapter = (d: any): string => {
    const view: DiView | undefined = d.di;
    const table: SymbolTable | undefined = d.symbols;
    const providerLink = (id: SymbolId, entityType: string): string[] => {
        const entry = table?.byId.get(id);
        const href = placedHref(d, id);
        return entry && href
            ? [
                  EntityLink({
                      href,
                      name: entry.ref.name,
                      entityType,
                      description: (entry.data as { description?: string }).description
                  })
              ]
            : [];
    };
    return GroupedChapter({
        key: 'dependency-injection',
        icon: IconInjectable(),
        label: t('dependency-injection'),
        landing: 'dependency-injection',
        groups: [
            {
                id: 'providers',
                label: t('providers'),
                links: [
                    ...(view?.clusters ?? []).flatMap(cluster =>
                        providerLink(cluster.owner, 'cluster')
                    ),
                    ...(view?.plainProviders ?? []).flatMap(id => providerLink(id, 'provider'))
                ]
            },
            {
                id: 'tokens',
                label: t('tokens'),
                links: (d.tokens ?? []).map((item: any) =>
                    EntityLink({
                        href: entityHref('token', item),
                        name: item.name,
                        deprecated: item.deprecated,
                        isToken: true,
                        beta: item.beta,
                        entityType: 'token',
                        description: item.description
                    })
                )
            }
        ]
    });
};

/**
 * Kinds whose detail page renders an API tab. Used to gate the
 * References-chapter `#api` smart default: appending the fragment to a
 * URL whose target page has no API tab would activate nothing and just
 * leave a confusing fragment in the address bar.
 *
 * Typealias + variable detail pages (MiscDetailPage) only render Info
 * tab - their API surface IS the description / signature, surfaced
 * inline. Modules / Routes / Coverage are not entity pages.
 */
const KINDS_WITH_API_TAB: ReadonlySet<EntityKind> = new Set<EntityKind>([
    'component',
    'directive',
    'pipe',
    'injectable',
    'service',
    'class',
    'interface',
    'guard',
    'interceptor',
    'entity',
    'function',
    'enumeration'
]);

/**
 * Sidebar-link href with optional `#api` default-tab hint. The hint is
 * appended only when the target page actually has an API tab and the
 * existing href carries no fragment (anchor-style miscellaneous URLs
 * already encode the target row - never stack `#api` on top of `#name`).
 */
/** A feature-folder entry may live on a provider or cluster page; link it there. */
const placedEntityHref = (item: any): string => {
    if (!isPageKind(item.kind)) {
        return '';
    }
    const target = itemTarget(Configuration.mainData.symbols, item.kind, item);
    const link = placeTarget(target, item, Configuration.mainData);
    return link ? hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor), 'bare') : '';
};

const featureLinkHref = (item: any, defaultTab: 'api' | undefined): string => {
    const base = placedEntityHref(item);
    if (defaultTab === 'api' && KINDS_WITH_API_TAB.has(item.kind) && !base.includes('#')) {
        return `${base}#api`;
    }
    return base;
};

/** Inline badge for entity type indicators */
const Badge = (props: { label: string; cssClass: string }): string =>
    (<span class={`cdx-badge ${props.cssClass}`}>{props.label}</span>) as string;

/** Render a single entity link */
/** Truncate description to first sentence, max 120 chars */
const previewDesc = (desc?: string): string | undefined => {
    if (!desc) {
        return undefined;
    }
    const stripped = desc.replace(/<[^>]+>/g, '').trim();
    if (!stripped) {
        return undefined;
    }
    const firstSentence = stripped.split(/[.!?]\s/)[0];
    const truncated =
        firstSentence.length > 120 ? `${firstSentence.substring(0, 117)}...` : firstSentence;
    return truncated;
};

const EntityLink = (props: {
    href: string;
    name: string;
    deprecated?: boolean;
    context?: string;
    contextId?: string;
    isToken?: boolean;
    beta?: boolean;
    entityType?: string;
    selector?: string;
    inputCount?: number;
    outputCount?: number;
    description?: string;
}): string =>
    (
        <li class="link">
            <a
                href={props.href}
                data-type="entity-link"
                data-context={props.context}
                data-context-id={props.contextId}
                class={props.deprecated ? 'cdx-member-name--deprecated' : ''}
                data-cdx-entity-type={props.entityType}
                data-cdx-selector={props.selector || undefined}
                data-cdx-io={
                    props.inputCount || props.outputCount
                        ? `${props.inputCount || 0}/${props.outputCount || 0}`
                        : undefined
                }
                data-cdx-desc={previewDesc(props.description)}
            >
                <span class="cdx-menu-item-name">{props.name}</span>
                {props.deprecated ? Badge({ label: 'D', cssClass: 'cdx-badge--deprecated' }) : ''}
                {props.isToken ? Badge({ label: 'T', cssClass: 'cdx-badge--token' }) : ''}
                {props.beta ? Badge({ label: 'B', cssClass: 'cdx-badge--beta' }) : ''}
            </a>
        </li>
    ) as string;

/** Recursive tree node for hierarchical folder groups */
const GroupTree = (props: {
    node: GroupNode;
    type: string;
    kind: PageKind;
    depth: number;
    groupDepth: number;
}): string => {
    const hasContent = props.node.items.length > 0 || props.node.children.length > 0;
    if (!hasContent) {
        return '';
    }

    const id = `${props.type}-group-${props.node.fullPath}`;
    // Groups shallower than groupDepth start expanded, deeper start collapsed.
    // `collapsedAll: true` forces every nested group closed.
    const startExpanded = !isCollapsedAll() && props.depth < props.groupDepth;

    return (
        <li class="chapter inner" style={`--depth: ${props.depth}`}>
            <button
                class="simple menu-toggler"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${id}`}
                aria-expanded={startExpanded ? 'true' : 'false'}
                aria-controls={id}
            >
                {IconChevronRight('cdx-chevron')}
                <span class="link-name">
                    {props.node.name.charAt(0).toUpperCase() + props.node.name.slice(1)}
                </span>
                {props.node.items.length > 0 && (
                    <span class="cdx-badge cdx-badge--count">{props.node.items.length}</span>
                )}
            </button>
            <ul class={`links collapse${startExpanded ? ' in' : ''}`} id={id}>
                {props.node.children.map(child =>
                    GroupTree({
                        node: child,
                        type: props.type,
                        kind: props.kind,
                        depth: props.depth + 1,
                        groupDepth: props.groupDepth
                    })
                )}
                {props.node.items.map((item: any) =>
                    EntityLink({
                        href: entityHref(props.kind, item),
                        name: item.name,
                        deprecated: item.deprecated,
                        isToken: item.isToken,
                        beta: item.beta,
                        entityType: singularizeType(props.type),
                        selector: item.selector,
                        inputCount: item.inputsClass?.length,
                        outputCount: item.outputsClass?.length,
                        description: item.description
                    })
                )}
            </ul>
        </li>
    ) as string;
};

/** Per-kind Lucide icon for the feature-layout sidebar. */
const kindIconHtml = (kind: TableKind): string => {
    switch (kind) {
        case 'component':
            return IconComponent();
        case 'directive':
            return IconDirective();
        case 'injectable':
        case 'service':
            return IconInjectable();
        case 'token':
            return IconToken();
        case 'pipe':
            return IconPipe();
        case 'class':
            return IconClass();
        case 'interface':
            return IconInterface();
        case 'guard':
        case 'resolver':
            return IconGuard();
        case 'interceptor':
            return IconInterceptor();
        case 'entity':
            return IconEntity();
        case 'function':
            return IconFunction();
        case 'variable':
            return IconVariable();
        case 'typealias':
            return IconTypealias();
        case 'enumeration':
            return IconEnum();
        case 'style':
            return IconPalette();
        default:
            return '';
    }
};

/** Render a kind-tagged entity link inside a feature folder. */
const FeatureEntityLink = (item: EntityWithKind, defaultTab?: 'api'): string =>
    (
        <li class="link cdx-feature-link" data-cdx-kind={item.kind}>
            <a
                href={featureLinkHref(item as any, defaultTab)}
                data-type="entity-link"
                data-cdx-entity-type={item.kind}
                data-cdx-selector={item.selector || undefined}
                data-cdx-io={
                    item.inputsClass?.length || item.outputsClass?.length
                        ? `${item.inputsClass?.length || 0}/${item.outputsClass?.length || 0}`
                        : undefined
                }
                data-cdx-desc={previewDesc(item.description)}
                class={item.deprecated ? 'cdx-member-name--deprecated' : ''}
            >
                <span class="cdx-feature-kind-icon" aria-hidden="true">
                    {kindIconHtml(item.kind)}
                </span>
                <span class="cdx-menu-item-name">{item.name}</span>
                {item.deprecated ? Badge({ label: 'D', cssClass: 'cdx-badge--deprecated' }) : ''}
                {item.isToken ? Badge({ label: 'T', cssClass: 'cdx-badge--token' }) : ''}
                {item.beta ? Badge({ label: 'B', cssClass: 'cdx-badge--beta' }) : ''}
            </a>
        </li>
    ) as string;

/** A collapsible node of a feature's members; starts collapsed, `expandToActive` opens it. */
const RoleNode = (props: {
    id: string;
    labelKey: string;
    count: number;
    depth: number;
    role: string;
    body: string;
}): string =>
    (
        <li
            class="chapter inner cdx-feature-role"
            style={`--depth: ${props.depth}`}
            data-cdx-role={props.role}
        >
            <button
                class="simple menu-toggler"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${props.id}`}
                aria-expanded="false"
                aria-controls={props.id}
            >
                {IconChevronRight('cdx-chevron')}
                <span class="link-name">{t(props.labelKey)}</span>
                <span class="cdx-badge cdx-badge--count">{props.count}</span>
            </button>
            <ul class="links collapse" id={props.id}>
                {props.body}
            </ul>
        </li>
    ) as string;

/** The role nodes of one feature: a node per `own` role, then "More" with a labelled group per role. */
const FeatureRoleNodes = (
    tiers: FeatureMenuTiers | undefined,
    featureId: string,
    depth: number,
    defaultTab?: 'api'
): string => {
    if (tiers === undefined) {
        return '';
    }
    const links = (items: readonly EntityWithKind[]) =>
        items.map(item => FeatureEntityLink(item, defaultTab)).join('');
    const own = tiers.own.map(node =>
        RoleNode({
            id: `${featureId}-${node.role}`,
            labelKey: node.role,
            count: node.items.length,
            depth,
            role: node.role,
            body: links(node.items)
        })
    );
    const moreId = `${featureId}-more`;
    const more =
        tiers.more.length === 0
            ? ''
            : RoleNode({
                  id: moreId,
                  labelKey: 'more',
                  count: tiers.more.reduce((sum, node) => sum + node.items.length, 0),
                  depth,
                  role: 'more',
                  body: tiers.more
                      .map(
                          node =>
                              (
                                  <li class="cdx-feature-role-group" data-cdx-role={node.role}>
                                      <span
                                          class="cdx-feature-role-label"
                                          id={`${moreId}-${node.role}`}
                                      >
                                          {t(node.role)}
                                      </span>
                                      <ul class="links" aria-labelledby={`${moreId}-${node.role}`}>
                                          {links(node.items)}
                                      </ul>
                                  </li>
                              ) as string
                      )
                      .join('')
              });
    return own.join('') + more;
};

/** Recursive tree node for the cross-kind feature layout.
 *
 *  Whole-row toggle: the `<div class="cdx-bucket-row">` itself carries
 *  the collapse-toggle attributes (`role="button"`, `tabindex="0"`,
 *  `data-cdx-toggle="collapse"`, `aria-expanded`, `aria-controls`).
 *  Clicking anywhere in the row toggles expand, EXCEPT when the click
 *  originates inside the `<a data-cdx-bucket-link>` label - the
 *  client-side handler short-circuits there so the anchor's native
 *  navigation (including Cmd/middle-click new-tab) fires unaltered.
 *  No `<a>` nested in `<button>` - HTML5 forbids it; row + sibling
 *  anchor keeps the markup valid and the a11y tree clean.
 *
 *  A node whose path is a feature's page links its label there; a folder
 *  of the import path without a feature of its own (`forms` above
 *  `forms/select`) has a plain label.
 */
const FeatureGroupTree = (props: {
    node: GroupNode;
    depth: number;
    groupDepth: number;
    idPrefix: string;
    pages: ReadonlySet<string>;
    tiers: Readonly<Record<string, FeatureMenuTiers>>;
    defaultTab?: 'api';
}): string => {
    const tiers = props.tiers[props.node.fullPath];
    const hasContent =
        props.node.items.length > 0 || props.node.children.length > 0 || tiers !== undefined;
    if (!hasContent) {
        return '';
    }
    const id = `${props.idPrefix}${props.node.fullPath}`;
    const startExpanded = !isCollapsedAll() && props.depth < props.groupDepth;
    const labelHref = props.pages.has(props.node.fullPath)
        ? pagePath(
              pageLocation({
                  type: 'feature',
                  segments: props.node.fullPath.split('/').filter(Boolean)
              })
          )
        : undefined;
    const labelText = props.node.name.charAt(0).toUpperCase() + props.node.name.slice(1);
    return (
        <li
            class="chapter inner cdx-feature-bucket"
            style={`--depth: ${props.depth}`}
            data-cdx-bucket={props.node.fullPath}
        >
            {/* biome-ignore lint/a11y/useFocusableInteractive: lowercase `tabindex="0"` is focusable; Biome looks for camelCase */}
            {/* biome-ignore lint/a11y/useSemanticElements: <button> cannot contain <a> per HTML5; sibling-anchor pattern is the point */}
            <div
                class="cdx-bucket-row"
                data-cdx-bucket-row="true"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${id}`}
                role="button"
                tabindex="0"
                aria-expanded={startExpanded ? 'true' : 'false'}
                aria-controls={id}
                aria-label={`Toggle ${labelText} group`}
            >
                {IconChevronRight('cdx-chevron cdx-bucket-chevron')}
                {labelHref ? (
                    <a
                        class="cdx-bucket-link"
                        href={labelHref}
                        data-cdx-bucket-link="true"
                        data-type="chapter-link"
                    >
                        <span class="link-name">{labelText}</span>
                    </a>
                ) : (
                    <span class="cdx-bucket-link">
                        <span class="link-name">{labelText}</span>
                    </span>
                )}
                {props.node.items.length > 0 && (
                    <span class="cdx-badge cdx-badge--count cdx-bucket-count">
                        {props.node.items.length}
                    </span>
                )}
            </div>
            <ul class={`links collapse${startExpanded ? ' in' : ''}`} id={id}>
                {props.node.children.map(child =>
                    FeatureGroupTree({
                        node: child,
                        depth: props.depth + 1,
                        groupDepth: props.groupDepth,
                        idPrefix: props.idPrefix,
                        pages: props.pages,
                        tiers: props.tiers,
                        defaultTab: props.defaultTab
                    })
                )}
                {props.node.items.map((item: EntityWithKind) =>
                    FeatureEntityLink(item, props.defaultTab)
                )}
                {FeatureRoleNodes(tiers, id, props.depth + 1, props.defaultTab)}
            </ul>
        </li>
    ) as string;
};

/**
 * The Features chapter of `menuLayout: 'feature'`: the entry points as a
 * tree of their import path segments, each feature below its entry point
 * and its members below it. `groups` is keyed by feature page path;
 * `pages` holds the paths that have a feature page and `first` the path
 * listed first (an app's root feature). Renders nothing without groups.
 */
type FeatureSectionProps = {
    groups?: Record<string, EntityWithKind[]>;
    /** Role nodes per group key (features with a primary member). */
    tiers?: Readonly<Record<string, FeatureMenuTiers>>;
    pages: ReadonlySet<string>;
    first?: string;
    groupDepth: number;
    chapterKey: 'features';
    label: string;
    defaultTab?: 'api';
    /** List the design tokens page first. */
    designTokens?: boolean;
};

/**
 * The section's HTML does not depend on the page (root-relative links, no
 * active state), so it renders once per run for the same groups and options.
 */
const CachedFeatureSection = (props: FeatureSectionProps, scope: object | undefined): string => {
    const byOptions = cached(scope, props.groups, () => new Map<string, string>());
    const key = JSON.stringify([
        props.groupDepth,
        props.chapterKey,
        props.label,
        props.defaultTab,
        props.designTokens,
        isCollapsedAll(),
        chapterOpen(props.chapterKey)
    ]);
    const known = byOptions.get(key);
    if (known !== undefined) {
        return known;
    }
    const html = FeatureSection(props);
    byOptions.set(key, html);
    return html;
};

const FeatureSection = (props: FeatureSectionProps): string => {
    const groups = props.groups ?? {};
    const keys = Object.keys(groups);
    if (keys.length === 0) {
        return '';
    }
    const id = `${props.chapterKey}-links`;
    const idPrefix = `${props.chapterKey}-group-`;
    const sorted = buildGroupTree(groups as unknown as Record<string, any[]>);
    const tree = [
        ...sorted.filter(node => node.fullPath === props.first),
        ...sorted.filter(node => node.fullPath !== props.first)
    ];
    return (
        <li class={`chapter ${props.chapterKey}`}>
            <button
                class="simple menu-toggler"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${id}`}
                aria-expanded={chapterOpen(props.chapterKey) ? 'true' : 'false'}
                aria-controls={id}
            >
                {chevron()}
                {IconFolder()}
                <span>{props.label}</span>
            </button>
            <ul class={`links collapse${chapterOpen(props.chapterKey) ? ' in' : ''}`} id={id}>
                {props.designTokens ? DesignTokensLink() : ''}
                {tree.map(node =>
                    FeatureGroupTree({
                        node,
                        depth: 0,
                        groupDepth: props.groupDepth,
                        idPrefix,
                        pages: props.pages,
                        tiers: props.tiers ?? {},
                        defaultTab: props.defaultTab
                    })
                )}
            </ul>
        </li>
    ) as string;
};

/**
 * A collapsible chapter section with hierarchical folder grouping.
 */
const EntitySection = (props: {
    items: any[];
    categorized?: Record<string, any[]>;
    type: string;
    iconHtml: string;
    labelKey: string;
    kind: PageKind;
    groupDepth?: number;
    /** Rendered first in the chapter list. */
    leadHtml?: string;
}): string => {
    if (!props.items?.length) {
        return '';
    }
    const id = `${props.type}-links`;
    const hasCats = props.categorized && Object.keys(props.categorized).length > 0;
    const groupDepth = props.groupDepth ?? 2;

    return (
        <li class="chapter">
            <button
                class="simple menu-toggler"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${id}`}
                aria-expanded={chapterOpen(props.type) ? 'true' : 'false'}
                aria-controls={id}
            >
                {chevron()}
                {props.iconHtml}
                <span>{t(props.labelKey)}</span>
            </button>
            <ul class={`links collapse${chapterOpen(props.type) ? ' in' : ''}`} id={id}>
                {props.leadHtml ?? ''}
                {hasCats
                    ? (() => {
                          const tree = buildGroupTree(props.categorized!);
                          const groupedNames = new Set(
                              Object.values(props.categorized!)
                                  .flat()
                                  .map((i: any) => i.name)
                          );
                          const ungrouped = props.items.filter(i => !groupedNames.has(i.name));
                          return (
                              <>
                                  {tree.map(node =>
                                      GroupTree({
                                          node,
                                          type: props.type,
                                          kind: props.kind,
                                          depth: 0,
                                          groupDepth
                                      })
                                  )}
                                  {ungrouped.map(item =>
                                      EntityLink({
                                          href: entityHref(props.kind, item),
                                          name: item.name,
                                          deprecated: item.deprecated,
                                          isToken: item.isToken,
                                          beta: item.beta,
                                          entityType: singularizeType(props.type),
                                          selector: item.selector,
                                          inputCount: item.inputsClass?.length,
                                          outputCount: item.outputsClass?.length,
                                          description: item.description
                                      })
                                  )}
                              </>
                          );
                      })()
                    : props.items.map(item =>
                          EntityLink({
                              href: entityHref(props.kind, item),
                              name: item.name,
                              deprecated: item.deprecated,
                              isToken: item.isToken,
                              beta: item.beta,
                              entityType: singularizeType(props.type),
                              selector: item.selector,
                              inputCount: item.inputsClass?.length,
                              outputCount: item.outputsClass?.length,
                              description: item.description
                          })
                      )}
            </ul>
        </li>
    ) as string;
};

const MENU_LISTS: readonly (readonly [string, TableKind])[] = [
    ['components', 'component'],
    ['directives', 'directive'],
    ['injectables', 'injectable'],
    ['services', 'service'],
    ['tokens', 'token'],
    ['pipes', 'pipe'],
    ['classes', 'class'],
    ['interfaces', 'interface'],
    ['guards', 'guard'],
    ['interceptors', 'interceptor'],
    ['resolvers', 'resolver'],
    ['entities', 'entity']
];

const MISC_LISTS: readonly (readonly [string, EntityKind])[] = [
    ['functions', 'function'],
    ['variables', 'variable'],
    ['typealiases', 'typealias'],
    ['enumerations', 'enumeration']
];

const FUNCTIONAL_KINDS: ReadonlySet<string> = new Set(['guard', 'interceptor', 'resolver']);

const functionalKindOf = (item: any): string | undefined =>
    FUNCTIONAL_KINDS.has(item?.functionalKind) ? item.functionalKind : undefined;

const derivedLists = new WeakMap<object, WeakMap<object, unknown>>();

/**
 * `derive()` once per `source` inside `scope`. The menu renders on every page
 * from the same run-wide lists; `scope` is an object rebuilt with every crawl
 * (symbol table, DI view), so a watch rebuild starts fresh. Without a scope
 * the value is derived on each call.
 */
const cached = <T,>(scope: object | undefined, source: unknown, derive: () => T): T => {
    if (!scope || typeof source !== 'object' || source === null) {
        return derive();
    }
    const inScope = derivedLists.get(scope) ?? new WeakMap<object, unknown>();
    derivedLists.set(scope, inScope);
    if (!inScope.has(source)) {
        inScope.set(source, derive());
    }
    return inScope.get(source) as T;
};

const splitFunctional = (misc: any) => {
    const all = [...(misc.functions ?? []), ...(misc.variables ?? [])];
    const ofKind = (kind: string) => all.filter(item => functionalKindOf(item) === kind);
    const notFunctional = (items: any[] | undefined) =>
        items?.filter(item => functionalKindOf(item) === undefined);
    return {
        guards: ofKind('guard'),
        interceptors: ofKind('interceptor'),
        resolvers: ofKind('resolver'),
        miscellaneous: {
            ...misc,
            functions: notFunctional(misc.functions),
            variables: notFunctional(misc.variables)
        }
    };
};

/**
 * The menu's data with functions and constants that are guards,
 * interceptors or resolvers moved to those sections, out of Utilities.
 */
const withFunctionalKinds = (d: any): any => {
    const misc = d.miscellaneous;
    if (!misc) {
        return d;
    }
    const split = cached(d.symbols, misc, () => splitFunctional(misc));
    const merged = (list: 'guards' | 'interceptors') =>
        cached(split, d[list] ?? split[list], () => [...(d[list] ?? []), ...split[list]]);
    return {
        ...d,
        guards: merged('guards'),
        interceptors: merged('interceptors'),
        resolvers: split.resolvers,
        miscellaneous: split.miscellaneous
    };
};

/**
 * The menu's data without the symbols that get no page in their kind's
 * list (hidden, or documented on a provider or cluster page). Feature
 * folders keep the moved ones; their links follow the placement.
 */
const withoutHidden = (d: any): any => {
    const view: DiView | undefined = d.di;
    if (!view || view.placement.size === 0) {
        return d;
    }
    const keep = (kind: TableKind) => (item: any) => hasOwnPage(view, kind as EntityKind, item);
    const list = (items: any[] | undefined, test: (item: any) => boolean) =>
        items && cached(view, items, () => items.filter(test));
    const copy: any = { ...d };
    for (const [name, kind] of MENU_LISTS) {
        copy[name] = list(d[name], keep(kind));
    }
    if (d.miscellaneous) {
        copy.miscellaneous = cached(view, d.miscellaneous, () => {
            const misc = { ...d.miscellaneous };
            for (const [name, kind] of MISC_LISTS) {
                misc[name] = d.miscellaneous[name]?.filter(keep(kind));
            }
            return misc;
        });
    }
    return copy;
};

/** Whether the run has a design tokens page. */
const hasDesignTokens = (d: any): boolean => unlinkedTokenFiles(d.styles?.files ?? []).length > 0;

/** Sidebar link to the design tokens page. */
const DesignTokensLink = (): string =>
    (
        <li class="link cdx-feature-link" data-cdx-kind="style">
            <a href={rootHref('design-tokens')} data-type="chapter-link">
                <span class="cdx-feature-kind-icon" aria-hidden="true">
                    {IconPalette()}
                </span>
                <span class="cdx-menu-item-name">{t('design-tokens')}</span>
            </a>
        </li>
    ) as string;

/** The style pages of the table as sidebar items, in file order. */
const styleMenuItems = (table: SymbolTable | undefined): any[] =>
    table
        ? [...table.byId.values()]
              .filter(entry => entry.ref.kind === 'style')
              .sort((a, b) => (a.ref.file < b.ref.file ? -1 : 1))
              .map(entry => ({ name: entry.ref.name, file: entry.ref.file }))
        : [];

/**
 * A page with children: the toggle button (the chevron) comes first, then the
 * link that opens the page.
 */
const AdditionalParent = (props: {
    page: any;
    nested: boolean;
    children: AdditionalTreeNode<any>[];
}): string => {
    const id = `additional-page-${props.page.id}`;
    return (
        <li class="chapter inner cdx-additional-parent">
            <button
                class="cdx-additional-toggle"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target={`#${id}`}
                aria-expanded="false"
                aria-controls={id}
                aria-labelledby={`${id}-label`}
            >
                {IconChevronRight('cdx-chevron')}
            </button>
            <a
                data-type={props.nested ? 'entity-link' : 'chapter-link'}
                href={pageFile(props.page.path, props.page.filename)}
                data-context={props.nested ? 'sub-entity' : undefined}
                data-context-id="additional"
            >
                <span class="link-name" id={`${id}-label`}>
                    {Html.escapeHtml(props.page.name) as string}
                </span>
            </a>
            {AdditionalList({ id, nodes: props.children })}
        </li>
    ) as string;
};

/** A page below a top-level additional entry, with its own pages nested below it. */
const AdditionalNode = (node: AdditionalTreeNode<any>): string =>
    node.children.length > 0
        ? AdditionalParent({ page: node.page, nested: true, children: node.children })
        : ((
              <li class="link">
                  <a
                      href={pageFile(node.page.path, node.page.filename)}
                      data-type="entity-link"
                      data-context="sub-entity"
                      data-context-id="additional"
                  >
                      {Html.escapeHtml(node.page.name) as string}
                  </a>
              </li>
          ) as string);

/** The collapsible list of pages below an additional page or group. */
const AdditionalList = (props: { id: string; nodes: AdditionalTreeNode<any>[] }): string =>
    (
        <ul class="links collapse" id={props.id}>
            {props.nodes.map(AdditionalNode)}
        </ul>
    ) as string;

/** A top-level entry of the additional pages: a group, a page with children, or a page. */
const AdditionalEntry = (page: any): string => {
    if (isAdditionalGroup(page)) {
        const id = `additional-group-${page.id}`;
        return (
            <li class="chapter inner cdx-additional-group">
                <button
                    class="simple menu-toggler"
                    type="button"
                    data-cdx-toggle="collapse"
                    data-cdx-target={`#${id}`}
                    aria-expanded="false"
                    aria-controls={id}
                >
                    {IconChevronRight('cdx-chevron')}
                    <span class="link-name">{Html.escapeHtml(page.name) as string}</span>
                </button>
                {AdditionalList({ id, nodes: additionalTree(page.children) })}
            </li>
        ) as string;
    }
    if (page.children?.length > 0 && page.depth === 1) {
        return AdditionalParent({
            page,
            nested: false,
            children: additionalTree(page.children)
        });
    }
    return (
        <li class="link">
            <a
                href={pageFile(page.path, page.filename)}
                data-type="entity-link"
                data-context-id="additional"
            >
                {Html.escapeHtml(page.name) as string}
            </a>
        </li>
    ) as string;
};

/**
 * The generator footer. It follows the menu `<nav>` instead of sitting in its
 * list, so it stays at the bottom of the sidebar while the menu scrolls.
 */
const GeneratorFooter = (): string =>
    (
        <div class="copyright cdx-sidebar-footer">
            {t('generated-using')}{' '}
            <a href="https://compodocx.dev/" target="_blank" rel="noopener noreferrer">
                <span class="cdx-logo-placeholder">
                    <span class="cdx-logo-text">compodoc</span>
                    <span class="text-ember font-bold">x</span>
                </span>
            </a>
        </div>
    ) as string;

export const Menu = (props: MenuProps): string => {
    const d = withoutHidden(withFunctionalKinds(props.data));
    const byFeature = (items: any[] | undefined, kind: TableKind) =>
        groupItemsByFeature(d.semantic, d.symbols, kind, items);

    const components = d.components ?? [];
    const directives = d.directives ?? [];
    const injectables = d.injectables ?? [];
    const services = d.services ?? [];
    const pipes = d.pipes ?? [];
    const entities = d.entities ?? [];
    const styles = styleMenuItems(d.symbols);

    const menu = (
        <nav class="cdx-sidebar-menu">
            <ul class="list">
                {/* Getting Started */}
                <li class="chapter">
                    <a data-type="chapter-link" href={rootHref('index')}>
                        {IconHome()}
                        {t('getting-started')}
                    </a>
                    <ul class="links">
                        {!d.disableOverview && (
                            <li class="link">
                                <a
                                    href={rootHref(d.readme ? 'overview' : 'index')}
                                    data-type="chapter-link"
                                >
                                    {IconGrid()}
                                    {t('overview')}
                                </a>
                            </li>
                        )}
                        {d.readme && (
                            <li class="link">
                                <a href={rootHref('index')} data-type="chapter-link">
                                    {IconClass()}
                                    {d.disableOverview ? t('overview') : t('readme')}
                                </a>
                            </li>
                        )}
                        {(d.markdowns ?? []).map((md: any) => (
                            <li class="link">
                                <a
                                    href={rootHref(md.name !== 'readme' ? md.name : 'index')}
                                    data-type="chapter-link"
                                >
                                    {IconClass()}
                                    {md.uppername}
                                </a>
                            </li>
                        ))}
                        {!d.disableDependencies &&
                            (d.packageDependencies || d.packagePeerDependencies) && (
                                <li class="link">
                                    <a href={rootHref('dependencies')} data-type="chapter-link">
                                        {IconList()}
                                        {t('dependencies')}
                                    </a>
                                </li>
                            )}
                        {!d.disableProperties && d.packageProperties && (
                            <li class="link">
                                <a href={rootHref('properties')} data-type="chapter-link">
                                    {IconEntity()}
                                    {t('properties')}
                                </a>
                            </li>
                        )}
                    </ul>
                </li>

                {/* App Configuration */}
                {d.appConfig?.length > 0 && (
                    <li class="chapter">
                        <a data-type="chapter-link" href={rootHref('app-config')}>
                            {IconSettings()}App Configuration
                        </a>
                    </li>
                )}

                {/* Additional Pages */}
                {d.additionalPages?.length > 0 && (
                    <li class="chapter additional">
                        <button
                            class="simple menu-toggler"
                            type="button"
                            data-cdx-toggle="collapse"
                            data-cdx-target="#additional-pages"
                            aria-expanded={chapterOpen('additionalPages') ? 'true' : 'false'}
                            aria-controls="additional-pages"
                        >
                            {chevron()}
                            {IconBook()}
                            <span>{d.includesName}</span>
                        </button>
                        <ul
                            class={`links collapse${chapterOpen('additionalPages') ? ' in' : ''}`}
                            id="additional-pages"
                        >
                            {d.additionalPages.map(AdditionalEntry)}
                        </ul>
                    </li>
                )}

                {/* Feature layout: ONE Features chapter, entry points > features > the
                    primary members of each feature, the other roles in collapsed role nodes
                    (its whole surface flat when it has no primary member). The exhaustive
                    reference surface lives on the `references.html` portal page, linked below
                    as a top-level chapter, not a tree. */}
                {(d.menuLayout ?? 'feature') === 'feature' ? (
                    <>
                        {CachedFeatureSection(
                            {
                                ...featureMenu(d.semantic, d.symbols, d.di, d.menuFeatureSections),
                                pages: featurePagePaths(d.semantic),
                                first: appRootPath(d.semantic),
                                groupDepth: GROUP_EXPAND_DEPTH,
                                chapterKey: 'features',
                                label: d.featuresName || t('features'),
                                designTokens: hasDesignTokens(d)
                            },
                            d.symbols
                        )}
                        {Object.keys(featureGroups(d.semantic, d.symbols, d.di)).length > 0 && (
                            <li class="chapter references">
                                <a
                                    data-type="chapter-link"
                                    href={rootHref('references')}
                                    aria-label={t('api-reference')}
                                >
                                    {IconList()}
                                    {t('reference')}
                                </a>
                            </li>
                        )}
                    </>
                ) : (
                    <>
                        {/* Standalone entity sections */}
                        {components.length > 0 &&
                            EntitySection({
                                items: components,
                                categorized: byFeature(components, 'component'),
                                type: 'components',
                                iconHtml: IconComponent(),
                                labelKey: 'components',
                                kind: 'component',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {entities.length > 0 &&
                            EntitySection({
                                items: entities,
                                categorized: byFeature(entities, 'entity'),
                                type: 'entities',
                                iconHtml: IconEntity(),
                                labelKey: 'entities',
                                kind: 'entity',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {directives.length > 0 &&
                            EntitySection({
                                items: directives,
                                categorized: byFeature(directives, 'directive'),
                                type: 'directives',
                                iconHtml: IconDirective(),
                                labelKey: 'directives',
                                kind: 'directive',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.classes?.length > 0 &&
                            EntitySection({
                                items: d.classes,
                                categorized: byFeature(d.classes, 'class'),
                                type: 'classes',
                                iconHtml: IconClass(),
                                labelKey: 'classes',
                                kind: 'class',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {injectables.length > 0 &&
                            EntitySection({
                                items: injectables,
                                categorized: byFeature(injectables, 'injectable'),
                                type: 'injectables',
                                iconHtml: IconInjectable(),
                                labelKey: 'injectables',
                                kind: 'injectable',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {services.length > 0 &&
                            EntitySection({
                                items: services,
                                categorized: byFeature(services, 'service'),
                                type: 'services',
                                iconHtml: IconInjectable(),
                                labelKey: 'services',
                                kind: 'service',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {DependencyInjectionChapter(d)}
                        {d.interceptors?.length > 0 &&
                            EntitySection({
                                items: d.interceptors,
                                categorized: byFeature(d.interceptors, 'interceptor'),
                                type: 'interceptors',
                                iconHtml: IconInterceptor(),
                                labelKey: 'interceptors',
                                kind: 'interceptor',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.guards?.length > 0 &&
                            EntitySection({
                                items: d.guards,
                                categorized: byFeature(d.guards, 'guard'),
                                type: 'guards',
                                iconHtml: IconGuard(),
                                labelKey: 'guards',
                                kind: 'guard',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.resolvers?.length > 0 &&
                            EntitySection({
                                items: d.resolvers,
                                categorized: byFeature(d.resolvers, 'resolver'),
                                type: 'resolvers',
                                iconHtml: IconGuard(),
                                labelKey: 'resolvers',
                                kind: 'resolver',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.interfaces?.length > 0 &&
                            EntitySection({
                                items: d.interfaces,
                                categorized: byFeature(d.interfaces, 'interface'),
                                type: 'interfaces',
                                iconHtml: IconInterface(),
                                labelKey: 'interfaces',
                                kind: 'interface',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {pipes.length > 0 &&
                            EntitySection({
                                items: pipes,
                                categorized: byFeature(pipes, 'pipe'),
                                type: 'pipes',
                                iconHtml: IconPipe(),
                                labelKey: 'pipes',
                                kind: 'pipe',
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {styles.length > 0 &&
                            EntitySection({
                                items: styles,
                                categorized: byFeature(styles, 'style'),
                                type: 'styles',
                                iconHtml: IconPalette(),
                                labelKey: 'style-files',
                                kind: 'style',
                                groupDepth: GROUP_EXPAND_DEPTH,
                                leadHtml: hasDesignTokens(d) ? DesignTokensLink() : undefined
                            })}
                    </>
                )}

                {/* Utilities: functions, constants, type aliases and enums. Feature mode lists them in References. */}
                {d.miscellaneous &&
                    (d.menuLayout ?? 'feature') !== 'feature' &&
                    UtilitiesChapter(d)}

                {/* Routes */}
                {!d.disableRoutes && (d.routing?.count ?? 0) > 0 && (
                    <li class="chapter">
                        <a data-type="chapter-link" href={rootHref('routes')}>
                            {IconGitBranch()}
                            {t('routes')}
                        </a>
                    </li>
                )}

                {/* Coverage */}
                {!d.disableCoverage && (
                    <li class="chapter">
                        <a data-type="chapter-link" href={rootHref('coverage')}>
                            {IconBarChart()}
                            {t('coverage-page-title')}
                        </a>
                    </li>
                )}

                {/* Unit Test */}
                {d.unitTestData && (
                    <li class="chapter">
                        <a data-type="chapter-link" href={rootHref('unit-test')}>
                            {IconPodium()}
                            {t('unit-test-coverage')}
                        </a>
                    </li>
                )}
            </ul>
        </nav>
    ) as string;
    return d.hideGenerator ? menu : menu + GeneratorFooter();
};
