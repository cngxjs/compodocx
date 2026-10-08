import Html from '@kitajs/html';
import { hrefFor, hrefText } from '../../app/links/layout';
import { ParamsTable } from '../blocks/ParamsTable';
import { ReferencedBySection } from '../blocks/ReferencedBySection';
import { IconEnum, IconFile, IconFunction, IconTypealias, IconVariable } from '../components/Icons';
import { WcagBadge } from '../components/WcagBadge';
import {
    codeWrap,
    deriveLibFromBucket,
    functionSignature,
    hasJsdocParams,
    jsdocReturnsComment,
    linkTypeHtml,
    pagefindFilterBlock,
    pagefindMetaBlock,
    parseDescription,
    resolveBucketSegments,
    t
} from '../helpers';
import { utilityGroupAnchor } from './UtilitiesPage';

export type MiscDetailKind = 'function' | 'variable' | 'typealias' | 'enumeration';

interface MiscDetailMeta {
    readonly color: string;
    readonly icon: () => string;
    readonly badge: string;
    readonly label: string;
    readonly breadcrumb: string;
}

const META: Record<MiscDetailKind, MiscDetailMeta> = {
    function: {
        color: 'var(--color-cdx-entity-function)',
        icon: IconFunction,
        badge: 'cdx-badge--entity-function',
        label: 'Function',
        breadcrumb: 'functions'
    },
    variable: {
        color: 'var(--color-cdx-entity-service)',
        icon: IconVariable,
        badge: 'cdx-badge--entity-variable',
        label: 'Variable',
        breadcrumb: 'variables'
    },
    typealias: {
        color: 'var(--color-cdx-entity-typealias)',
        icon: IconTypealias,
        badge: 'cdx-badge--entity-typealias',
        label: 'Type Alias',
        breadcrumb: 'type-aliases'
    },
    enumeration: {
        color: 'var(--color-cdx-entity-enum)',
        icon: IconEnum,
        badge: 'cdx-badge--entity-enum',
        label: 'Enumeration',
        breadcrumb: 'enumerations'
    }
};

export interface MiscDetailProps {
    readonly kind: MiscDetailKind;
    readonly item: any;
    readonly depth?: number;
    /** A line under the name, e.g. "Functional guard". */
    readonly contextLine?: string;
}

interface SectionProps {
    readonly title: string;
    readonly id?: string;
    readonly children: string | string[];
}

const Section = (props: SectionProps): string => {
    const id = props.id ?? props.title.toLowerCase().replace(/\s+/g, '-');
    return (
        <section class="cdx-content-section" id={id}>
            <h3 class="cdx-section-heading">
                {props.title}
                <a
                    class="cdx-member-permalink"
                    href={`#${id}`}
                    aria-label={`Link to ${props.title}`}
                >
                    #
                </a>
            </h3>
            {props.children}
        </section>
    ) as string;
};

/** JSDoc `@example` comments are pre-rendered by `markedtags()` in
 * `src/utils/utils.ts` — by the time we see them here `tag.comment` already
 * contains the Shiki output (`<div class="cdx-code-snippet">...`). We collect
 * those rendered strings directly; routing them through
 * `extractJsdocCodeExamples` would re-wrap and html-entity-escape the already-
 * rendered HTML (the function's `parseCodeFences` `if (!hasCodeFences)` branch
 * treats the entire HTML blob as a single language-html block). */
const collectExampleComments = (item: any): string[] => {
    const tags = item.jsdoctags ?? [];
    const out: string[] = [];
    for (const tag of tags) {
        if (
            tag?.tagName?.text === 'example' &&
            typeof tag.comment === 'string' &&
            tag.comment.trim().length > 0
        ) {
            out.push(tag.comment);
        }
    }
    return out;
};

//  Info-tab content (description + prose)

const InfoContent = (item: any, depth: number): string => {
    const backlinks = ReferencedBySection({
        entries: item.referencedBy,
        depth
    });
    if (!item.description) {
        return backlinks;
    }
    return [
        backlinks,
        Section({
            title: t('description'),
            children: parseDescription(item.description, depth)
        })
    ].join('');
};

//  API-tab content (structural data per kind)

const FunctionApi = (item: any, depth: number): string => {
    const hasSignature = (item.args?.length ?? 0) > 0 || item.returnType;
    const hasParams = item.jsdoctags && hasJsdocParams(item.jsdoctags);
    const returnsComment = item.jsdoctags ? jsdocReturnsComment(item.jsdoctags) : '';
    return [
        hasSignature
            ? Section({
                  title: t('signature'),
                  children: (
                      <pre class="cdx-derived-body">
                          <code>{functionSignature(item, depth)}</code>
                      </pre>
                  ) as string
              })
            : '',
        hasParams
            ? Section({
                  title: t('parameters'),
                  children: ParamsTable({
                      jsdocTags: item.jsdoctags,
                      depth,
                      typeLinkDepth: depth,
                      showOptional: true,
                      showDefaultValue: true
                  })
              })
            : '',
        item.returnType
            ? Section({
                  title: t('returns'),
                  children: [linkTypeHtml(item.returnType, { depth }), returnsComment].join(' ')
              })
            : ''
    ].join('');
};

