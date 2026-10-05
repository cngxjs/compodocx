import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import type {
    ConsumerPackageJson,
    DepGraphResolver,
    FileRefBundle,
    VendorPackage
} from '../../app/engines/stackblitz';
import { BlockAccessors } from '../blocks/BlockAccessors';
import { BlockConstructor } from '../blocks/BlockConstructor';
import { BlockDerivedState } from '../blocks/BlockDerivedState';
import { BlockHostBindings } from '../blocks/BlockHostBindings';
import { BlockHostListeners } from '../blocks/BlockHostListeners';
import { BlockIndex } from '../blocks/BlockIndex';
import { BlockIndexSignatures } from '../blocks/BlockIndexSignatures';
import { BlockInput } from '../blocks/BlockInput';
import { BlockMethod } from '../blocks/BlockMethod';
import { BlockOutput } from '../blocks/BlockOutput';
import { BlockProperty } from '../blocks/BlockProperty';
import { BlockRelationshipGraph } from '../blocks/BlockRelationshipGraph';
import { DependenciesSection } from '../blocks/DependenciesSection';
import { EntityTabs } from '../blocks/EntityTabs';
import { ExternalLinks } from '../blocks/ExternalLinks';
import { HostSection } from '../blocks/HostSection';
import { ImportStatement } from '../blocks/ImportStatement';
import { JsdocExamplesBlock } from '../blocks/JsdocExamplesBlock';
import { PlaygroundContent } from '../blocks/PlaygroundContent';
import { ProvidersSection } from '../blocks/ProvidersSection';
import { ReferencedBySection } from '../blocks/ReferencedBySection';
import { RelatedSection } from '../blocks/RelatedSection';
import { RouteChip } from '../blocks/RouteChip';
import { AiGeneratedBadge } from '../components/AiGeneratedBadge';
import { EmptyState } from '../components/EmptyState';
import { EmptyIconDocument } from '../components/EmptyStateIcons';
import {
    IconClass,
    IconComponent,
    IconDirective,
    IconEntity,
    IconFile,
    IconGuard,
    IconInjectable,
    IconInterceptor,
    IconInterface,
    IconPipe
} from '../components/Icons';
import { PrimaryBadge } from '../components/PrimaryBadge';
import { WcagBadge } from '../components/WcagBadge';
import {
    deriveLibFromBucket,
    isApiSection,
    isInfoSection,
    isInitialTab,
    isTabEnabled,
    linkTypeHtml,
    pagefindFilterBlock,
    pagefindMetaBlock,
    parseDescription,
    resolveBucketSegments,
    t
} from '../helpers';
import type { ComponentPlaygroundBlock } from '../helpers/jsdoc';

/** Map entity key to CSS color variable, badge class, and watermark icon */
const entityMeta: Record<
    string,
    { color: string; badge: string; label: string; icon: () => string }
> = {
    component: {
        color: 'var(--color-cdx-entity-component)',
        badge: 'cdx-badge--entity-component',
        label: 'Component',
        icon: IconComponent
    },
    directive: {
        color: 'var(--color-cdx-entity-directive)',
        badge: 'cdx-badge--entity-directive',
        label: 'Directive',
        icon: IconDirective
    },
    pipe: {
        color: 'var(--color-cdx-entity-pipe)',
        badge: 'cdx-badge--entity-pipe',
        label: 'Pipe',
        icon: IconPipe
    },
    class: {
        color: 'var(--color-cdx-entity-class)',
        badge: 'cdx-badge--entity-class',
        label: 'Class',
        icon: IconClass
    },
    classe: {
        color: 'var(--color-cdx-entity-class)',
        badge: 'cdx-badge--entity-class',
        label: 'Class',
        icon: IconClass
    },
    interface: {
        color: 'var(--color-cdx-entity-interface)',
        badge: 'cdx-badge--entity-interface',
        label: 'Interface',
        icon: IconInterface
    },
    guard: {
        color: 'var(--color-cdx-entity-guard)',
        badge: 'cdx-badge--entity-guard',
        label: 'Guard',
        icon: IconGuard
    },
    interceptor: {
        color: 'var(--color-cdx-entity-interceptor)',
        badge: 'cdx-badge--entity-interceptor',
        label: 'Interceptor',
        icon: IconInterceptor
    },
    injectable: {
        color: 'var(--color-cdx-entity-service)',
        badge: 'cdx-badge--entity-injectable',
        label: 'Injectable',
        icon: IconInjectable
    },
    entity: {
        color: 'var(--color-cdx-entity-class)',
        badge: 'cdx-badge--entity-class',
        label: 'Entity',
        icon: IconEntity
    }
};

