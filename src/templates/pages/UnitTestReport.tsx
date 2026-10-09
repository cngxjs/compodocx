import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { hrefFor, hrefText, ROOT_DEPTH } from '../../app/links/layout';
import { placeTarget, targetOfCoverage } from '../../app/links/resolve';
import { CoverageSummary } from '../blocks/CoverageSummary';
import { DonutChart } from '../blocks/DonutChart';
import { shortPath, t } from '../helpers';

type CoverageMetric = {
    readonly coveragePercent: number;
    readonly coverageCount: string;
    readonly status: string;
    readonly total?: number;
    readonly covered?: number;
};

type UnitTestFile = {
    readonly name?: string;
    readonly filePath: string;
    readonly linktype?: string;
    readonly linksubtype?: string;
    readonly statements: CoverageMetric;
    readonly branches: CoverageMetric;
    readonly functions: CoverageMetric;
    readonly lines: CoverageMetric;
};

type UnitTestReportProps = {
    readonly files: UnitTestFile[];
    readonly idColumn?: boolean;
    readonly data: { readonly depth: number; readonly total?: Record<string, CoverageMetric> };
};

/* ---- Group metadata (reuse CoverageReport pattern) ---- */

type GroupMeta = { label: string; badge: string; order: number };

const GROUP_META: Record<string, GroupMeta> = {
    component: { label: 'Components', badge: 'cdx-badge--entity-component', order: 0 },
    directive: { label: 'Directives', badge: 'cdx-badge--entity-directive', order: 1 },
    pipe: { label: 'Pipes', badge: 'cdx-badge--entity-pipe', order: 2 },
    injectable: { label: 'Injectables', badge: 'cdx-badge--entity-injectable', order: 3 },
    class: { label: 'Classes', badge: 'cdx-badge--entity-class', order: 4 },
    interface: { label: 'Interfaces', badge: 'cdx-badge--entity-interface', order: 5 },
    guard: { label: 'Guards', badge: 'cdx-badge--entity-guard', order: 6 },
    interceptor: { label: 'Interceptors', badge: 'cdx-badge--entity-interceptor', order: 7 },
    function: { label: 'Functions', badge: 'cdx-badge--entity-function', order: 9 },
    variable: { label: 'Variables', badge: 'cdx-badge--entity-variable', order: 10 },
    typealias: { label: 'Type Aliases', badge: 'cdx-badge--entity-typealias', order: 11 },
    enum: { label: 'Enums', badge: 'cdx-badge--entity-enum', order: 12 },
    classe: { label: 'Classes', badge: 'cdx-badge--entity-class', order: 4 }
};

const FALLBACK_META: GroupMeta = { label: 'Other', badge: 'cdx-badge--entity-class', order: 99 };

/* ---- Helpers ---- */

const coveragePctClass = (pct: number): string => {
    if (pct <= 33) {
        return 'cdx-coverage-pct--low';
    }
    if (pct <= 66) {
        return 'cdx-coverage-pct--medium';
    }
    return 'cdx-coverage-pct--high';
};

const filePct = (f: UnitTestFile): number =>
    Math.round(
        (f.statements.coveragePercent +
            f.branches.coveragePercent +
            f.functions.coveragePercent +
            f.lines.coveragePercent) /
            4
    );

const fileCovCount = (f: UnitTestFile): string => {
    const covered =
        (f.statements.covered ?? 0) +
        (f.branches.covered ?? 0) +
        (f.functions.covered ?? 0) +
        (f.lines.covered ?? 0);
    const total =
        (f.statements.total ?? 0) +
        (f.branches.total ?? 0) +
        (f.functions.total ?? 0) +
        (f.lines.total ?? 0);
    return `${covered}/${total}`;
};

const fileLink = (f: UnitTestFile): string | null => {
    if (!f.linktype) {
        return null;
    }
    const name = String(f.name);
    const target = targetOfCoverage({ ...f, name });
    const link = target && placeTarget(target, { name, file: f.filePath }, Configuration.mainData);
    return link ? hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor)) : null;
};

