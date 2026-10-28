import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { type GraphFile, neighbourhood } from '../../app/graph';
import { entryInFile } from '../../app/links/symbol-table';
import { graphHeight } from '../../client/graph-layout';
import { BlockAccessors } from '../blocks/BlockAccessors';
import { BlockDerivedState } from '../blocks/BlockDerivedState';
import { BlockHostBindings } from '../blocks/BlockHostBindings';
import { BlockHostListeners } from '../blocks/BlockHostListeners';
import { BlockIndex } from '../blocks/BlockIndex';
import { BlockInput } from '../blocks/BlockInput';
import { BlockMethod } from '../blocks/BlockMethod';
import { BlockOutput } from '../blocks/BlockOutput';
import { BlockProperty } from '../blocks/BlockProperty';
import { BlockRelationshipGraph } from '../blocks/BlockRelationshipGraph';
import { BlockRoutedAt } from '../blocks/BlockRoutedAt';
import { BlockTheming } from '../blocks/BlockTheming';
import { ContentSlotsSection } from '../blocks/ContentSlots';
import { DependenciesSection } from '../blocks/DependenciesSection';
import { ExternalLinks } from '../blocks/ExternalLinks';
import {
    GraphKindLegend,
    GraphLegend,
    GraphRelationLegend,
    GraphRelationList,
    GraphZoomControls
} from '../blocks/GraphControls';
import { HostSection } from '../blocks/HostSection';
import { ImportStatement } from '../blocks/ImportStatement';
import { JsdocExamplesBlock } from '../blocks/JsdocExamplesBlock';
import {
    MetadataChipsRow,
    MetadataCodeRow,
    MetadataHostDirectivesRow,
    MetadataSection
} from '../blocks/MetadataRow';
import { PlaygroundContent } from '../blocks/PlaygroundContent';
import { ProvidersSection } from '../blocks/ProvidersSection';
import { RelatedSection } from '../blocks/RelatedSection';
import { RouteChip } from '../blocks/RouteChip';
import { SourceViewer } from '../blocks/SourceViewer';
import { AiGeneratedBadge, AiGeneratedNote } from '../components/AiGeneratedBadge';
import { AxisBadges, entityAxes } from '../components/AxisBadges';
import { EmptyState } from '../components/EmptyState';
import {
    EmptyIconBook,
    EmptyIconDocument,
    EmptyIconHtml,
    EmptyIconPalette,
    EmptyIconTree
} from '../components/EmptyStateIcons';
import { entityFeature, FeatureCrumbs } from '../components/FeatureCrumbs';
import { IconComponent, IconFile } from '../components/Icons';
import { WcagBadge } from '../components/WcagBadge';
import {
    deriveLibFromBucket,
    extractReadmeHeadings,
    isApiSection,
    isInfoSection,
    isInitialTab,
    isReadmeEmpty,
    isTabEnabled,
    pagefindFilterBlock,
    pagefindMetaBlock,
    parseDescription,
    relativeUrl,
    t
} from '../helpers';
import { routedAt } from '../helpers/routed-at';
import { hasTheming, themingFor } from '../helpers/theming';

const escapeSimpleQuote = (text: string): string => {
    if (!text) {
        return '';
    }
    return text.replaceAll("'", String.raw`\'`).replaceAll(/(\r\n|\n|\r)/gm, '');
};