/**
 * Shared info-tab sections for class-like entities
 * (class, directive, injectable, guard, interceptor, pipe, entity, interface).
 */
export type EntityInfoProps = {
    readonly entity: any;
    readonly entityKey: string;
    readonly breadcrumbLabel: string;
    readonly depth: number;
    readonly navTabs: any[];
    readonly disableFilePath?: boolean;
    readonly metadataHtml?: string;
    readonly showExtends?: boolean;
    readonly showIndex?: boolean;
    readonly showConstructor?: boolean;
    readonly showInputs?: boolean;
    readonly showOutputs?: boolean;
    readonly showHostBindings?: boolean;
    readonly showHostListeners?: boolean;
    readonly showMethods?: boolean;
    readonly showProperties?: boolean;
    readonly showAccessors?: boolean;
    readonly showIndexSignatures?: boolean;
    readonly showTokenBadge?: boolean;
    readonly showJsdocBadges?: boolean;
    readonly contextLine?: string;
    readonly relationships?: {
        incoming: Array<{
            name: string;
            type: string;
            description?: string;
            subtype?: string;
        }>;
        outgoing: Array<{
            name: string;
            type: string;
            description?: string;
            subtype?: string;
        }>;
    };
    readonly playgrounds?: ComponentPlaygroundBlock[];
    readonly playgroundFiles?: Record<string, FileRefBundle>;
    readonly playgroundResolver?: DepGraphResolver;
    readonly workspacePackage?: ConsumerPackageJson;
    readonly playgroundDependencies?: Record<string, string>;
    readonly playgroundMaterialShell?: boolean;
    readonly playgroundDepDepth?: number;
    readonly playgroundFileCountCap?: number;
    readonly playgroundFileCap?: number;
    readonly playgroundHead?: string[];
    readonly playgroundGlobalStyles?: string;
    readonly playgroundVendorPackages?: Record<string, VendorPackage>;
    readonly playgroundVendorCap?: number;
};

const hasMembers = (e: any): boolean =>
    !!(
        e.constructorObj ||
        e.inputsClass?.length ||
        e.outputsClass?.length ||
        e.hostBindings?.length ||
        e.hostListeners?.length ||
        (e.methodsClass ?? e.methods)?.length ||
        (e.propertiesClass ?? e.properties)?.length ||
        e.indexSignatures?.length ||
        (e.accessors && Object.keys(e.accessors).length) ||
        e.description ||
        e.extends?.length ||
        e.implements?.length
    );

/** True when the Info tab has visible content (description, metadata, or relationships). */
const hasInfoContent = (e: any, props: EntityInfoProps): boolean =>
    !!(
        e.deprecated ||
        e.route ||
        e.description ||
        e.jsdoctags?.length ||
        props.metadataHtml ||
        e.constructorObj ||
        e.hostStructured?.length ||
        e.providers?.length ||
        e.viewProviders?.length ||
        (e.propertiesClass ?? e.properties ?? []).some((p: any) => p.signalKind === 'inject') ||
        e.extends?.length ||
        e.implements?.length ||
        e.relatedTo?.length ||
        props.relationships?.incoming?.length ||
        props.relationships?.outgoing?.length ||
        (props.entityKey === 'interface' && e.referencedBy?.length)
    );

/** Render extends/implements as metadata card rows for entities without decorator metadata */
const ExtendsMetadataCard = (e: any): string => {
    const hasExtends = e.extends?.length > 0;
    const hasImplements = e.implements?.length > 0;
    if (!hasExtends && !hasImplements) {
        return '';
    }

    return (
        <section class="cdx-content-section" data-compodoc="block-metadata">
            <h3 class="cdx-section-heading" id="metadata">
                {t('metadata')}
                <a class="cdx-member-permalink" href="#metadata">
                    #
                </a>
            </h3>
            <dl class="cdx-metadata-card">
                {hasExtends && (
                    <div class="cdx-metadata-row">
                        <dt class="cdx-metadata-label">extends</dt>
                        <dd class="cdx-metadata-value">
                            {(e.extends as string[]).map(ext => linkTypeHtml(ext)).join(' ')}
                        </dd>
                    </div>
                )}
                {hasImplements && (
                    <div class="cdx-metadata-row">
                        <dt class="cdx-metadata-label">implements</dt>
                        <dd class="cdx-metadata-value">
                            {(e.implements as string[]).map(impl => linkTypeHtml(impl)).join(' ')}
                        </dd>
                    </div>
                )}
            </dl>
        </section>
    ) as string;
};

