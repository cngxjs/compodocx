import Html from '@kitajs/html';
import type {
    ConsumerPackageJson,
    DepGraphResolver,
    FileRefBundle,
    VendorPackage
} from '../../app/engines/stackblitz';
import { EmptyState } from '../components/EmptyState';
import { EmptyIconBook, EmptyIconFile } from '../components/EmptyStateIcons';
import { extractReadmeHeadings, isInitialTab, isReadmeEmpty, isTabEnabled, t } from '../helpers';
import type { ComponentPlaygroundBlock } from '../helpers/jsdoc';
import { PlaygroundContent } from './PlaygroundContent';
import { SourceViewer } from './SourceViewer';

type Tab = {
    readonly id: string;
    readonly href: string;
    readonly label: string;
    readonly 'data-link'?: string;
};

type EntityTabsProps = {
    readonly navTabs: Tab[];
    readonly infoContent: string;
    readonly apiContent?: string;
    readonly readme?: string;
    readonly sourceCode?: string;
    readonly filePath?: string;
    readonly exampleUrls?: string[];
    readonly entityName?: string;
    readonly entityFile?: string;
    readonly entitySourceCode?: string;
    /** Rendered Theming tab content; the panel is omitted without it. */
    readonly themingContent?: string;
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

/** Render the tab bar + tab panels for entity detail pages. */
export const EntityTabs = (props: EntityTabsProps): string =>
    (
        <>
            <ul class="cdx-tab-bar">
                {props.navTabs.map((tab, i) => (
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
            </ul>

            <div>
                {isTabEnabled(props.navTabs, 'info') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(props.navTabs, 'info') ? ' active' : ''}`}
                        id="info"
                        role="tabpanel"
                        aria-labelledby="info-tab"
                    >
                        {props.infoContent}
                    </div>
                )}

                {isTabEnabled(props.navTabs, 'api') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(props.navTabs, 'api') ? ' active' : ''}`}
                        id="api"
                        role="tabpanel"
                        aria-labelledby="api-tab"
                    >
                        {props.apiContent ?? ''}
                    </div>
                )}

                {isTabEnabled(props.navTabs, 'readme') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(props.navTabs, 'readme') ? ' active' : ''}`}
                        id="readme"
                        role="tabpanel"
                        aria-labelledby="readme-tab"
                    >
                        {isReadmeEmpty(props.readme) ? (
                            <>
                                {extractReadmeHeadings(props.readme)}
                                {EmptyState({
                                    icon: EmptyIconBook(),
                                    title: t('empty-readme-title'),
                                    description: t('empty-readme-desc'),
                                    variant: 'full'
                                })}
                            </>
                        ) : (
                            <div class="cdx-readme">{props.readme}</div>
                        )}
                    </div>
                )}

                {isTabEnabled(props.navTabs, 'source') && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(props.navTabs, 'source') ? ' active' : ''} cdx-tab-panel--source`}
                        id="source"
                        role="tabpanel"
                        aria-labelledby="source-tab"
                    >
                        {props.sourceCode
                            ? SourceViewer({
                                  filePath: props.filePath,
                                  sourceCode: props.sourceCode,
                                  lang: 'typescript'
                              })
                            : EmptyState({
                                  icon: EmptyIconFile(),
                                  title: t('empty-source-title'),
                                  description: t('empty-source-desc'),
                                  variant: 'full'
                              })}
                    </div>
                )}

                {isTabEnabled(props.navTabs, 'theming') && props.themingContent && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(props.navTabs, 'theming') ? ' active' : ''}`}
                        id="theming"
                        role="tabpanel"
                        aria-labelledby="theming-tab"
                    >
                        {props.themingContent}
                    </div>
                )}

                {isTabEnabled(props.navTabs, 'example') && props.exampleUrls && (
                    <div
                        class={`cdx-tab-panel${isInitialTab(props.navTabs, 'example') ? ' active' : ''}`}
                        id="example"
                        role="tabpanel"
                        aria-labelledby="example-tab"
                    >
                        {props.exampleUrls.map(url => (
                            <iframe class="cdx-example-container" src={url} title="Example preview">
                                <p>{t('no-iframes')}</p>
                            </iframe>
                        ))}
                    </div>
                )}

                {isTabEnabled(props.navTabs, 'playground') &&
                    props.playgrounds?.length &&
                    props.entityName && (
                        <div
                            class={`cdx-tab-panel${isInitialTab(props.navTabs, 'playground') ? ' active' : ''}`}
                            id="playground"
                            role="tabpanel"
                            aria-labelledby="playground-tab"
                        >
                            {(() => {
                                const all = props.playgroundFiles ?? {};
                                const fileBundles: Record<number, FileRefBundle> = {};
                                for (let i = 0; i < props.playgrounds!.length; i++) {
                                    const bundle = all[`${props.entityName}:${i}`];
                                    if (bundle) {
                                        fileBundles[i] = bundle;
                                    }
                                }
                                return PlaygroundContent({
                                    componentName: props.entityName,
                                    componentFile: props.entityFile,
                                    componentSourceCode: props.entitySourceCode,
                                    playgrounds: props.playgrounds!,
                                    resolve: props.playgroundResolver,
                                    workspacePackage: props.workspacePackage,
                                    extraDependencies: props.playgroundDependencies,
                                    materialShell: props.playgroundMaterialShell,
                                    depth: props.playgroundDepDepth,
                                    maxFiles: props.playgroundFileCountCap,
                                    fileCap: props.playgroundFileCap,
                                    head: props.playgroundHead,
                                    globalStyles: props.playgroundGlobalStyles,
                                    vendorPackages: props.playgroundVendorPackages,
                                    vendorCap: props.playgroundVendorCap,
                                    fileBundles
                                });
                            })()}
                        </div>
                    )}
            </div>
        </>
    ) as string;
