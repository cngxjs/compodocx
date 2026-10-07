import Html from '@kitajs/html';
import { hrefFor, hrefText, ROOT_DEPTH } from '../../app/links/layout';
import {
    IconClass,
    IconComponent,
    IconDirective,
    IconEntity,
    IconGitBranch,
    IconGuard,
    IconInjectable,
    IconInterceptor,
    IconInterface,
    IconPipe,
    IconSettings
} from '../components/Icons';
import { computeCoverageStats, t } from '../helpers';
import { DonutChart } from './DonutChart';

/* ---- Types ---- */

type EntityChip = {
    readonly icon: () => string;
    readonly count: number;
    readonly label: string;
    readonly subtitle?: string;
    readonly href?: string;
    readonly colorVar: string;
};

type OverviewStatsProps = {
    readonly components?: any[];
    readonly directives?: any[];
    readonly injectables?: any[];
    readonly pipes?: any[];
    readonly classes?: any[];
    readonly guards?: any[];
    readonly interfaces?: any[];
    readonly interceptors?: any[];
    readonly entities?: any[];
    readonly routes?: any[];
    readonly routesLength?: number;
    readonly appConfig?: any[];
    readonly coverageData?: { files?: any[] };
};

/* ---- KPI Tile ---- */

const KpiTile = (props: {
    label: string;
    count: number;
    total: number;
    fraction?: string;
}): string => {
    const pct = props.total > 0 ? Math.round((props.count / props.total) * 100) : 0;
    return (
        <div class="cdx-overview-kpi">
            <div class="cdx-overview-kpi-value">{pct}%</div>
            <div class="cdx-overview-kpi-label">{props.label}</div>
            <div
                class="cdx-overview-adoption-bar"
                role="progressbar"
                aria-valuenow={String(pct)}
                aria-valuemin="0"
                aria-valuemax="100"
            >
                <div
                    class="cdx-overview-adoption-fill"
                    style="width:0"
                    data-cdx-fill-width={`${pct}%`}
                />
            </div>
            {props.fraction && <div class="cdx-overview-kpi-fraction">{props.fraction}</div>}
        </div>
    ) as string;
};

/* ---- Adoption metrics computation ---- */

function computeAdoption(props: OverviewStatsProps) {
    const allComponents = props.components ?? [];
    const allDirectives = props.directives ?? [];
    const allPipes = props.pipes ?? [];

    const standaloneTotal = allComponents.length + allDirectives.length + allPipes.length;
    const standaloneCount =
        allComponents.filter((c: any) => c.standalone).length +
        allDirectives.filter((d: any) => d.standalone).length +
        allPipes.filter((p: any) => p.standalone).length;

    const allEntities: any[] = [
        ...allComponents,
        ...allDirectives,
        ...allPipes,
        ...(props.injectables ?? []),
        ...(props.classes ?? []),
        ...(props.guards ?? []),
        ...(props.interceptors ?? []),
        ...(props.interfaces ?? []),
        ...(props.entities ?? [])
    ];

    let totalProps = 0;
    let signalProps = 0;
    let injectProps = 0;
    let constructorParams = 0;

    for (const entity of allEntities) {
        const properties = [
            ...(entity.propertiesClass ?? entity.properties ?? []),
            ...(entity.inputsClass ?? []),
            ...(entity.outputsClass ?? [])
        ];
        for (const prop of properties) {
            if (prop.signalKind === 'effect') {
                continue;
            }
            totalProps++;
            if (prop.signalKind) {
                signalProps++;
                if (prop.signalKind === 'inject') {
                    injectProps++;
                }
            }
        }
        if (entity.constructorObj?.args) {
            constructorParams += entity.constructorObj.args.length;
        }
    }

    const injectTotal = injectProps + constructorParams;

    return { standaloneCount, standaloneTotal, signalProps, totalProps, injectProps, injectTotal };
}

/* ---- Entity Chip ---- */

const EntityChipEl = (chip: EntityChip): string => {
    const inner = (
        <>
            <span class="cdx-overview-chip-icon" style={`color: ${chip.colorVar}`}>
                {chip.icon()}
            </span>
            <span class="cdx-overview-chip-count">{chip.count}</span>
            <span class="cdx-overview-chip-label">{chip.label}</span>
            {chip.subtitle && <span class="cdx-overview-chip-sub">{chip.subtitle}</span>}
        </>
    ) as string;

    if (chip.href) {
        return (
            <a href={chip.href} class="cdx-overview-chip">
                {inner}
            </a>
        ) as string;
    }
    return (<span class="cdx-overview-chip">{inner}</span>) as string;
};

/* ---- Main Component ---- */

/** Link from the overview (a root page) to another root page. */
const rootHref = (page: string): string => hrefText(hrefFor({ type: 'root', page }, ROOT_DEPTH));

type ChipGroup = { label: string; chips: EntityChip[] };

