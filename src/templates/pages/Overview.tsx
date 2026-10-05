import Html from '@kitajs/html';
import { DEPENDENCY_LEGEND_ITEMS, GraphLegend, GraphZoomControls } from '../blocks/GraphControls';
import { OverviewHero } from '../blocks/OverviewHero';
import { OverviewStats } from '../blocks/OverviewStats';
import { EmptyState } from '../components/EmptyState';
import { EmptyIconDashboard } from '../components/EmptyStateIcons';
import { t } from '../helpers';

type OverviewProps = {
    readonly components?: unknown[];
    readonly entities?: unknown[];
    readonly directives?: unknown[];
    readonly injectables?: unknown[];
    readonly interceptors?: unknown[];
    readonly pipes?: unknown[];
    readonly classes?: unknown[];
    readonly guards?: unknown[];
    readonly interfaces?: unknown[];
    readonly routes?: unknown[];
    readonly routesLength?: number;
    readonly disableGraph?: boolean;
    readonly appConfig?: any[];
    readonly coverageData?: { files?: any[]; count?: number };
    readonly angularVersion?: string;
    readonly generatedAt?: string;
    readonly documentationMainName?: string;
    readonly dependencyGraph?: { nodes: any[]; edges: any[] };
};

const hasAnyEntities = (props: OverviewProps): boolean =>
    !!(
        props.components?.length ||
        props.entities?.length ||
        props.directives?.length ||
        props.injectables?.length ||
        props.interceptors?.length ||
        props.pipes?.length ||
        props.classes?.length ||
        props.guards?.length ||
        props.interfaces?.length ||
        props.routes?.length ||
        props.appConfig?.length
    );

export const Overview = (props: OverviewProps): string => {
    const hasDepGraph = (props.dependencyGraph?.nodes?.length ?? 0) > 0;
    const showDepGraph = !props.disableGraph && hasDepGraph;

    return (
        <>
            {/* 1. Project Summary Hero */}
            {OverviewHero({
                projectName: props.documentationMainName || t('overview'),
                angularVersion: props.angularVersion || undefined,
                hasZoneless: [
                    ...((props.components as any[]) ?? []),
                    ...((props.directives as any[]) ?? [])
                ].some((e: any) => e.zoneless),
                generatedAt: props.generatedAt || new Date().toISOString()
            })}

            {/* 2. Dependency Graph */}
            {showDepGraph && (
                <>
                    <script>{`window.DEPENDENCY_GRAPH = ${JSON.stringify(props.dependencyGraph)};`}</script>
                    {/* A11y: text alternative for screen readers (network graphs are inaccessible) */}
                    <ul class="sr-only" aria-label="Component dependency list">
                        {props.dependencyGraph!.edges.map((e: any) => (
                            <li>
                                {e.source} imports {e.target}
                            </li>
                        ))}
                    </ul>
                    <div class="cdx-graph-container cdx-overview-graph">
                        <div class="cdx-graph-viewport">
                            <div id="dependency-graph-container"></div>
                        </div>
                        {GraphZoomControls({ prefix: 'dep-' })}
                    </div>
                    {GraphLegend({ items: DEPENDENCY_LEGEND_ITEMS })}
                </>
            )}

            {/* 3. Stats Grid or Empty State */}
            {hasAnyEntities(props)
                ? OverviewStats({
                      components: props.components as any[],
                      directives: props.directives as any[],
                      injectables: props.injectables as any[],
                      pipes: props.pipes as any[],
                      classes: props.classes as any[],
                      guards: props.guards as any[],
                      interfaces: props.interfaces as any[],
                      interceptors: props.interceptors as any[],
                      entities: props.entities as any[],
                      routes: props.routes as any[],
                      routesLength: props.routesLength,
                      appConfig: props.appConfig,
                      coverageData: props.coverageData
                  })
                : EmptyState({
                      icon: EmptyIconDashboard(),
                      title: t('empty-overview-title'),
                      description: t('empty-overview-desc'),
                      action: {
                          label: t('empty-overview-action'),
                          href: 'https://compodocx.dev/guide/getting-started'
                      },
                      variant: 'page'
                  })}
        </>
    ) as string;
};
