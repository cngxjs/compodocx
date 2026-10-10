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
    KIND_FOLDER,
    pageFile,
    pageLocation,
    pagePath,
    ROOT_DEPTH,
    type UtilityKind
} from '../../app/links/layout';
import { placedLink, placeTarget } from '../../app/links/resolve';
import type { SymbolId, TableKind } from '../../app/links/symbol-id';
import { entryInFile, type SymbolTable } from '../../app/links/symbol-table';
import { t } from '../helpers';
import {
    appRootPath,
    featureGroups,
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

/** Chevron icon — CSS rotation handles open/closed state */
const chevron = (): string => IconChevronRight('cdx-chevron');

/** Config-only `collapsedAll: true` forces every chapter AND every nested folder
 * group to start collapsed, regardless of `toggleMenuItems` or `groupDepth`. */
const isCollapsedAll = (): boolean => Configuration.mainData.collapsedAll === true;

/** Whether a top-level chapter should render expanded on first load. */
const chapterOpen = (type: string): boolean => !isCollapsedAll() && isToggled(type);

/** Kinds whose same-name copies the symbol table numbers (not the engine object). */
const TABLE_NUMBERED_KINDS = new Set<EntityKind>([
    'variable',
    'function',
    'typealias',
    'enumeration',
    'token'
]);

const duplicateNameOf = (item: any): string | undefined => {
    if (!TABLE_NUMBERED_KINDS.has(item.kind)) {
        return item.duplicateName;
    }
    const table = Configuration.mainData.symbols;
    return table ? entryInFile(table, item.kind, item.name, item.file)?.duplicateName : undefined;
};

/** Entity link href with duplicateName fallback. */
const entityHref = (prefix: string, item: any): string =>
    pageFile(prefix, duplicateNameOf(item) ?? item.name);

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
            const key = `${item.file}#${duplicateNameOf(item) ?? item.name}`;
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
                {props.icon}
                <span>{props.label}</span>
                {chevron()}
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
                                <span class="link-name">{group.label}</span>
                                <span class="cdx-badge cdx-badge--count">{group.links.length}</span>
                                {IconChevronRight('cdx-chevron')}
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
                    href: entityHref(KIND_FOLDER[group.kind], item),
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
    const link = table && entry && placedLink(table, entry, d.di, { duplicate: true });
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
                        href: entityHref(KIND_FOLDER.token, { ...item, kind: 'token' }),
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
 * tab — their API surface IS the description / signature, surfaced
 * inline. Modules / Routes / Coverage are not entity pages.
 */
const KINDS_WITH_API_TAB: ReadonlySet<EntityKind> = new Set<EntityKind>([
    'component',
    'directive',
    'pipe',
    'injectable',
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
 * already encode the target row — never stack `#api` on top of `#name`).
 */
/** A feature-folder entry may live on a provider or cluster page; link it there. */
const placedEntityHref = (prefix: string, item: any): string => {
    const kind = isPageKind(item.kind) ? item.kind : undefined;
    const link =
        kind &&
        placeTarget({ type: 'symbol', kind, name: item.name }, item, Configuration.mainData);
    const moved = link && (link.target.type !== 'symbol' || link.target.kind !== kind);
    return moved
        ? hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor), 'bare')
        : entityHref(prefix, item);
};