const breakComma = (text: string): string => {
    const escaped = String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll(/"/g, '&quot;');
    return escaped.replaceAll(',', ',<br>');
};

/**
 * From Angular 22 on a component without `changeDetection` runs as OnPush.
 * Needs the project's Angular major; unknown or older majors show nothing.
 */
const isOnPushByDefault = (c: any): boolean =>
    (c.changeDetection == null || c.changeDetection === '') &&
    (Configuration.mainData.angularMajor ?? 0) >= 22;

const ComponentMetadata = (c: any, depth: number): string => {
    if (!isInfoSection('metadata')) {
        return '';
    }

    const rows: string[] = [];
    const codeField = (label: string, value: unknown) => {
        if (value != null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
            rows.push(MetadataCodeRow(label, String(value)));
        }
    };

    // Scalar source-of-truth values - kept in the table. Boolean/enum traits
    // (standalone, changeDetection, encapsulation, preserveWhitespaces) ALSO
    // ship as hero badges for visual emphasis, but the underlying decorator
    // option is restored to the metadata table for compodoc-line compatibility
    // (downstream consumers grep these labels in CI / migration scripts).
    codeField('selector', c.selector);
    codeField('exportAs', c.exportAs);
    codeField('animations', c.animations);
    codeField('changeDetection', isOnPushByDefault(c) ? 'OnPush (default)' : c.changeDetection);
    codeField('encapsulation', c.encapsulation);
    codeField('preserveWhitespaces', c.preserveWhitespaces);
    codeField('interpolation', c.interpolation);
    codeField('moduleId', c.moduleId);
    codeField('queries', c.queries);
    codeField('templateUrl', c.templateUrl);
    if (c.styleUrls?.length > 0) {
        codeField('styleUrls', breakComma(c.styleUrls));
    }
    codeField('tag', c.tag);
    codeField('styleUrl', c.styleUrl);
    codeField('shadow', c.shadow);
    codeField('scoped', c.scoped);
    codeField('assetsDir', c.assetsDir);
    codeField('assetsDirs', c.assetsDirs);

    // Array values → chip rows (implements before imports to match design)
    rows.push(MetadataChipsRow('extends', (c.extends as string[]) ?? [], depth));
    rows.push(MetadataChipsRow('implements', (c.implements as string[]) ?? [], depth));
    rows.push(MetadataChipsRow('imports', c.imports ?? [], depth));

    // Host directives stay in core metadata (they're component config, not runtime host bindings)
    if (c.hostDirectives?.length > 0) {
        rows.push(MetadataHostDirectivesRow(c.hostDirectives, depth));
    }

    return MetadataSection({ rows });
};

/**
 * Overview-style content rendered on the **Info** tab: description, examples,
 * external links, decorator metadata, host literal, content slots, relationships.
 * Member surface (inputs/outputs/methods/...) lives in {@link ApiContent}.
 */
const hasComponentInfoContent = (data: any): boolean => {
    const c = data.component;
    return !!(
        c.deprecated ||
        c.route ||
        routedAt(data, 'component', c, data.depth) !== undefined ||
        c.description ||
        c.jsdoctags?.length ||
        c.selector ||
        c.constructorObj ||
        c.extends?.length ||
        c.implements?.length ||
        c.providers?.length ||
        c.viewProviders?.length ||
        c.hostDirectives?.length ||
        c.hostStructured?.length ||
        c.propertiesClass?.some((p: any) => p.signalKind === 'inject') ||
        c.slots?.length ||
        c.relatedTo?.length ||
        data.relationships?.incoming?.length ||
        data.relationships?.outgoing?.length
    );
};

const InfoContent = (data: any): string => {
    const c = data.component;
    const depth = data.depth;

    if (!hasComponentInfoContent(data)) {
        return EmptyState({
            icon: EmptyIconDocument(),
            title: t('no-overview'),
            description: t('no-overview-desc'),
            variant: 'full'
        }) as string;
    }

    return (
        <>
            {isInfoSection('import') && ImportStatement({ name: c.name, file: c.file })}

            {isInfoSection('deprecated') && c.deprecated && (
                <div class="cdx-deprecation-banner" role="alert">
                    <strong>{t('deprecated')}</strong>
                    <span>{c.deprecationMessage}</span>
                </div>
            )}

            {RouteChip({ route: c.route })}

            {BlockRoutedAt(routedAt(data, 'component', c, depth))}

            {isInfoSection('description') && c.description && (
                <section class="cdx-content-section">
                    <h3 class="cdx-section-heading" id="description">
                        {t('description')}
                        <a class="cdx-member-permalink" href="#description">
                            #
                        </a>
                    </h3>
                    <div class="cdx-prose">{parseDescription(c.description, depth)}</div>
                </section>
            )}

            {RelatedSection({
                entityName: c.name,
                relatedTo: c.relatedTo,
                depth
            })}

            {isInfoSection('examples') &&
                c.jsdoctags &&
                JsdocExamplesBlock({ tags: c.jsdoctags, variant: 'code', level: 'section' })}

            {isInfoSection('metadata') && ComponentMetadata(c, depth)}

            {isInfoSection('metadata') && ContentSlotsSection(c.slots, depth)}

            {isInfoSection('host') && c.hostStructured?.length > 0 && HostSection(c.hostStructured)}

            {isInfoSection('providers') &&
                c.providers?.length > 0 &&
                ProvidersSection({ title: t('providers'), entries: c.providers, depth })}

            {isInfoSection('viewProviders') &&
                c.viewProviders?.length > 0 &&
                ProvidersSection({
                    title: t('view-providers'),
                    entries: c.viewProviders,
                    depth
                })}

            {isInfoSection('dependencies') &&
                (() => {
                    const injectProps = (c.propertiesClass ?? []).filter(
                        (p: any) => p.signalKind === 'inject'
                    );
                    return injectProps.length > 0
                        ? DependenciesSection({
                              injectProps,
                              constructorArgs: [],
                              depth
                          })
                        : '';
                })()}

            {isInfoSection('relationships') &&
                data.relationships &&
                BlockRelationshipGraph({
                    incoming: data.relationships.incoming,
                    outgoing: data.relationships.outgoing,
                    entityName: c.name,
                    depth
                })}
        </>
    ) as string;
};

/**
 * Member surface rendered on the **API** tab: index, constructor, inputs,
 * outputs, host bindings/listeners, methods, properties, accessors.
 */
const ApiContent = (data: any): string => {
    const c = data.component;
    const depth = data.depth;
    const allProps: any[] = c.propertiesClass ?? [];
    const allSignalProps: any[] = [
        ...(c.inputsClass ?? []),
        ...(c.outputsClass ?? []),
        ...allProps
    ];
    const derivedProps = allProps.filter(
        (p: any) => p.signalKind === 'computed' || p.signalKind === 'linked-signal'
    );
    const showEffects = Configuration.mainData.showEffects === true;
    const effectProps = allProps.filter((p: any) => p.signalKind === 'effect');
    const regularProps = allProps.filter(
        (p: any) =>
            p.signalKind !== 'computed' &&
            p.signalKind !== 'linked-signal' &&
            p.signalKind !== 'inject' &&
            (showEffects ? p.signalKind !== 'effect' : true)
    );

    return (
        <>
            {isApiSection('index') &&
                BlockIndex({
                    properties: regularProps,
                    methods: c.methodsClass,
                    inputs: c.inputsClass,
                    outputs: c.outputsClass,
                    derivedState: derivedProps,
                    effects: showEffects ? effectProps : [],
                    hostBindings: c.hostBindings,
                    hostListeners: c.hostListeners,
                    accessors: c.accessors
                })}

            {isApiSection('inputs') &&
                c.inputsClass?.length > 0 &&
                BlockInput({ element: c, file: c.file, depth, navTabs: data.navTabs })}
            {isApiSection('outputs') &&
                c.outputsClass?.length > 0 &&
                BlockOutput({ element: c, file: c.file, depth, navTabs: data.navTabs })}
            {isApiSection('derivedState') &&
                derivedProps.length > 0 &&
                BlockDerivedState({
                    properties: derivedProps,
                    allSignalProps,
                    file: c.file,
                    depth,
                    navTabs: data.navTabs
                })}
            {isApiSection('properties') &&
                regularProps.length > 0 &&
                BlockProperty({
                    properties: regularProps,
                    file: c.file,
                    depth,
                    navTabs: data.navTabs
                })}
            {isApiSection('effects') &&
                showEffects &&
                effectProps.length > 0 &&
                BlockProperty({
                    properties: effectProps,
                    file: c.file,
                    depth,
                    navTabs: data.navTabs,
                    title: t('effects'),
                    id: 'effects'
                })}
            {isApiSection('methods') &&
                c.methodsClass?.length > 0 &&
                BlockMethod({
                    methods: c.methodsClass,
                    file: c.file,
                    depth,
                    navTabs: data.navTabs
                })}
            {isApiSection('accessors') &&
                c.accessors &&
                Object.keys(c.accessors).length > 0 &&
                BlockAccessors({
                    accessors: c.accessors,
                    file: c.file,
                    depth,
                    navTabs: data.navTabs
                })}
            {isApiSection('hostBindings') &&
                c.hostBindings?.length > 0 &&
                BlockHostBindings({ bindings: c.hostBindings })}
            {isApiSection('hostListeners') &&
                c.hostListeners?.length > 0 &&
                BlockHostListeners({ listeners: c.hostListeners })}
        </>
    ) as string;
};

/**
 * The component's direct neighbourhood in the project graph: every relation
 * in both directions, one hop. Undefined without relations or with the
 * Dependencies tab off.
 */
const componentNeighbourhood = (c: { name: string; file?: string }): GraphFile | undefined => {
    const { symbols, graph, disableDependenciesTab } = Configuration.mainData;
    const entry = symbols && entryInFile(symbols, 'component', c.name, c.file);
    return disableDependenciesTab || !entry || !graph
        ? undefined
        : neighbourhood(graph.model, entry.id);
};

/** The graph data as a script literal; `<` escaped so no name can end the script. */
const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c');

export const ComponentPage = (data: any): string => {
    const c = data.component;
    const depth = data.depth;
    const base = relativeUrl(depth);
    const navTabs = data.navTabs;
    const theming = themingFor(c, 'component', Configuration.mainData, depth);
    const localGraph = componentNeighbourhood(c);

    const feature = entityFeature('component', c);
    const axes = entityAxes('component', c);
    const searchMeta = pagefindMetaBlock({
        kind: 'component',
        feature: feature?.feature.label,
        description: c.description
    });
    const searchFilters = pagefindFilterBlock({
        kind: 'component',
        lib: deriveLibFromBucket(c.file),
        feature: feature?.feature.label,
        entryPoint: feature?.feature.entryPoint,
        wcag: c.wcagLevel,
        axes
    });

    return (
        <>
            <div
                class="cdx-entity-hero"
                style="--cdx-hero-color: var(--color-cdx-entity-component)"
            >
                {searchMeta}
                {searchFilters}
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconComponent()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        {FeatureCrumbs(feature, depth) ?? ((<li>{t('components')}</li>) as string)}
                        <li aria-current="page">{c.name}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span class={c.deprecated ? 'cdx-member-name--deprecated' : ''}>{c.name}</span>
                </h1>
                {c.taggedSelector ? (
                    <p class="cdx-entity-hero-selector">
                        <code>{c.taggedSelector}</code>
                    </p>
                ) : (
                    ''
                )}
                <div class="cdx-entity-hero-badges">
                    <span class="cdx-badge cdx-badge--entity-component">Component</span>
                    {c.zoneless ? <span class="cdx-badge cdx-badge--zoneless">Zoneless</span> : ''}
                    {(() => {
                        const cd = String(c.changeDetection ?? '');
                        return cd.includes('OnPush') || isOnPushByDefault(c) ? (
                            <span class="cdx-badge cdx-badge--trait">OnPush</span>
                        ) : (
                            ''
                        );
                    })()}
                    {(() => {
                        const enc = Array.isArray(c.encapsulation)
                            ? c.encapsulation.join(' ')
                            : String(c.encapsulation ?? '');
                        if (enc.includes('ShadowDom')) {
                            return <span class="cdx-badge cdx-badge--trait">Shadow DOM</span>;
                        }
                        if (enc.includes('None')) {
                            return <span class="cdx-badge cdx-badge--trait">No encapsulation</span>;
                        }
                        return '';
                    })()}
                    {c.preserveWhitespaces ? (
                        <span class="cdx-badge cdx-badge--trait">Preserve whitespace</span>
                    ) : (
                        ''
                    )}
                    {c.beta ? <span class="cdx-badge cdx-badge--beta">Beta</span> : ''}
                    {c.since ? <span class="cdx-badge cdx-badge--since">v{c.since}</span> : ''}
                    {c.breaking ? (
                        <span class="cdx-badge cdx-badge--breaking">Breaking {c.breaking}</span>
                    ) : (
                        ''
                    )}
                    {AiGeneratedBadge({ aiGenerated: c.aiGenerated })}
                    {WcagBadge({ wcagLevel: c.wcagLevel })}
                    {AxisBadges({ axes })}
                </div>
                {AiGeneratedNote({ aiGenerated: c.aiGenerated, class: 'cdx-entity-hero-ai-note' })}
                {!data.disableFilePath && c.file && (
                    <p class="cdx-entity-hero-file" title="Source file">
                        {IconFile()}
                        <span>{c.file}</span>
                    </p>
                )}
                {ExternalLinks({
                    storybookUrl: c.storybookUrl,
                    figmaUrl: c.figmaUrl,
                    stackblitzUrl: c.stackblitzUrl,
                    githubUrl: c.githubUrl,
                    docsUrl: c.docsUrl
                })}
            </div>

            <ul class="cdx-tab-bar">
                {navTabs.map((tab: any, i: number) => (
                    <li role="presentation">
                        <a
                            href={tab.href}
                            class={i === 0 ? 'active' : ''}
                            role="tab"
                            id={`${tab.id}-tab`}
                            aria-selected={i === 0 ? 'true' : 'false'}
                            aria-controls={tab.id}
                            tabindex={i === 0 ? '0' : '-1'}
                            data-cdx-toggle="tab"
                            data-link={tab['data-link']}
                        >
                            {t(tab.label)}
                        </a>
                    </li>
                ))}
                {localGraph && (
                    <li role="presentation">
                        <a
                            href="#dependencies"
                            role="tab"
                            id="dependencies-tab"
                            aria-selected="false"
                            aria-controls="dependencies"
                            tabindex="-1"
                            data-cdx-toggle="tab"
                        >
                            {t('dependencies')}
                        </a>
                    </li>
                )}
            </ul>

            <div>
                {isTabEnabled(navTabs, 'info') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'info') ? ' active' : ''}`}
                        id="info"
                        role="tabpanel"
                        aria-labelledby="info-tab"
                    >
                        {InfoContent(data)}
                    </div>
                )}

                {isTabEnabled(navTabs, 'api') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'api') ? ' active' : ''}`}
                        id="api"
                        role="tabpanel"
                        aria-labelledby="api-tab"
                    >
                        {ApiContent(data)}
                    </div>
                )}

                {isTabEnabled(navTabs, 'readme') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'readme') ? ' active' : ''}`}
                        id="readme"
                        role="tabpanel"
                        aria-labelledby="readme-tab"
                    >
                        {isReadmeEmpty(c.readme) ? (
                            <>
                                {extractReadmeHeadings(c.readme)}
                                {EmptyState({
                                    icon: EmptyIconBook(),
                                    title: t('empty-readme-title'),
                                    description: t('empty-readme-desc'),
                                    variant: 'full'
                                })}
                            </>
                        ) : (
                            <div class="cdx-readme">{c.readme}</div>
                        )}
                    </div>
                )}

                {isTabEnabled(navTabs, 'source') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'source') ? ' active' : ''} cdx-tab-panel--source`}
                        id="source"
                        role="tabpanel"
                        aria-labelledby="source-tab"
                    >
                        {SourceViewer({
                            filePath: c.file,
                            sourceCode: c.sourceCode ?? '',
                            lang: 'typescript'
                        })}
                    </div>
                )}

                {isTabEnabled(navTabs, 'templateData') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'templateData') ? ' active' : ''}`}
                        id="templateData"
                        role="tabpanel"
                        aria-labelledby="templateData-tab"
                    >
                        {c.templateData?.trim()
                            ? SourceViewer({
                                  filePath: c.templateUrl?.[0],
                                  sourceCode: c.templateData,
                                  lang: 'html'
                              })
                            : EmptyState({
                                  icon: EmptyIconHtml(),
                                  title: t('empty-template-title'),
                                  description: t('empty-template-desc'),
                                  variant: 'full'
                              })}
                    </div>
                )}

                {isTabEnabled(navTabs, 'styleData') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'styleData') ? ' active' : ''}`}
                        id="styleData"
                        role="tabpanel"
                        aria-labelledby="styleData-tab"
                    >
                        {c.styleUrlsData?.length > 0
                            ? c.styleUrlsData.map((s: any) =>
                                  SourceViewer({
                                      filePath: s.styleUrl,
                                      sourceCode: s.data,
                                      lang: 'scss'
                                  })
                              )
                            : ''}
                        {c.stylesData &&
                            c.stylesData !== '' &&
                            SourceViewer({
                                sourceCode: c.stylesData,
                                lang: 'scss',
                                label: 'Inline Styles'
                            })}
                        {!(c.styleUrlsData?.length > 0) &&
                            !(c.stylesData && c.stylesData !== '') &&
                            EmptyState({
                                icon: EmptyIconPalette(),
                                title: t('empty-styles-title'),
                                description: t('empty-styles-desc'),
                                variant: 'full'
                            })}
                    </div>
                )}

                {isTabEnabled(navTabs, 'theming') && hasTheming(theming) && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'theming') ? ' active' : ''}`}
                        id="theming"
                        role="tabpanel"
                        aria-labelledby="theming-tab"
                    >
                        {BlockTheming({
                            tokens: [...theming.tokens],
                            styleSources: [...theming.sources],
                            overview: theming.overview,
                            mixins: theming.mixins,
                            linked: theming.linked,
                            depth
                        })}
                    </div>
                )}

                {isTabEnabled(navTabs, 'tree') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'tree') ? ' active' : ''}`}
                        id="tree"
                        role="tabpanel"
                        aria-labelledby="tree-tab"
                    >
                        <div id="tree-container">
                            {!(c.template || c.templateData) &&
                                EmptyState({
                                    icon: EmptyIconTree(),
                                    title: t('empty-dom-tree-title'),
                                    description: t('empty-dom-tree-desc'),
                                    variant: 'full'
                                })}
                        </div>
                        {GraphZoomControls({ prefix: 'tree-' })}
                        {GraphLegend({
                            items: [
                                {
                                    colorVar: 'var(--color-cdx-bg-elevated)',
                                    labelKey: 'html-element'
                                },
                                {
                                    colorVar: 'var(--color-cdx-entity-component)',
                                    labelKey: 'component'
                                },
                                {
                                    colorVar: 'var(--color-cdx-entity-directive)',
                                    labelKey: 'html-element-with-directive'
                                }
                            ]
                        })}
                    </div>
                )}

                {localGraph && (
                    <div
                        class={`cdx-tab-panel`}
                        id="dependencies"
                        role="tabpanel"
                        aria-labelledby="dependencies-tab"
                    >
                        {GraphRelationList({ model: localGraph })}
                        <div class="cdx-graph-container">
                            <div class="cdx-graph-viewport">
                                <div
                                    id="dependency-graph-container"
                                    data-cdx-graph-local=""
                                    data-cdx-root={base}
                                    data-cdx-label={t('graph-label')}
                                    style={`min-height: ${graphHeight(localGraph.nodes.length)}px`}
                                ></div>
                            </div>
                            {GraphZoomControls({ prefix: 'dep-' })}
                        </div>
                        {GraphKindLegend({ nodes: localGraph.nodes })}
                        {GraphRelationLegend({ edges: localGraph.edges })}
                    </div>
                )}

                {isTabEnabled(navTabs, 'playground') && c.playgrounds?.length > 0 && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'playground') ? ' active' : ''}`}
                        id="playground"
                        role="tabpanel"
                        aria-labelledby="playground-tab"
                    >
                        {(() => {
                            // Pick out this component's pre-resolved file
                            // bundles (keyed `${name}:${idx}` in mainData) and
                            // fold to a {idx → bundle} map for the block stack.
                            const all = data.playgroundFiles ?? {};
                            const fileBundles: Record<number, unknown> = {};
                            for (let i = 0; i < c.playgrounds.length; i++) {
                                const bundle = all[`${c.name}:${i}`];
                                if (bundle) {
                                    fileBundles[i] = bundle;
                                }
                            }
                            return PlaygroundContent({
                                componentName: c.name,
                                componentFile: c.file,
                                componentSourceCode: c.sourceCode,
                                playgrounds: c.playgrounds,
                                resolve: data.playgroundResolver,
                                workspacePackage: data.workspacePackage,
                                extraDependencies: data.playgroundDependencies,
                                materialShell: data.playgroundMaterialShell,
                                depth: data.playgroundDepDepth,
                                maxFiles: data.playgroundFileCountCap,
                                fileCap: data.playgroundFileCap,
                                head: data.playgroundHead,
                                globalStyles: data.playgroundGlobalStyles,
                                vendorPackages: data.playgroundVendorPackages,
                                vendorCap: data.playgroundVendorCap,
                                fileBundles: fileBundles as never
                            });
                        })()}
                    </div>
                )}

                {isTabEnabled(navTabs, 'example') && c.exampleUrls && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(navTabs, 'example') ? ' active' : ''}`}
                        id="example"
                        role="tabpanel"
                        aria-labelledby="example-tab"
                    >
                        {c.exampleUrls.map((url: string) => (
                            <iframe class="cdx-example-container" src={url} title="Example preview">
                                <p>{t('no-iframes')}</p>
                            </iframe>
                        ))}
                    </div>
                )}
            </div>

            <script>{`
    window.COMPONENT_TEMPLATE = '<div>${escapeSimpleQuote(c.template || c.templateData)}</div>';
    window.COMPONENTS = [${(data.components ?? []).map((comp: any) => `{'name': '${comp.name}', 'selector': '${comp.selector}'}`).join(',')}];
    window.DIRECTIVES = [${(data.directives ?? []).map((dir: any) => `{'name': '${dir.name}', 'selector': '${dir.selector}'}`).join(',')}];
    window.ACTUAL_COMPONENT = {'name': '${data.name}'};
    ${localGraph ? `window.__CDX_LOCAL_GRAPH__ = ${scriptJson(localGraph)};` : ''}
`}</script>
        </>
    ) as string;
};
