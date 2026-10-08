import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { type DiView, isHiddenItem } from '../../app/di/model';
import {
    buildGroupTree,
    type EntityKind,
    type EntityWithKind,
    type GroupNode
} from '../../app/engines/dependencies.engine';
import {
    hrefFor,
    hrefText,
    KIND_FOLDER,
    pageFile,
    pageLocation,
    pagePath,
    ROOT_DEPTH,
    type UtilityKind
} from '../../app/links/layout';
import type { TableKind } from '../../app/links/symbol-id';
import { entryInFile } from '../../app/links/symbol-table';
import { t } from '../helpers';
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
    IconFolder,
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
    IconToken
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

/** The Utilities chapter: a link to the landing page, then one group per kind. */
const UtilitiesChapter = (d: any): string => {
    const groups = UTILITY_GROUPS.map(group => ({
        ...group,
        items: utilityItems(d.miscellaneous[group.list] ?? [], group.kind)
    })).filter(group => group.items.length > 0);
    if (groups.length === 0) {
        return '';
    }
    return (
        <li class="chapter">
            <button
                class="simple menu-toggler"
                type="button"
                data-cdx-toggle="collapse"
                data-cdx-target="#utilities-links"
                aria-expanded={chapterOpen('utilities') ? 'true' : 'false'}
                aria-controls="utilities-links"
            >
                {IconCube()}
                <span>{t('utilities')}</span>
                {chevron()}
            </button>
            <ul
                class={`links collapse${chapterOpen('utilities') ? ' in' : ''}`}
                id="utilities-links"
            >
                <li class="link">
                    <a href={rootHref('utilities')} data-type="entity-link">
                        {t('overview')}
                    </a>
                </li>
                {groups.map(group => {
                    const id = `utilities-group-${group.list}`;
                    const startExpanded = !isCollapsedAll() && group.items.length <= 20;
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
                                <span class="link-name">{t(group.labelKey)}</span>
                                <span class="cdx-badge cdx-badge--count">{group.items.length}</span>
                                {IconChevronRight('cdx-chevron')}
                            </button>
                            <ul class={`links collapse${startExpanded ? ' in' : ''}`} id={id}>
                                {group.items.map(item =>
                                    EntityLink({
                                        href: entityHref(KIND_FOLDER[group.kind], item),
                                        name: item.name,
                                        deprecated: item.deprecated,
                                        beta: item.beta,
                                        entityType: group.kind,
                                        description: item.description
                                    })
                                )}
                            </ul>
                        </li>
                    );
                })}
            </ul>
        </li>
    ) as string;
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
const featureLinkHref = (prefix: string, item: any, defaultTab: 'api' | undefined): string => {
    const base = entityHref(prefix, item);
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
    factoryKind?: string;
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
                {props.factoryKind
                    ? Badge({
                          label: props.factoryKind.charAt(0).toUpperCase(),
                          cssClass: 'cdx-badge--factory'
                      })
                    : ''}
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
                        factoryKind: item.factoryKind,
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
                {item.factoryKind
                    ? Badge({
                          label: item.factoryKind.charAt(0).toUpperCase(),
                          cssClass: 'cdx-badge--factory'
                      })
                    : ''}
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
 *  The bucket landing page exists for EVERY non-empty node — leaves and
 *  intermediate folders alike — so any label that renders here is
 *  guaranteed to resolve.
 */
const FeatureGroupTree = (props: {
    node: GroupNode;
    depth: number;
    groupDepth: number;
    idPrefix: string;
    defaultTab?: 'api';
}): string => {
    const hasContent = props.node.items.length > 0 || props.node.children.length > 0;
    if (!hasContent) {
        return '';
    }
    const id = `${props.idPrefix}${props.node.fullPath}`;
    const startExpanded = !isCollapsedAll() && props.depth < props.groupDepth;
    const labelHref = pagePath(
        pageLocation({ type: 'bucket', segments: props.node.fullPath.split('/').filter(Boolean) })
    );
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
                <a
                    class="cdx-bucket-link"
                    href={labelHref}
                    data-cdx-bucket-link="true"
                    data-type="chapter-link"
                >
                    <span class="link-name">{labelText}</span>
                </a>
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
 * Cross-kind chapter for `menuLayout: 'feature'`. Renders nothing when the
 * `groups` dict is empty. The same component renders both the Primary
 * ("Features") and Reference chapters — `chapterKey` drives the id prefix,
 * collapse state, and label.
 */
const FeatureSection = (props: {
    groups?: Record<string, EntityWithKind[]>;
    groupDepth: number;
    chapterKey: 'features' | 'references';
    label: string;
    defaultTab?: 'api';
}): string => {
    const groups = props.groups ?? {};
    const keys = Object.keys(groups);
    if (keys.length === 0) {
        return '';
    }
    const id = `${props.chapterKey}-links`;
    const idPrefix = `${props.chapterKey}-group-`;
    const tree = buildGroupTree(groups as unknown as Record<string, any[]>);
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
                                          factoryKind: item.factoryKind,
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
                              factoryKind: item.factoryKind,
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

const MENU_LISTS: readonly (readonly [string, string, TableKind])[] = [
    ['components', 'categorizedComponents', 'component'],
    ['directives', 'categorizedDirectives', 'directive'],
    ['injectables', 'categorizedInjectables', 'injectable'],
    ['tokens', 'categorizedTokens', 'token'],
    ['pipes', 'categorizedPipes', 'pipe'],
    ['classes', 'categorizedClasses', 'class'],
    ['interfaces', 'categorizedInterfaces', 'interface'],
    ['guards', 'categorizedGuards', 'guard'],
    ['interceptors', 'categorizedInterceptors', 'interceptor'],
    ['resolvers', 'categorizedResolvers', 'resolver'],
    ['entities', 'categorizedEntities', 'entity']
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

/** The menu's data without the symbols that get no page. */
const withoutHidden = (d: any): any => {
    const view: DiView | undefined = d.di;
    if (!view || view.hidden.length === 0) {
        return d;
    }
    const keep = (kind: TableKind) => (item: any) => !isHiddenItem(view, kind as EntityKind, item);
    const keepOwnKind = (item: any) => !isHiddenItem(view, item.kind, item);
    const list = (items: any[] | undefined, test: (item: any) => boolean) =>
        items && cached(view, items, () => items.filter(test));
    const groups = (record: Record<string, any[]> | undefined, test: (item: any) => boolean) =>
        record &&
        cached(view, record, () =>
            Object.fromEntries(
                Object.entries(record).map(([key, items]) => [key, items.filter(test)])
            )
        );
    const copy: any = { ...d };
    for (const [name, categorized, kind] of MENU_LISTS) {
        copy[name] = list(d[name], keep(kind));
        copy[categorized] = groups(d[categorized], keep(kind));
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
    copy.categorizedByFeature = groups(d.categorizedByFeature, keepOwnKind);
    copy.categorizedByFeaturePrimary = groups(d.categorizedByFeaturePrimary, keepOwnKind);
    return copy;
};

export const Menu = (props: MenuProps): string => {
    const d = withoutHidden(withFunctionalKinds(props.data));

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

                {/* Feature-folder layout renders ONE curated cross-kind chapter ("Features":
                    organisms — components, directives, pipes, injectables, classes, guards,
                    interceptors, entities, plus any reference-kind symbol promoted via
                    @docsKind primary). The exhaustive reference surface lives on the
                    `references.html` portal page (linked below as a top-level chapter, not a
                    tree). That keeps the sidebar scannable and matches angular.dev/api. */}
                {(d.menuLayout ?? 'type') === 'feature' ? (
                    <>
                        {FeatureSection({
                            groups: d.categorizedByFeaturePrimary,
                            groupDepth: d.groupDepth,
                            chapterKey: 'features',
                            label: d.featuresName || t('features')
                        })}
                        {Object.keys(d.categorizedByFeature ?? {}).length > 0 && (
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
                                categorized: d.categorizedComponents,
                                type: 'components',
                                iconHtml: IconComponent(),
                                labelKey: 'components',
                                hrefPrefix: KIND_FOLDER.component,
                                groupDepth: d.groupDepth
                            })}
                        {entities.length > 0 &&
                            EntitySection({
                                items: entities,
                                type: 'entities',
                                iconHtml: IconEntity(),
                                labelKey: 'entities',
                                hrefPrefix: KIND_FOLDER.entity,
                                groupDepth: d.groupDepth
                            })}
                        {directives.length > 0 &&
                            EntitySection({
                                items: directives,
                                categorized: d.categorizedDirectives,
                                type: 'directives',
                                iconHtml: IconDirective(),
                                labelKey: 'directives',
                                hrefPrefix: KIND_FOLDER.directive,
                                groupDepth: d.groupDepth
                            })}
                        {d.classes?.length > 0 &&
                            EntitySection({
                                items: d.classes,
                                categorized: d.categorizedClasses,
                                type: 'classes',
                                iconHtml: IconClass(),
                                labelKey: 'classes',
                                hrefPrefix: KIND_FOLDER.class,
                                groupDepth: d.groupDepth
                            })}
                        {injectables.length > 0 &&
                            EntitySection({
                                items: injectables,
                                categorized: d.categorizedInjectables,
                                type: 'injectables',
                                iconHtml: IconInjectable(),
                                labelKey: 'injectables',
                                hrefPrefix: KIND_FOLDER.injectable,
                                groupDepth: d.groupDepth
                            })}
                        {d.tokens?.length > 0 &&
                            EntitySection({
                                items: d.tokens,
                                categorized: d.categorizedTokens,
                                type: 'tokens',
                                iconHtml: IconToken(),
                                labelKey: 'tokens',
                                hrefPrefix: KIND_FOLDER.token,
                                groupDepth: d.groupDepth
                            })}
                        {d.interceptors?.length > 0 &&
                            EntitySection({
                                items: d.interceptors,
                                categorized: d.categorizedInterceptors,
                                type: 'interceptors',
                                iconHtml: IconInterceptor(),
                                labelKey: 'interceptors',
                                hrefPrefix: KIND_FOLDER.interceptor,
                                groupDepth: d.groupDepth
                            })}
                        {d.guards?.length > 0 &&
                            EntitySection({
                                items: d.guards,
                                categorized: d.categorizedGuards,
                                type: 'guards',
                                iconHtml: IconGuard(),
                                labelKey: 'guards',
                                hrefPrefix: KIND_FOLDER.guard,
                                groupDepth: d.groupDepth
                            })}
                        {d.resolvers?.length > 0 &&
                            EntitySection({
                                items: d.resolvers,
                                type: 'resolvers',
                                iconHtml: IconGuard(),
                                labelKey: 'resolvers',
                                hrefPrefix: KIND_FOLDER.resolver,
                                groupDepth: d.groupDepth
                            })}
                        {d.interfaces?.length > 0 &&
                            EntitySection({
                                items: d.interfaces,
                                categorized: d.categorizedInterfaces,
                                type: 'interfaces',
                                iconHtml: IconInterface(),
                                labelKey: 'interfaces',
                                hrefPrefix: KIND_FOLDER.interface,
                                groupDepth: d.groupDepth
                            })}
                        {pipes.length > 0 &&
                            EntitySection({
                                items: pipes,
                                categorized: d.categorizedPipes,
                                type: 'pipes',
                                iconHtml: IconPipe(),
                                labelKey: 'pipes',
                                hrefPrefix: KIND_FOLDER.pipe,
                                groupDepth: d.groupDepth
                            })}
                    </>
                )}

                {/* Utilities: functions, constants, type aliases and enums. Feature mode lists them in References. */}
                {d.miscellaneous && (d.menuLayout ?? 'type') !== 'feature' && UtilitiesChapter(d)}

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
