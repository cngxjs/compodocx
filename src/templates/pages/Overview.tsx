import Html from '@kitajs/html';
import type { GraphOutput } from '../../app/graph/file';
import { GRAPH_SCRIPT } from '../../app/page-generator/shared-scripts';
import { graphHeight } from '../../client/graph-layout';
import { GraphRelationLegend, GraphZoomControls } from '../blocks/GraphControls';
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
    readonly services?: unknown[];
    readonly interceptors?: unknown[];
    readonly pipes?: unknown[];
    readonly classes?: unknown[];
    readonly guards?: unknown[];
    readonly interfaces?: unknown[];
    readonly routing?: { readonly count: number };
    readonly disableRoutes?: boolean;
    readonly disableGraph?: boolean;
    readonly appConfig?: any[];
    readonly coverageData?: { files?: any[]; count?: number };
    readonly angularVersion?: string;
    readonly generatedAt?: string;
    readonly documentationMainName?: string;
    readonly graph?: GraphOutput;
};

/** Routes of the route model; none when routes are disabled. */
const routeCount = (props: OverviewProps): number =>
    props.disableRoutes ? 0 : (props.routing?.count ?? 0);

const hasAnyEntities = (props: OverviewProps): boolean =>
    !!(
        props.components?.length ||
        props.entities?.length ||
        props.directives?.length ||
        props.injectables?.length ||
        props.services?.length ||
        props.interceptors?.length ||
        props.pipes?.length ||
        props.classes?.length ||
        props.guards?.length ||
        props.interfaces?.length ||
        routeCount(props) > 0 ||
        props.appConfig?.length
    );

export const Overview = (props: OverviewProps): string => {
    const graph = props.disableGraph ? undefined : props.graph;
    const names = new Map(graph?.model.nodes.map(n => [n.id, n.name]));

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
            {graph && (
                <>
                    {/* A11y: text alternative for screen readers (network graphs are inaccessible) */}
                    <ul class="sr-only" aria-label="Component dependency list">
                        {graph.model.edges.map(e => (
                            <li>
                                {names.get(e.source) ?? e.source} {e.kind}{' '}
                                {names.get(e.target) ?? e.target}
                            </li>
                        ))}
                    </ul>
                    <div class="cdx-graph-container cdx-overview-graph">
                        <div class="cdx-graph-viewport">
                            {/* The graph loads when it scrolls into view. The reserved height
                                keeps the page from jumping when the graph draws. */}
                            <div
                                id="dependency-graph-container"
                                data-cdx-graph-src={`${GRAPH_SCRIPT}?v=${graph.version}`}
                                data-cdx-root=""
                                data-cdx-label={t('graph-label')}
                                style={`min-height: ${graphHeight(graph.shown)}px`}
                            ></div>
                        </div>
                        {GraphZoomControls({
                            prefix: 'dep-',
                            externalCount: graph.model.nodes.filter(n => n.kind === 'external')
                                .length
                        })}
                    </div>
                    {GraphRelationLegend({ edges: graph.model.edges })}
                </>
            )}

            {/* 3. Stats Grid or Empty State */}
            {hasAnyEntities(props)
                ? OverviewStats({
                      components: props.components as any[],
                      directives: props.directives as any[],
                      injectables: props.injectables as any[],
                      services: props.services as any[],
                      pipes: props.pipes as any[],
                      classes: props.classes as any[],
                      guards: props.guards as any[],
                      interfaces: props.interfaces as any[],
                      interceptors: props.interceptors as any[],
                      entities: props.entities as any[],
                      routeCount: routeCount(props),
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