const fileGroupKey = (f: UnitTestFile): string => {
    if (f.linksubtype) {
        return f.linksubtype;
    }
    if (f.linktype) {
        return f.linktype;
    }
    return '_other';
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

export const UnitTestReport = (props: UnitTestReportProps): string => {
    const rawTotal = (props as any).data?.total;
    const stmts = rawTotal?.statements ?? { total: 0, covered: 0, coveragePercent: 0 };
    const branches = rawTotal?.branches ?? { total: 0, covered: 0, coveragePercent: 0 };
    const funcs = rawTotal?.functions ?? { total: 0, covered: 0, coveragePercent: 0 };
    const lines = rawTotal?.lines ?? { total: 0, covered: 0, coveragePercent: 0 };

    const overallPct = Math.round(
        ((stmts.coveragePercent ?? 0) +
            (branches.coveragePercent ?? 0) +
            (funcs.coveragePercent ?? 0) +
            (lines.coveragePercent ?? 0)) /
            4
    );
    const totalItems =
        (stmts.total ?? 0) + (branches.total ?? 0) + (funcs.total ?? 0) + (lines.total ?? 0);
    const coveredItems =
        (stmts.covered ?? 0) +
        (branches.covered ?? 0) +
        (funcs.covered ?? 0) +
        (lines.covered ?? 0);
    const uncoveredItems = totalItems - coveredItems;

    // File-level stats
    const validFiles = props.files.filter(f => f.name);
    const fullyCovered = validFiles.filter(f => filePct(f) === 100).length;
    const uncoveredFiles = validFiles.filter(f => filePct(f) === 0).length;
    const partialFiles = validFiles.length - fullyCovered - uncoveredFiles;

    // Group files by entity type
    const groups = new Map<string, UnitTestFile[]>();
    for (const f of validFiles) {
        const key = fileGroupKey(f);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(f);
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => {
        const ma = GROUP_META[a] ?? FALLBACK_META;
        const mb = GROUP_META[b] ?? FALLBACK_META;
        return ma.order - mb.order;
    });

    const hasGroups = sortedKeys.length > 0 && sortedKeys[0] !== '_other';

    return (
        <>
            <ol class="cdx-breadcrumb">
                <li class="">{t('unit-test-coverage')}</li>
            </ol>

            {CoverageSummary({
                donutHtml: DonutChart({
                    percent: overallPct,
                    documented: coveredItems,
                    partial: 0,
                    undocumented: uncoveredItems,
                    total: totalItems,
                    size: 'lg'
                }),
                stats: [
                    {
                        value: `${stmts.coveragePercent ?? 0}%`,
                        label: t('statements'),
                        subtitle: `${stmts.covered ?? 0}/${stmts.total ?? 0}`,
                        modifier:
                            (stmts.coveragePercent ?? 0) > 66
                                ? 'documented'
                                : (stmts.coveragePercent ?? 0) > 33
                                  ? 'partial'
                                  : 'undocumented'
                    },
                    {
                        value: `${branches.coveragePercent ?? 0}%`,
                        label: t('branches'),
                        subtitle: `${branches.covered ?? 0}/${branches.total ?? 0}`,
                        modifier:
                            (branches.coveragePercent ?? 0) > 66
                                ? 'documented'
                                : (branches.coveragePercent ?? 0) > 33
                                  ? 'partial'
                                  : 'undocumented'
                    },
                    {
                        value: `${funcs.coveragePercent ?? 0}%`,
                        label: t('functions'),
                        subtitle: `${funcs.covered ?? 0}/${funcs.total ?? 0}`,
                        modifier:
                            (funcs.coveragePercent ?? 0) > 66
                                ? 'documented'
                                : (funcs.coveragePercent ?? 0) > 33
                                  ? 'partial'
                                  : 'undocumented'
                    },
                    {
                        value: `${lines.coveragePercent ?? 0}%`,
                        label: t('lines'),
                        subtitle: `${lines.covered ?? 0}/${lines.total ?? 0}`,
                        modifier:
                            (lines.coveragePercent ?? 0) > 66
                                ? 'documented'
                                : (lines.coveragePercent ?? 0) > 33
                                  ? 'partial'
                                  : 'undocumented'
                    }
                ]
            })}

            <div class="cdx-ut-file-stats">
                <span class="cdx-ut-file-stat">{validFiles.length} files</span>
                <span class="cdx-ut-file-stat cdx-ut-file-stat--good">
                    {fullyCovered} fully covered
                </span>
                <span class="cdx-ut-file-stat cdx-ut-file-stat--warn">{partialFiles} partial</span>
                {uncoveredFiles > 0 && (
                    <span class="cdx-ut-file-stat cdx-ut-file-stat--bad">
                        {uncoveredFiles} uncovered
                    </span>
                )}
            </div>

            <div class="cdx-coverage-filter">
                <input
                    type="text"
                    class="cdx-coverage-filter-input"
                    placeholder="Filter files..."
                    aria-label="Filter unit test files"
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

            {hasGroups ? (
                sortedKeys.map(typeKey => {
                    const groupFiles = groups.get(typeKey)!;
                    const meta = GROUP_META[typeKey] ?? FALLBACK_META;

                    groupFiles.sort((a, b) => filePct(a) - filePct(b));

                    const groupFullyCovered = groupFiles.filter(f => filePct(f) === 100).length;

                    return (
                        <details open class="cdx-coverage-group" data-cdx-coverage-group={typeKey}>
                            <summary class="cdx-coverage-group-header">
                                {ChevronIcon()}
                                <span class={`cdx-badge ${meta.badge}`}>{meta.label}</span>
                                <span class="cdx-coverage-group-fraction">
                                    {groupFullyCovered}/{groupFiles.length}
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
                                            <span
                                                class="cdx-coverage-sort-arrow"
                                                aria-hidden="true"
                                            >
                                                {'\u25B2'}
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupFiles.map(f => {
                                        const pct = filePct(f);
                                        return (
                                            <tr
                                                data-cdx-coverage-name={(
                                                    f.name ?? ''
                                                ).toLowerCase()}
                                                data-cdx-coverage-file={f.filePath.toLowerCase()}
                                                data-cdx-coverage-pct={String(pct)}
                                            >
                                                <td>
                                                    {fileLink(f) ? (
                                                        <a href={fileLink(f)!}>{f.name}</a>
                                                    ) : (
                                                        f.name
                                                    )}
                                                </td>
                                                <td
                                                    class="cdx-coverage-file cdx-coverage-file-col"
                                                    title={f.filePath}
                                                >
                                                    {shortPath(f.filePath)}
                                                </td>
                                                <td class="cdx-coverage-cell">
                                                    <span
                                                        class={`cdx-coverage-pct ${coveragePctClass(pct)}`}
                                                    >
                                                        {pct}%
                                                    </span>
                                                    <span class="cdx-coverage-count-detail">
                                                        ({fileCovCount(f)})
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </details>
                    );
                })
            ) : (
                /* Fallback: flat table when no entity mapping available */
                <table class="cdx-coverage-table">
                    <thead>
                        <tr>
                            <th>{t('file')}</th>
                            <th>{t('coverage') || 'Coverage'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {validFiles
                            .sort((a, b) => filePct(a) - filePct(b))
                            .map(f => {
                                const pct = filePct(f);
                                return (
                                    <tr
                                        data-cdx-coverage-name={(f.name ?? '').toLowerCase()}
                                        data-cdx-coverage-file={f.filePath.toLowerCase()}
                                        data-cdx-coverage-pct={String(pct)}
                                    >
                                        <td class="cdx-coverage-file" title={f.filePath}>
                                            {shortPath(f.filePath)}
                                        </td>
                                        <td class="cdx-coverage-cell">
                                            <span
                                                class={`cdx-coverage-pct ${coveragePctClass(pct)}`}
                                            >
                                                {pct}%
                                            </span>
                                            <span class="cdx-coverage-count-detail">
                                                ({fileCovCount(f)})
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            )}
        </>
    ) as string;
};