/**
 * Overview-style content for class-like entities: description, examples,
 * external links, metadata, relationships. Lives on the **Info** tab.
 * Member surface (inputs/outputs/methods/...) lives in {@link ApiContent}.
 *
 * When the entity has no meaningful content at all, returns a page-level
 * empty state instead.
 */
const InfoContent = (props: EntityInfoProps): string => {
    const e = props.entity;

    if (!hasMembers(e)) {
        return EmptyState({
            icon: EmptyIconDocument(),
            title: t('empty-entity-title'),
            description: t('empty-entity-desc', {
                entityType: t(props.entityKey)
            }),
            variant: 'full'
        }) as string;
    }

    if (!hasInfoContent(e, props)) {
        return EmptyState({
            icon: EmptyIconDocument(),
            title: t('no-overview'),
            description: t('no-overview-desc'),
            variant: 'full'
        }) as string;
    }

    return (
        <>
            {/* Referenced-by backlinks (References-only — gated to interfaces in EntityPage,
                  rendered unconditionally on MiscDetailPage which is reference-kind by design) */}
            {props.entityKey === 'interface' &&
                ReferencedBySection({
                    entries: e.referencedBy,
                    depth: props.depth ?? 0
                })}

            {/* Import statement */}
            {isInfoSection('import') && ImportStatement({ name: e.name, file: e.file })}

            {/* Deprecation banner */}
            {isInfoSection('deprecated') && e.deprecated && (
                <div class="cdx-deprecation-banner" role="alert">
                    <strong>{t('deprecated')}</strong>
                    <span>{e.deprecationMessage}</span>
                </div>
            )}

            {/* Route chip (above description) */}
            {RouteChip({ route: e.route })}

            {/* Description */}
            {isInfoSection('description') && e.description && (
                <section class="cdx-content-section">
                    <h3 class="cdx-section-heading" id="description">
                        {t('description')}
                        <a class="cdx-member-permalink" href="#description">
                            #
                        </a>
                    </h3>
                    <div class="cdx-prose">{parseDescription(e.description, props.depth)}</div>
                </section>
            )}

            {/* Related (cross-links from @relatedTo) */}
            {RelatedSection({
                entityName: e.name,
                relatedTo: e.relatedTo,
                depth: props.depth ?? 0
            })}

            {/* Examples */}
            {isInfoSection('examples') &&
                e.jsdoctags &&
                JsdocExamplesBlock({
                    tags: e.jsdoctags,
                    variant: 'code',
                    level: 'section'
                })}

            {/* Metadata (from entity-specific page) or extends/implements card */}
            {isInfoSection('metadata') &&
                (props.metadataHtml
                    ? props.metadataHtml
                    : isInfoSection('extends') && props.showExtends !== false
                      ? ExtendsMetadataCard(e)
                      : '')}

            {/* Host section */}
            {isInfoSection('host') && e.hostStructured?.length > 0 && HostSection(e.hostStructured)}

            {/* Providers */}
            {isInfoSection('providers') &&
                e.providers?.length > 0 &&
                ProvidersSection({
                    title: t('providers'),
                    entries: e.providers
                })}

            {/* View Providers */}
            {isInfoSection('viewProviders') &&
                e.viewProviders?.length > 0 &&
                ProvidersSection({
                    title: t('view-providers'),
                    entries: e.viewProviders
                })}

            {/* Dependencies (inject() + constructor merged) */}
            {isInfoSection('dependencies') &&
                (() => {
                    const allProps = e.propertiesClass ?? e.properties ?? [];
                    const injectProps = allProps.filter((p: any) => p.signalKind === 'inject');
                    const ctorArgs = e.constructorObj?.args ?? [];
                    if (injectProps.length === 0 && ctorArgs.length === 0) {
                        // Constructor with no public deps but with explicit
                        // modifiers (e.g. `private constructor()`) still
                        // deserves a Constructor section so the modifier
                        // surfaces — fall back to BlockConstructor.
                        const ctorModifiers = e.constructorObj?.modifierKind ?? [];
                        if (e.constructorObj && ctorModifiers.length > 0) {
                            return BlockConstructor({
                                constructor: e.constructorObj,
                                file: e.file,
                                depth: props.depth ?? 0
                            });
                        }
                        return '';
                    }
                    return DependenciesSection({
                        injectProps,
                        constructorArgs: ctorArgs,
                        constructorDescription: e.constructorObj?.description,
                        depth: props.depth ?? 0
                    });
                })()}

            {/* Relationships (cross-linking) */}
            {isInfoSection('relationships') &&
                props.relationships &&
                (props.relationships.incoming?.length > 0 ||
                    props.relationships.outgoing?.length > 0) &&
                BlockRelationshipGraph({
                    incoming: props.relationships.incoming,
                    outgoing: props.relationships.outgoing,
                    entityName: e.name
                })}
        </>
    ) as string;
};