function buildChipGroups(props: OverviewStatsProps): ChipGroup[] {
    const groups: ChipGroup[] = [];

    // Structure: Routes, AppConfig
    const structure: EntityChip[] = [];
    if (props.routes?.length) {
        structure.push({
            icon: IconGitBranch,
            count: props.routesLength ?? 0,
            label: t('routes'),
            href: rootHref('routes'),
            colorVar: 'var(--color-cdx-primary)'
        });
    }
    if (props.appConfig?.length) {
        structure.push({
            icon: IconSettings,
            count: props.appConfig.length,
            label: t('configurations'),
            href: rootHref('app-config'),
            colorVar: 'var(--color-cdx-primary)'
        });
    }
    if (structure.length) {
        groups.push({ label: 'Structure', chips: structure });
    }

    // Declarables: Components, Directives, Pipes
    const declarables: EntityChip[] = [];
    if (props.components?.length) {
        const sa = (props.components as any[]).filter(c => c.standalone).length;
        declarables.push({
            icon: IconComponent,
            count: props.components.length,
            label: t('components'),
            subtitle: sa > 0 ? `${sa} standalone` : undefined,
            colorVar: 'var(--color-cdx-entity-component)'
        });
    }
    if (props.directives?.length) {
        const sa = (props.directives as any[]).filter(d => d.standalone).length;
        declarables.push({
            icon: IconDirective,
            count: props.directives.length,
            label: t('directives'),
            subtitle: sa > 0 ? `${sa} standalone` : undefined,
            colorVar: 'var(--color-cdx-entity-directive)'
        });
    }
    if (props.pipes?.length) {
        declarables.push({
            icon: IconPipe,
            count: props.pipes.length,
            label: t('pipes'),
            colorVar: 'var(--color-cdx-entity-pipe)'
        });
    }
    if (declarables.length) {
        groups.push({ label: 'Declarables', chips: declarables });
    }

    // Services: Injectables, Interceptors, Guards
    const services: EntityChip[] = [];
    if (props.injectables?.length) {
        const tokens = (props.injectables as any[]).filter(i => i.isToken).length;
        services.push({
            icon: IconInjectable,
            count: props.injectables.length,
            label: t('injectables'),
            subtitle: tokens > 0 ? `${tokens} tokens` : undefined,
            colorVar: 'var(--color-cdx-entity-service)'
        });
    }
    if (props.interceptors?.length) {
        services.push({
            icon: IconInterceptor,
            count: props.interceptors.length,
            label: t('interceptors'),
            colorVar: 'var(--color-cdx-entity-interceptor)'
        });
    }
    if (props.guards?.length) {
        services.push({
            icon: IconGuard,
            count: props.guards.length,
            label: t('guards'),
            colorVar: 'var(--color-cdx-entity-guard)'
        });
    }
    if (services.length) {
        groups.push({ label: 'Services', chips: services });
    }

    // Types: Classes, Interfaces, Entities
    const types: EntityChip[] = [];
    if (props.classes?.length) {
        types.push({
            icon: IconClass,
            count: props.classes.length,
            label: t('classes'),
            colorVar: 'var(--color-cdx-entity-class)'
        });
    }
    if (props.interfaces?.length) {
        types.push({
            icon: IconInterface,
            count: props.interfaces.length,
            label: t('interfaces'),
            colorVar: 'var(--color-cdx-entity-interface)'
        });
    }
    if (props.entities?.length) {
        types.push({
            icon: IconEntity,
            count: props.entities.length,
            label: t('entities'),
            colorVar: 'var(--color-cdx-entity-class)'
        });
    }
    if (types.length) {
        groups.push({ label: 'Types', chips: types });
    }

    return groups;
}

export const OverviewStats = (props: OverviewStatsProps): string => {
    const chipGroups = buildChipGroups(props);

    // Coverage
    const coverageFiles = props.coverageData?.files ?? [];
    const coverage = computeCoverageStats(coverageFiles);

    // Adoption
    const adoption = computeAdoption(props);
    const hasAdoption = adoption.standaloneTotal > 0 || adoption.totalProps > 0;

    return (
        <div class="cdx-overview-stats">
            {/* KPI Row: Coverage + Adoption metrics */}
            {(coverage.total > 0 || hasAdoption) && (
                <div class="cdx-overview-kpi-row">
                    {/* Coverage tile */}
                    {coverage.total > 0 && (
                        <a
                            href={rootHref('coverage')}
                            class="cdx-overview-kpi cdx-overview-kpi--coverage"
                        >
                            {DonutChart({
                                percent: coverage.percent,
                                documented: coverage.documented,
                                partial: coverage.partial,
                                undocumented: coverage.undocumented,
                                total: coverage.total,
                                size: 'sm'
                            })}
                            <div class="cdx-overview-kpi-label">{t('coverage-overview')}</div>
                            <div class="cdx-overview-kpi-fraction">
                                {coverage.documented}/{coverage.total}{' '}
                                {t('documented').toLowerCase()}
                            </div>
                        </a>
                    )}

                    {/* Standalone tile */}
                    {adoption.standaloneTotal > 0 &&
                        KpiTile({
                            label: t('standalone-adoption'),
                            count: adoption.standaloneCount,
                            total: adoption.standaloneTotal,
                            fraction: `${adoption.standaloneCount}/${adoption.standaloneTotal}`
                        })}

                    {/* Signals tile */}
                    {adoption.totalProps > 0 &&
                        KpiTile({
                            label: t('signal-adoption'),
                            count: adoption.signalProps,
                            total: adoption.totalProps,
                            fraction: `${adoption.signalProps}/${adoption.totalProps}`
                        })}

                    {/* inject() tile -- always shown for 4-column alignment */}
                    {KpiTile({
                        label: t('inject-adoption'),
                        count: adoption.injectProps,
                        total: adoption.injectTotal > 0 ? adoption.injectTotal : 1,
                        fraction:
                            adoption.injectTotal > 0
                                ? `${adoption.injectProps}/${adoption.injectTotal}`
                                : '--'
                    })}
                </div>
            )}

            {/* Entity inventory grouped by category */}
            {chipGroups.length > 0 && (
                <div class="cdx-overview-inventory">
                    {chipGroups.map(group => (
                        <div class="cdx-overview-chip-group">
                            <h2 class="cdx-overview-section-heading">{group.label}</h2>
                            <div class="cdx-overview-chips">
                                {group.chips.map(chip => EntityChipEl(chip))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    ) as string;
};
