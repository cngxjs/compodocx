import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { hrefFor, hrefText, ROOT_DEPTH } from '../../app/links/layout';
import { placeTarget, targetOfCoverage } from '../../app/links/resolve';
import { CoverageSummary } from '../blocks/CoverageSummary';
import { DonutChart } from '../blocks/DonutChart';
import { EmptyState } from '../components/EmptyState';
import { EmptyIconChart } from '../components/EmptyStateIcons';
import { computeCoverageStats, shortPath, t } from '../helpers';

type CoverageFile = {
    readonly status: string;
    readonly filePath: string;
    readonly name: string;
    readonly type: string;
    readonly linktype: string;
    readonly linksubtype?: string;
    readonly coveragePercent: number;
    readonly coverageCount: string;
};

type CoverageReportProps = {
    readonly files: CoverageFile[];
    readonly data: { readonly count: number; readonly depth: number };
};

//Entity type → display & badge mapping
type GroupMeta = { label: string; badge: string; order: number };

const GROUP_META: Record<string, GroupMeta & { singular: string }> = {
    component: {
        label: 'Components',
        singular: 'Component',
        badge: 'cdx-badge--entity-component',
        order: 0
    },
    directive: {
        label: 'Directives',
        singular: 'Directive',
        badge: 'cdx-badge--entity-directive',
        order: 1
    },
    pipe: { label: 'Pipes', singular: 'Pipe', badge: 'cdx-badge--entity-pipe', order: 2 },
    injectable: {
        label: 'Injectables',
        singular: 'Injectable',
        badge: 'cdx-badge--entity-injectable',
        order: 3
    },
    class: { label: 'Classes', singular: 'Class', badge: 'cdx-badge--entity-class', order: 4 },
    interface: {
        label: 'Interfaces',
        singular: 'Interface',
        badge: 'cdx-badge--entity-interface',
        order: 5
    },
    guard: { label: 'Guards', singular: 'Guard', badge: 'cdx-badge--entity-guard', order: 6 },
    interceptor: {
        label: 'Interceptors',
        singular: 'Interceptor',
        badge: 'cdx-badge--entity-interceptor',
        order: 7
    },
    entity: { label: 'Entities', singular: 'Entity', badge: 'cdx-badge--entity-class', order: 8 },
    function: {
        label: 'Functions',
        singular: 'Function',
        badge: 'cdx-badge--entity-function',
        order: 9
    },
    variable: {
        label: 'Variables',
        singular: 'Variable',
        badge: 'cdx-badge--entity-variable',
        order: 10
    },
    'type alias': {
        label: 'Type Aliases',
        singular: 'Type Alias',
        badge: 'cdx-badge--entity-typealias',
        order: 11
    }
};

const fallbackMeta: GroupMeta & { singular: string } = {
    label: 'Other',
    singular: 'Other',
    badge: 'cdx-badge--entity-class',
    order: 99
};

/* ---- Progress bar color helper ---- */

const coverageFillClass = (pct: number): string => {
    if (pct <= 33) {
        return 'cdx-coverage-fill--low';
    }
    if (pct <= 66) {
        return 'cdx-coverage-fill--medium';
    }
    return 'cdx-coverage-fill--high';
};

/* ---- File link builder ---- */

const fileLink = (f: CoverageFile): string => {
    const target = targetOfCoverage(f, { table: Configuration.mainData.symbols });
    const link =
        target && placeTarget(target, { name: f.name, file: f.filePath }, Configuration.mainData);
    return link ? hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor)) : '';
};

const ChevronIcon = (): string =>
    (
        <svg
            class="cdx-coverage-group-chevron"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
        >
            <path d="M6 3l5 5-5 5" />
        </svg>
    ) as string;

const _ProgressBar = (pct: number, mini = false): string => {
    const barClass = mini ? 'cdx-coverage-bar-mini' : 'cdx-coverage-bar';
    const fillClass = mini ? 'cdx-coverage-bar-mini-fill' : 'cdx-coverage-bar-fill';
    return (
        <span
            class={barClass}
            role="progressbar"
            aria-valuenow={String(pct)}
            aria-valuemin="0"
            aria-valuemax="100"
        >
            <span class={`${fillClass} ${coverageFillClass(pct)}`} style={`width:${pct}%`} />
        </span>
    ) as string;
};