/**
 * Member surface for class-like entities: index, constructor, inputs, outputs,
 * host bindings/listeners, methods, properties, index signatures, accessors.
 * Lives on the **API** tab.
 */
const ApiContent = (props: EntityInfoProps): string => {
    const e = props.entity;
    const allProps: any[] = e.propertiesClass ?? e.properties ?? [];
    const allSignalProps: any[] = [
        ...(e.inputsClass ?? []),
        ...(e.outputsClass ?? []),
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
            {/* Index */}
            {isApiSection('index') &&
                props.showIndex !== false &&
                BlockIndex({
                    properties: regularProps,
                    methods: e.methodsClass ?? e.methods,
                    inputs: e.inputsClass,
                    outputs: e.outputsClass,
                    derivedState: derivedProps,
                    effects: showEffects ? effectProps : [],
                    hostBindings: e.hostBindings,
                    hostListeners: e.hostListeners,
                    accessors: e.accessors,
                    indexSignatures: e.indexSignatures
                })}

            {/* Inputs */}
            {isApiSection('inputs') &&
                props.showInputs !== false &&
                e.inputsClass?.length > 0 &&
                BlockInput({
                    element: e,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Outputs */}
            {isApiSection('outputs') &&
                props.showOutputs !== false &&
                e.outputsClass?.length > 0 &&
                BlockOutput({
                    element: e,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Derived State */}
            {isApiSection('derivedState') &&
                derivedProps.length > 0 &&
                BlockDerivedState({
                    properties: derivedProps,
                    allSignalProps,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Properties */}
            {isApiSection('properties') &&
                props.showProperties !== false &&
                regularProps.length > 0 &&
                BlockProperty({
                    properties: regularProps,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Effects (opt-in via --showEffects) */}
            {isApiSection('effects') &&
                showEffects &&
                effectProps.length > 0 &&
                BlockProperty({
                    properties: effectProps,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs,
                    title: t('effects'),
                    id: 'effects'
                })}

            {/* Methods */}
            {isApiSection('methods') &&
                props.showMethods !== false &&
                (e.methodsClass ?? e.methods)?.length > 0 &&
                BlockMethod({
                    methods: e.methodsClass ?? e.methods,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Index Signatures */}
            {isApiSection('indexSignatures') &&
                props.showIndexSignatures !== false &&
                e.indexSignatures?.length > 0 &&
                BlockIndexSignatures({
                    indexables: e.indexSignatures,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Accessors */}
            {isApiSection('accessors') &&
                props.showAccessors !== false &&
                e.accessors &&
                Object.keys(e.accessors).length > 0 &&
                BlockAccessors({
                    accessors: e.accessors,
                    file: e.file,
                    depth: props.depth,
                    navTabs: props.navTabs
                })}

            {/* Host Bindings */}
            {isApiSection('hostBindings') &&
                props.showHostBindings !== false &&
                e.hostBindings?.length > 0 &&
                BlockHostBindings({ bindings: e.hostBindings })}

            {/* Host Listeners */}
            {isApiSection('hostListeners') &&
                props.showHostListeners !== false &&
                e.hostListeners?.length > 0 &&
                BlockHostListeners({ listeners: e.hostListeners })}
        </>
    ) as string;
};

/** Generic entity detail page renderer. */
export const renderEntityPage = (props: EntityInfoProps): string => {
    const meta = entityMeta[props.entityKey] ?? entityMeta['entity'];
    const e = props.entity;

    const searchMeta = pagefindMetaBlock({
        kind: props.entityKey as any,
        category: e.category,
        description: e.description
    });
    const searchFilters = pagefindFilterBlock({
        kind: props.entityKey as any,
        lib: deriveLibFromBucket(e.category || e.file),
        bucket: e.category,
        docsKind: e.docsKind === 'primary' ? 'primary' : 'reference',
        wcag: e.wcagLevel
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
                            const segments = resolveBucketSegments(e);
                            return segments
                                ? segments.map(seg => <li>{seg}</li>)
                                : ((<li>{t(props.breadcrumbLabel)}</li>) as string);
                        })()}
                        <li aria-current="page">{e.name}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span class={e.deprecated ? 'cdx-member-name--deprecated' : ''}>{e.name}</span>
                </h1>
                {e.taggedSelector ? (
                    <p class="cdx-entity-hero-selector">
                        <code>{e.taggedSelector}</code>
                    </p>
                ) : (
                    ''
                )}
                <div class="cdx-entity-hero-badges">
                    <span class={`cdx-badge ${meta.badge}`}>{meta.label}</span>
                    {PrimaryBadge({ docsKind: e.docsKind })}
                    {props.showTokenBadge && e.isToken ? (
                        <span class="cdx-badge cdx-badge--token">Token</span>
                    ) : (
                        ''
                    )}
                    {props.showJsdocBadges && e.beta ? (
                        <span class="cdx-badge cdx-badge--beta">Beta</span>
                    ) : (
                        ''
                    )}
                    {props.showJsdocBadges && e.since ? (
                        <span class="cdx-badge cdx-badge--since">v{e.since}</span>
                    ) : (
                        ''
                    )}
                    {props.showJsdocBadges && e.breaking ? (
                        <span class="cdx-badge cdx-badge--breaking">Breaking {e.breaking}</span>
                    ) : (
                        ''
                    )}
                    {props.showJsdocBadges ? AiGeneratedBadge({ aiGenerated: e.aiGenerated }) : ''}
                    {WcagBadge({ wcagLevel: e.wcagLevel })}
                </div>
                {props.contextLine ? (
                    <p class="cdx-entity-hero-context">{props.contextLine}</p>
                ) : (
                    ''
                )}
                {!props.disableFilePath && e.file && (
                    <p class="cdx-entity-hero-file" title="Source file">
                        {IconFile()}
                        <span>{e.file}</span>
                    </p>
                )}
                {ExternalLinks({
                    storybookUrl: e.storybookUrl,
                    figmaUrl: e.figmaUrl,
                    stackblitzUrl: e.stackblitzUrl,
                    githubUrl: e.githubUrl,
                    docsUrl: e.docsUrl
                })}
            </div>
            {EntityTabs({
                navTabs: props.navTabs,
                infoContent: InfoContent(props),
                apiContent: ApiContent(props),
                readme: e.readme,
                sourceCode: e.sourceCode,
                filePath: e.file,
                exampleUrls: e.exampleUrls,
                entityName: e.name,
                entityFile: e.file,
                entitySourceCode: e.sourceCode,
                playgrounds: props.playgrounds,
                playgroundFiles: props.playgroundFiles,
                playgroundResolver: props.playgroundResolver,
                workspacePackage: props.workspacePackage,
                playgroundDependencies: props.playgroundDependencies,
                playgroundMaterialShell: props.playgroundMaterialShell,
                playgroundDepDepth: props.playgroundDepDepth,
                playgroundFileCountCap: props.playgroundFileCountCap,
                playgroundFileCap: props.playgroundFileCap,
                playgroundHead: props.playgroundHead,
                playgroundGlobalStyles: props.playgroundGlobalStyles,
                playgroundVendorPackages: props.playgroundVendorPackages,
                playgroundVendorCap: props.playgroundVendorCap
            })}
        </>
    ) as string;
};
