import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import AngularApiUtil from '../../utils/angular-api.util';
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
import { BlockTheming } from '../blocks/BlockTheming';
import { ContentSlotsSection } from '../blocks/ContentSlots';
import { DependenciesSection } from '../blocks/DependenciesSection';
import { ExternalLinks } from '../blocks/ExternalLinks';
import { DEPENDENCY_LEGEND_ITEMS, GraphLegend, GraphZoomControls } from '../blocks/GraphControls';
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
import { AiGeneratedBadge } from '../components/AiGeneratedBadge';
import { EmptyState } from '../components/EmptyState';
import {
    EmptyIconBook,
    EmptyIconDocument,
    EmptyIconHtml,
    EmptyIconPalette,
    EmptyIconTree
} from '../components/EmptyStateIcons';
import { IconComponent, IconFile } from '../components/Icons';
import { PrimaryBadge } from '../components/PrimaryBadge';
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
    resolveBucketSegments,
    t
} from '../helpers';

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

const ComponentMetadata = (c: any): string => {
    if (!isInfoSection('metadata')) {
        return '';
    }

    const rows: string[] = [];
    const codeField = (label: string, value: unknown) => {
        if (value != null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
            rows.push(MetadataCodeRow(label, String(value)));
        }
    };

    // Scalar source-of-truth values — kept in the table. Boolean/enum traits
    // (standalone, changeDetection, encapsulation, preserveWhitespaces) ALSO
    // ship as hero badges for visual emphasis, but the underlying decorator
    // option is restored to the metadata table for compodoc-line compatibility
    // (downstream consumers grep these labels in CI / migration scripts).
    codeField('selector', c.selector);
    codeField('exportAs', c.exportAs);
    codeField('animations', c.animations);
    codeField('changeDetection', c.changeDetection);
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
    rows.push(MetadataChipsRow('extends', (c.extends as string[]) ?? []));
    rows.push(MetadataChipsRow('implements', (c.implements as string[]) ?? []));
    rows.push(MetadataChipsRow('imports', c.imports ?? []));
    rows.push(MetadataChipsRow('entryComponents', c.entryComponents ?? []));

    // Host directives stay in core metadata (they're component config, not runtime host bindings)
    if (c.hostDirectives?.length > 0) {
        rows.push(MetadataHostDirectivesRow(c.hostDirectives));
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
                depth: depth ?? 0
            })}

            {isInfoSection('examples') &&
                c.jsdoctags &&
                JsdocExamplesBlock({ tags: c.jsdoctags, variant: 'code', level: 'section' })}

            {isInfoSection('metadata') && ComponentMetadata(c)}

            {isInfoSection('metadata') && ContentSlotsSection(c.slots)}

            {isInfoSection('host') && c.hostStructured?.length > 0 && HostSection(c.hostStructured)}

            {isInfoSection('providers') &&
                c.providers?.length > 0 &&
                ProvidersSection({ title: t('providers'), entries: c.providers })}

            {isInfoSection('viewProviders') &&
                c.viewProviders?.length > 0 &&
                ProvidersSection({ title: t('view-providers'), entries: c.viewProviders })}

            {isInfoSection('dependencies') &&
                (() => {
                    const injectProps = (c.propertiesClass ?? []).filter(
                        (p: any) => p.signalKind === 'inject'
                    );
                    const ctorArgs = c.constructorObj?.args ?? [];
                    return injectProps.length > 0 || ctorArgs.length > 0
                        ? DependenciesSection({
                              injectProps,
                              constructorArgs: ctorArgs,
                              constructorDescription: c.constructorObj?.description,
                              depth: depth ?? 0
                          })
                        : '';
                })()}

            {isInfoSection('relationships') &&
                data.relationships &&
                BlockRelationshipGraph({
                    incoming: data.relationships.incoming,
                    outgoing: data.relationships.outgoing,
                    entityName: c.name
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

const DECLARABLE_KINDS = new Set(['component', 'directive', 'pipe']);

/**
 * Graph node for one standalone import: a documented component, directive or
 * pipe links to its page, an Angular API symbol to angular.dev, anything else
 * stays unlinked.
 */
const importGraphNode = (
    name: string,
    base: string
): { name: string; type: string; url: string | undefined } => {
    const entry = Configuration.mainData.entityIndex?.[name];
    if (entry && DECLARABLE_KINDS.has(entry.kind)) {
        return { name, type: entry.kind, url: `${base}${entry.href}` };
    }
    const api = AngularApiUtil.findApi(name).data;
    return { name, type: 'external', url: api ? `https://angular.dev/${api.path}` : undefined };
};

export const ComponentPage = (data: any): string => {
    const c = data.component;
    const depth = data.depth;
    const base = relativeUrl(depth);
    const navTabs = data.navTabs;
    const hasStandaloneImports =
        c.standalone && c.imports?.length > 0 && !Configuration.mainData.disableDependenciesTab;

    const componentDepGraph = hasStandaloneImports
        ? (() => {
              const names: string[] = c.imports.map((imp: any) =>
                  typeof imp === 'string' ? imp : imp.name
              );
              const nodes = [
                  { name: c.name, type: 'component', url: undefined },
                  ...names.map(name => importGraphNode(name, base))
              ];
              const edges = names.map(target => ({ source: c.name, target }));
              return { nodes, edges };
          })()
        : null;

    const searchMeta = pagefindMetaBlock({
        kind: 'component',
        category: c.category,
        description: c.description
    });
    const searchFilters = pagefindFilterBlock({
        kind: 'component',
        lib: deriveLibFromBucket(c.category || c.file),
        bucket: c.category,
        docsKind: c.docsKind === 'primary' ? 'primary' : 'reference',
        wcag: c.wcagLevel
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
                        {(() => {
                            const segments = resolveBucketSegments(c);
                            return segments
                                ? segments.map(seg => <li>{seg}</li>)
                                : ((<li>{t('components')}</li>) as string);
                        })()}
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
                    {PrimaryBadge({ docsKind: c.docsKind })}
                    {c.standalone && Configuration.mainData.hasNgModules ? (
                        <span class="cdx-badge cdx-badge--standalone">Standalone</span>
                    ) : (
                        ''
                    )}
                    {c.zoneless ? <span class="cdx-badge cdx-badge--zoneless">Zoneless</span> : ''}
                    {(() => {
                        const cd = String(c.changeDetection ?? '');
                        return cd.includes('OnPush') ? (
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
                </div>
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
                {hasStandaloneImports && (
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

                {isTabEnabled(navTabs, 'theming') &&
                    (c.themeTokens?.length > 0 || c.themeOverview) && (
                        <div
                            class={`cdx-tab-panel${isInitialTab(navTabs, 'theming') ? ' active' : ''}`}
                            id="theming"
                            role="tabpanel"
                            aria-labelledby="theming-tab"
                        >
                            {BlockTheming({
                                tokens: c.themeTokens,
                                styleSources: c.themeStyleSources,
                                overview: c.themeOverview
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

                {hasStandaloneImports && (
                    <div
                        class={`cdx-tab-panel`}
                        id="dependencies"
                        role="tabpanel"
                        aria-labelledby="dependencies-tab"
                    >
                        <ul class="sr-only" aria-label="Component dependency list">
                            {c.imports.map((imp: any) => (
                                <li>
                                    {c.name} imports {typeof imp === 'string' ? imp : imp.name}
                                </li>
                            ))}
                        </ul>
                        <div class="cdx-graph-container">
                            <div class="cdx-graph-viewport">
                                <div id="dependency-graph-container"></div>
                            </div>
                            {GraphZoomControls({ prefix: 'dep-' })}
                        </div>
                        {GraphLegend({ items: DEPENDENCY_LEGEND_ITEMS })}
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
    ${componentDepGraph ? `window.DEPENDENCY_GRAPH = ${JSON.stringify(componentDepGraph)};` : ''}
`}</script>
        </>
    ) as string;
};