const featureLinkHref = (prefix: string, item: any, defaultTab: 'api' | undefined): string => {
    const base = placedEntityHref(prefix, item);
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
    hrefPrefix: string;
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
                <span class="link-name">
                    {props.node.name.charAt(0).toUpperCase() + props.node.name.slice(1)}
                </span>
                {props.node.items.length > 0 && (
                    <span class="cdx-badge cdx-badge--count">{props.node.items.length}</span>
                )}
                {IconChevronRight('cdx-chevron')}
            </button>
            <ul class={`links collapse${startExpanded ? ' in' : ''}`} id={id}>
                {props.node.children.map(child =>
                    GroupTree({
                        node: child,
                        type: props.type,
                        hrefPrefix: props.hrefPrefix,
                        depth: props.depth + 1,
                        groupDepth: props.groupDepth
                    })
                )}
                {props.node.items.map((item: any) =>
                    EntityLink({
                        href: entityHref(props.hrefPrefix, item),
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
        default:
            return '';
    }
};

/** Render a kind-tagged entity link inside a feature folder. */
const FeatureEntityLink = (item: EntityWithKind, defaultTab?: 'api'): string =>
    (
        <li class="link cdx-feature-link" data-cdx-kind={item.kind}>
            <a
                href={featureLinkHref(item.hrefPrefix, item as any, defaultTab)}
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

/** Recursive tree node for the cross-kind feature layout.
 *
 *  Whole-row toggle: the `<div class="cdx-bucket-row">` itself carries
 *  the collapse-toggle attributes (`role="button"`, `tabindex="0"`,
 *  `data-cdx-toggle="collapse"`, `aria-expanded`, `aria-controls`).
 *  Clicking anywhere in the row toggles expand, EXCEPT when the click
 *  originates inside the `<a data-cdx-bucket-link>` label — the
 *  client-side handler short-circuits there so the anchor's native
 *  navigation (including Cmd/middle-click new-tab) fires unaltered.
 *  No `<a>` nested in `<button>` — HTML5 forbids it; row + sibling
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
    defaultTab?: 'api';
}): string => {
    const hasContent = props.node.items.length > 0 || props.node.children.length > 0;
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
                {IconChevronRight('cdx-chevron cdx-bucket-chevron')}
            </div>
            <ul class={`links collapse${startExpanded ? ' in' : ''}`} id={id}>
                {props.node.children.map(child =>
                    FeatureGroupTree({
                        node: child,
                        depth: props.depth + 1,
                        groupDepth: props.groupDepth,
                        idPrefix: props.idPrefix,
                        pages: props.pages,
                        defaultTab: props.defaultTab
                    })
                )}
                {props.node.items.map((item: EntityWithKind) =>
                    FeatureEntityLink(item, props.defaultTab)
                )}
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
    pages: ReadonlySet<string>;
    first?: string;
    groupDepth: number;
    chapterKey: 'features';
    label: string;
    defaultTab?: 'api';
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
                {IconFolder()}
                <span>{props.label}</span>
                {chevron()}
            </button>
            <ul class={`links collapse${chapterOpen(props.chapterKey) ? ' in' : ''}`} id={id}>
                {tree.map(node =>
                    FeatureGroupTree({
                        node,
                        depth: 0,
                        groupDepth: props.groupDepth,
                        idPrefix,
                        pages: props.pages,
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
    hrefPrefix: string;
    groupDepth?: number;
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
                {props.iconHtml}
                <span>{t(props.labelKey)}</span>
                {chevron()}
            </button>
            <ul class={`links collapse${chapterOpen(props.type) ? ' in' : ''}`} id={id}>
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
                                          hrefPrefix: props.hrefPrefix,
                                          depth: 0,
                                          groupDepth
                                      })
                                  )}
                                  {ungrouped.map(item =>
                                      EntityLink({
                                          href: entityHref(props.hrefPrefix, item),
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
                              href: entityHref(props.hrefPrefix, item),
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

export const Menu = (props: MenuProps): string => {
    const d = withoutHidden(withFunctionalKinds(props.data));
    const byFeature = (items: any[] | undefined, kind: TableKind) =>
        groupItemsByFeature(d.semantic, d.symbols, kind, items);

    const components = d.components ?? [];
    const directives = d.directives ?? [];
    const injectables = d.injectables ?? [];
    const pipes = d.pipes ?? [];
    const entities = d.entities ?? [];

    return (
        <nav>
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
                            {IconBook()}
                            <span>{d.includesName}</span>
                            {chevron()}
                        </button>
                        <ul
                            class={`links collapse${chapterOpen('additionalPages') ? ' in' : ''}`}
                            id="additional-pages"
                        >
                            {d.additionalPages.map((page: any) =>
                                page.children?.length > 0 && page.depth === 1 ? (
                                    <li class="chapter inner">
                                        <a
                                            data-type="chapter-link"
                                            href={pageFile(page.path, page.filename)}
                                            data-context-id="additional"
                                        >
                                            {/* biome-ignore lint/a11y/useFocusableInteractive: Bootstrap collapse toggle wired to data-cdx-toggle */}
                                            {/* biome-ignore lint/a11y/useSemanticElements: Bootstrap collapse toggle wired to data-cdx-toggle */}
                                            <div
                                                class="menu-toggler linked"
                                                role="button"
                                                data-cdx-toggle="collapse"
                                                data-cdx-target={`#additional-page-${page.id}`}
                                                aria-expanded="false"
                                                aria-controls={`additional-page-${page.id}`}
                                            >
                                                <span class="link-name">{page.name}</span>
                                                {IconChevronRight('cdx-chevron')}
                                            </div>
                                        </a>
                                        <ul
                                            class="links collapse"
                                            id={`additional-page-${page.id}`}
                                        >
                                            {page.children.map((child: any) => (
                                                <li
                                                    class={`link${child.depth > 1 ? ` for-chapter${child.depth}` : ''}`}
                                                >
                                                    <a
                                                        href={pageFile(child.path, child.filename)}
                                                        data-type="entity-link"
                                                        data-context="sub-entity"
                                                        data-context-id="additional"
                                                    >
                                                        {child.name}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ) : (
                                    <li
                                        class={`link${page.depth > 1 ? ` for-chapter${page.depth}` : ''}`}
                                    >
                                        <a
                                            href={pageFile(page.path, page.filename)}
                                            data-type="entity-link"
                                            data-context-id="additional"
                                        >
                                            {page.name}
                                        </a>
                                    </li>
                                )
                            )}
                        </ul>
                    </li>
                )}

                {/* Feature layout: ONE Features chapter, entry points > features > the
                    primary members of each feature (its whole surface when it has no primary
                    member). The exhaustive reference surface lives on the `references.html`
                    portal page, linked below as a top-level chapter, not a tree. */}
                {(d.menuLayout ?? 'feature') === 'feature' ? (
                    <>
                        {CachedFeatureSection(
                            {
                                groups: featureGroups(d.semantic, d.symbols, d.di, 'primary'),
                                pages: featurePagePaths(d.semantic),
                                first: appRootPath(d.semantic),
                                groupDepth: GROUP_EXPAND_DEPTH,
                                chapterKey: 'features',
                                label: d.featuresName || t('features')
                            },
                            d.symbols
                        )}
                        {Object.keys(featureGroups(d.semantic, d.symbols, d.di, 'all')).length >
                            0 && (
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
                                hrefPrefix: KIND_FOLDER.component,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {entities.length > 0 &&
                            EntitySection({
                                items: entities,
                                categorized: byFeature(entities, 'entity'),
                                type: 'entities',
                                iconHtml: IconEntity(),
                                labelKey: 'entities',
                                hrefPrefix: KIND_FOLDER.entity,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {directives.length > 0 &&
                            EntitySection({
                                items: directives,
                                categorized: byFeature(directives, 'directive'),
                                type: 'directives',
                                iconHtml: IconDirective(),
                                labelKey: 'directives',
                                hrefPrefix: KIND_FOLDER.directive,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.classes?.length > 0 &&
                            EntitySection({
                                items: d.classes,
                                categorized: byFeature(d.classes, 'class'),
                                type: 'classes',
                                iconHtml: IconClass(),
                                labelKey: 'classes',
                                hrefPrefix: KIND_FOLDER.class,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {injectables.length > 0 &&
                            EntitySection({
                                items: injectables,
                                categorized: byFeature(injectables, 'injectable'),
                                type: 'injectables',
                                iconHtml: IconInjectable(),
                                labelKey: 'injectables',
                                hrefPrefix: KIND_FOLDER.injectable,
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
                                hrefPrefix: KIND_FOLDER.interceptor,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.guards?.length > 0 &&
                            EntitySection({
                                items: d.guards,
                                categorized: byFeature(d.guards, 'guard'),
                                type: 'guards',
                                iconHtml: IconGuard(),
                                labelKey: 'guards',
                                hrefPrefix: KIND_FOLDER.guard,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.resolvers?.length > 0 &&
                            EntitySection({
                                items: d.resolvers,
                                categorized: byFeature(d.resolvers, 'resolver'),
                                type: 'resolvers',
                                iconHtml: IconGuard(),
                                labelKey: 'resolvers',
                                hrefPrefix: KIND_FOLDER.resolver,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {d.interfaces?.length > 0 &&
                            EntitySection({
                                items: d.interfaces,
                                categorized: byFeature(d.interfaces, 'interface'),
                                type: 'interfaces',
                                iconHtml: IconInterface(),
                                labelKey: 'interfaces',
                                hrefPrefix: KIND_FOLDER.interface,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                        {pipes.length > 0 &&
                            EntitySection({
                                items: pipes,
                                categorized: byFeature(pipes, 'pipe'),
                                type: 'pipes',
                                iconHtml: IconPipe(),
                                labelKey: 'pipes',
                                hrefPrefix: KIND_FOLDER.pipe,
                                groupDepth: GROUP_EXPAND_DEPTH
                            })}
                    </>
                )}

                {/* Utilities: functions, constants, type aliases and enums. Feature mode lists them in References. */}
                {d.miscellaneous &&
                    (d.menuLayout ?? 'feature') !== 'feature' &&
                    UtilitiesChapter(d)}

                {/* Routes */}
                {!d.disableRoutesGraph && d.routes && (
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

                {/* Generator footer */}
                {!d.hideGenerator && (
                    <>
                        <li class="divider"></li>
                        <li class="copyright">
                            {t('generated-using')}{' '}
                            <a
                                href="https://compodocx.dev/"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span class="cdx-logo-placeholder">
                                    <span class="cdx-logo-text">compodoc</span>
                                    <span class="text-ember font-bold">x</span>
                                </span>
                            </a>
                        </li>
                    </>
                )}
            </ul>
        </nav>
    ) as string;
};