const VariableApi = (item: any, depth: number): string => {
    return [
        item.type
            ? Section({
                  title: t('type'),
                  children: linkTypeHtml(item.type, { depth })
              })
            : '',
        item.defaultValue !== undefined && item.defaultValue !== null && item.defaultValue !== ''
            ? Section({
                  title: t('default-value'),
                  children: codeWrap(String(item.defaultValue))
              })
            : ''
    ].join('');
};

const TypealiasApi = (item: any, depth: number): string => {
    const isCallSignature = item.kind === 160;
    return Section({
        title: t('definition'),
        children: (
            <pre class="cdx-derived-body">
                <code>
                    {isCallSignature
                        ? functionSignature(item, depth)
                        : linkTypeHtml(item.rawtype ?? '', { depth })}
                </code>
            </pre>
        ) as string
    });
};

const EnumerationApi = (item: any): string => {
    const members = (item.childs ?? []) as Array<{
        name?: string;
        value?: string;
        deprecated?: boolean;
        deprecationMessage?: string;
    }>;
    if (members.length === 0) {
        return '';
    }
    return Section({
        title: t('members'),
        children: (
            <table class="cdx-table">
                <thead>
                    <tr>
                        <th>{t('name')}</th>
                        <th>{t('value')}</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map(member => (
                        <tr>
                            <td>
                                <code
                                    class={member.deprecated ? 'cdx-member-name--deprecated' : ''}
                                >
                                    {member.name ?? ''}
                                </code>
                                {member.deprecated && (
                                    <span class="cdx-badge cdx-badge--deprecated">
                                        {t('deprecated')}
                                    </span>
                                )}
                            </td>
                            <td>{member.value ? codeWrap(member.value) : ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ) as string
    });
};

const ApiContent = (props: MiscDetailProps): string => {
    const depth = props.depth ?? 1;
    switch (props.kind) {
        case 'function':
            return FunctionApi(props.item, depth);
        case 'variable':
            return VariableApi(props.item, depth);
        case 'typealias':
            return TypealiasApi(props.item, depth);
        case 'enumeration':
            return EnumerationApi(props.item);
    }
};

//  Examples-tab content (@example JSDoc blocks)
// Same rendering pipeline as the markdown-engine code renderer
// (`<div class="cdx-code-snippet">` with Shiki output) — see `collectExampleComments`
// for why we don't go through JsdocExamplesBlock/extractJsdocCodeExamples here.

const ExamplesContent = (item: any): string => {
    const examples = collectExampleComments(item);
    if (examples.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            <h3 class="cdx-section-heading">{t('example')}</h3>
            <div class="cdx-member-description">
                {examples.map(html => (<div>{html}</div>) as string).join('')}
            </div>
        </section>
    ) as string;
};

//  Tab orchestration

interface MiscTab {
    readonly id: 'info' | 'api' | 'example';
    readonly label: string;
    readonly content: string;
}

const buildTabs = (props: MiscDetailProps): MiscTab[] => {
    const depth = props.depth ?? 1;
    const tabs: MiscTab[] = [];

    const info = InfoContent(props.item, depth);
    tabs.push({
        id: 'info',
        label: 'Info',
        content: info || EmptyInfoFallback()
    });

    const api = ApiContent(props);
    if (api) {
        tabs.push({ id: 'api', label: 'API', content: api });
    }

    const examples = ExamplesContent(props.item);
    if (examples) {
        tabs.push({ id: 'example', label: 'Examples', content: examples });
    }

    return tabs;
};

const EmptyInfoFallback = (): string =>
    (
        <p class="cdx-misc-info-empty">
            <em>{t('no-overview')}</em>
        </p>
    ) as string;

const TabBar = (tabs: MiscTab[]): string =>
    (
        <ul class="cdx-tab-bar">
            {tabs.map((tab, i) => (
                <li role="presentation">
                    <a
                        href={`#${tab.id}`}
                        class={i === 0 ? 'active' : ''}
                        role="tab"
                        id={`${tab.id}-tab`}
                        aria-selected={i === 0 ? 'true' : 'false'}
                        aria-controls={tab.id}
                        tabindex={i === 0 ? '0' : '-1'}
                        data-cdx-toggle="tab"
                    >
                        {t(tab.label)}
                    </a>
                </li>
            ))}
        </ul>
    ) as string;

/** Panels MUST be wrapped in a single parent element — `hash-router.ts`
 * `activatePanel()` finds the tab bar via `panel.parentElement.previousElementSibling`. */
const TabPanels = (tabs: MiscTab[]): string =>
    (
        <div>
            {tabs.map((tab, i) => (
                <div
                    class={`cdx-tab-panel${i === 0 ? ' active' : ''}`}
                    id={tab.id}
                    role="tabpanel"
                    aria-labelledby={`${tab.id}-tab`}
                >
                    {tab.content}
                </div>
            ))}
        </div>
    ) as string;

//  Page entry

/** Link to the Utilities landing page, optionally to one group. */
const utilitiesHref = (depth: number, anchor?: string): string =>
    hrefText(hrefFor({ type: 'root', page: 'utilities' }, depth, anchor));

export const renderMiscDetailPage = (props: MiscDetailProps): string => {
    const meta = META[props.kind];
    const item = props.item;
    const tabs = buildTabs(props);
    const searchMeta = pagefindMetaBlock({
        kind: props.kind,
        category: item.category,
        description: item.description
    });
    const searchFilters = pagefindFilterBlock({
        kind: props.kind,
        lib: deriveLibFromBucket(item.category || item.file),
        bucket: item.category,
        docsKind: item.docsKind === 'primary' ? 'primary' : 'reference',
        wcag: item.wcagLevel
    });
    return (
        <>
            <div class="cdx-entity-hero" style={`--cdx-hero-color: ${meta.color}`}>
                {searchMeta}
                {searchFilters}
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {meta.icon()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        {(() => {
                            const segments = resolveBucketSegments(item);
                            return segments
                                ? segments.map(seg => <li>{seg}</li>)
                                : [
                                      (
                                          <li>
                                              <a href={utilitiesHref(props.depth ?? 1)}>
                                                  {t('utilities')}
                                              </a>
                                          </li>
                                      ) as string,
                                      (
                                          <li>
                                              <a
                                                  href={utilitiesHref(
                                                      props.depth ?? 1,
                                                      utilityGroupAnchor(props.kind)
                                                  )}
                                              >
                                                  {t(meta.breadcrumb)}
                                              </a>
                                          </li>
                                      ) as string
                                  ].join('');
                        })()}
                        <li aria-current="page">{item.name}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span class={item.deprecated ? 'cdx-member-name--deprecated' : ''}>
                        {item.name}
                    </span>
                </h1>
                <div class="cdx-entity-hero-badges">
                    <span class={`cdx-badge ${meta.badge}`}>{meta.label}</span>
                    {item.category && (
                        <span class="cdx-badge cdx-badge--outline">{item.category}</span>
                    )}
                    {item.deprecated && (
                        <span class="cdx-badge cdx-badge--deprecated">{t('deprecated')}</span>
                    )}
                    {item.beta && <span class="cdx-badge cdx-badge--beta">Beta</span>}
                    {item.since && <span class="cdx-badge cdx-badge--since">v{item.since}</span>}
                    {item.signal && <span class="cdx-badge cdx-badge--signal">Signal</span>}
                    {WcagBadge({ wcagLevel: item.wcagLevel })}
                </div>
                {props.contextLine && <p class="cdx-entity-hero-context">{props.contextLine}</p>}
                {item.deprecated && item.deprecationMessage && (
                    <p class="cdx-entity-hero-context">{item.deprecationMessage}</p>
                )}
                {item.file && (
                    <p class="cdx-entity-hero-file" title="Source file">
                        {IconFile()}
                        <span>{item.file}</span>
                    </p>
                )}
            </div>
            {TabBar(tabs)}
            {TabPanels(tabs)}
        </>
    ) as string;
};

export const MiscFunctionPage = (data: any): string =>
    renderMiscDetailPage({
        kind: 'function',
        item: data.function,
        depth: data.depth
    });

export const MiscVariablePage = (data: any): string =>
    renderMiscDetailPage({
        kind: 'variable',
        item: data.variable,
        depth: data.depth
    });

export const MiscTypealiasPage = (data: any): string =>
    renderMiscDetailPage({
        kind: 'typealias',
        item: data.typealias,
        depth: data.depth
    });

export const MiscEnumerationPage = (data: any): string =>
    renderMiscDetailPage({
        kind: 'enumeration',
        item: data.enumeration,
        depth: data.depth
    });

/** Whether an engine object is a function or constant (not a class-like entity). */
export const isMiscShaped = (item: unknown): boolean =>
    (item as { ctype?: unknown } | undefined)?.ctype === 'miscellaneous';

/** The page of a function or constant that is a guard, interceptor or resolver. */
export const renderFunctionalPage = (item: any, depth: number | undefined): string =>
    renderMiscDetailPage({
        kind: item.subtype === 'variable' ? 'variable' : 'function',
        item,
        depth,
        contextLine: `Functional ${item.functionalKind}`
    });