export const CoverageReport = (props: CoverageReportProps): string => {
    const files = props.files;
    const overallPct = props.data.count;

    if (files.length === 0) {
        return (
            <>
                <ol class="cdx-breadcrumb">
                    <li>{t('coverage-page-title')}</li>
                </ol>
                {EmptyState({
                    icon: EmptyIconChart(),
                    title: t('no-documentation-coverage-data'),
                    description:
                        t('coverage-empty-description') ||
                        'Run compodocx with documented entities to see coverage.',
                    variant: 'page'
                })}
            </>
        ) as string;
    }

    //Group files by type
    const groups = new Map<string, CoverageFile[]>();
    for (const f of files) {
        const key = f.type;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(f);
    }

    // Sort groups by order, then sort files within each group by coverage asc */
    const sortedGroupKeys = [...groups.keys()].sort((a, b) => {
        const ma = GROUP_META[a] ?? fallbackMeta;
        const mb = GROUP_META[b] ?? fallbackMeta;
        return ma.order - mb.order;
    });

    // Compute stats
    const { total, documented, partial, undocumented } = computeCoverageStats(files);

    return (
        <>
            <ol class="cdx-breadcrumb">
                <li>{t('coverage-page-title')}</li>
            </ol>
            {CoverageSummary({
                donutHtml: DonutChart({
                    percent: overallPct,
                    documented,
                    partial,
                    undocumented,
                    total,
                    size: 'lg'
                }),
                stats: [
                    { value: total, label: t('total'), subtitle: `${files.length} files` },
                    {
                        value: documented,
                        label: t('documented'),
                        modifier: 'documented',
                        subtitle: total > 0 ? `${Math.round((documented / total) * 100)}%` : '0%'
                    },
                    {
                        value: partial,
                        label: t('partial'),
                        modifier: 'partial',
                        subtitle: total > 0 ? `${Math.round((partial / total) * 100)}%` : '0%'
                    },
                    {
                        value: undocumented,
                        label: t('undocumented'),
                        modifier: 'undocumented',
                        subtitle: total > 0 ? `${Math.round((undocumented / total) * 100)}%` : '0%'
                    }
                ]
            })}

            <div class="cdx-coverage-filter">
                <input
                    type="text"
                    class="cdx-coverage-filter-input"
                    placeholder={t('filter-entities') || 'Filter entities...'}
                    aria-label={t('filter-coverage-results') || 'Filter coverage results'}
                    data-cdx-coverage-filter
                />
                <button
                    type="button"
                    class="cdx-coverage-filter-clear"
                    aria-label="Clear filter"
                    data-cdx-coverage-filter-clear
                >
                    &times;
                </button>
            </div>

            <div class="cdx-coverage-no-results" data-cdx-coverage-no-results>
                {t('no-matching-entities') || 'No matching entities'}
            </div>

            {sortedGroupKeys.map(typeKey => {
                const groupFiles = groups.get(typeKey)!;
                const meta = GROUP_META[typeKey] ?? fallbackMeta;

                groupFiles.sort((a, b) => a.coveragePercent - b.coveragePercent);

                const groupDocumented = groupFiles.filter(f => f.coveragePercent === 100).length;
                const _groupPct =
                    groupFiles.length > 0
                        ? Math.round(
                              groupFiles.reduce((sum, f) => sum + f.coveragePercent, 0) /
                                  groupFiles.length
                          )
                        : 0;

                return (
                    <details open class="cdx-coverage-group" data-cdx-coverage-group={typeKey}>
                        <summary class="cdx-coverage-group-header">
                            {ChevronIcon()}
                            <span class={`cdx-badge ${meta.badge}`}>{meta.label}</span>
                            <span class="cdx-coverage-group-fraction">
                                {groupDocumented}/{groupFiles.length}
                            </span>
                        </summary>

                        <table class="cdx-coverage-table">
                            <thead>
                                <tr>
                                    <th data-cdx-sort="name" aria-sort="none">
                                        {t('identifier')}
                                        <span
                                            class="cdx-coverage-sort-arrow"
                                            aria-hidden="true"
                                        ></span>
                                    </th>
                                    <th
                                        data-cdx-sort="file"
                                        aria-sort="none"
                                        class="cdx-coverage-file-col"
                                    >
                                        {t('file')}
                                        <span
                                            class="cdx-coverage-sort-arrow"
                                            aria-hidden="true"
                                        ></span>
                                    </th>
                                    <th data-cdx-sort="coverage" aria-sort="ascending">
                                        {t('coverage') || 'Coverage'}
                                        <span class="cdx-coverage-sort-arrow" aria-hidden="true">
                                            {'\u25B2'}
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupFiles.map(f => (
                                    <tr
                                        data-cdx-coverage-name={f.name.toLowerCase()}
                                        data-cdx-coverage-file={f.filePath.toLowerCase()}
                                        data-cdx-coverage-pct={String(f.coveragePercent)}
                                    >
                                        <td>
                                            <a href={fileLink(f)}>{f.name}</a>
                                        </td>
                                        <td
                                            class="cdx-coverage-file cdx-coverage-file-col"
                                            title={f.filePath}
                                        >
                                            {shortPath(f.filePath)}
                                        </td>
                                        <td class="cdx-coverage-cell">
                                            <span
                                                class={`cdx-coverage-pct cdx-coverage-pct--${f.coveragePercent <= 33 ? 'low' : f.coveragePercent <= 66 ? 'medium' : 'high'}`}
                                            >
                                                {f.coveragePercent}%
                                            </span>
                                            <span class="cdx-coverage-count-detail">
                                                ({f.coverageCount})
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                );
            })}
        </>
    ) as string;
};
