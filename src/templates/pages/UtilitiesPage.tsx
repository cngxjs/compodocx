import Html from '@kitajs/html';
import { factKey, type SemanticModel } from '../../app/compiler/semantic/model';
import { type DiView, isHidden } from '../../app/di/model';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { hrefFor, hrefText, KIND_FOLDER, type UtilityKind } from '../../app/links/layout';
import { symbolTarget } from '../../app/links/resolve';
import { toSymbolKey } from '../../app/links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';
import { IconCube } from '../components/Icons';
import { firstSentence, t } from '../helpers';

/**
 * The Utilities landing page (`utilities.html`): every function, constant,
 * type alias and enum, one table per group, each row linking to the
 * symbol's own page.
 *
 * Override name: `utilities`.
 */

interface UtilityGroup {
    readonly kind: UtilityKind;
    readonly titleKey: string;
}

const GROUPS: readonly UtilityGroup[] = [
    { kind: 'function', titleKey: 'functions' },
    { kind: 'variable', titleKey: 'variables' },
    { kind: 'typealias', titleKey: 'type-aliases' },
    { kind: 'enumeration', titleKey: 'enums' }
];

/** Section id of a group; the symbol pages link back to it. */
export const utilityGroupAnchor = (kind: UtilityKind): string => KIND_FOLDER[kind];

const entriesOf = (
    table: SymbolTable | undefined,
    view: DiView | undefined,
    kind: UtilityKind
): SymbolEntry[] =>
    [...(table?.byId.values() ?? [])]
        .filter(entry => entry.ref.kind === kind && !isHidden(view, entry.id))
        .sort((a, b) => a.ref.name.localeCompare(b.ref.name));

const usedByCount = (entry: SymbolEntry, semantic: SemanticModel | undefined): number =>
    semantic?.facts.get(factKey(toSymbolKey(entry.ref)))?.usedBy.length ?? 0;

const Row = (entry: SymbolEntry, depth: number, semantic: SemanticModel | undefined): string => {
    const description = (entry.data as { description?: unknown }).description;
    const href = hrefText(hrefFor(symbolTarget(entry, { duplicate: true }), depth));
    const summary = firstSentence(description);
    return (
        <tr data-cdx-misc-name={entry.ref.name.toLowerCase()}>
            <td>
                <a href={href}>
                    <code>{entry.ref.name}</code>
                </a>
            </td>
            <td>{summary ?? ''}</td>
            <td>{semantic ? String(usedByCount(entry, semantic)) : ''}</td>
        </tr>
    ) as string;
};

const Group = (
    group: UtilityGroup,
    entries: readonly SymbolEntry[],
    depth: number,
    semantic: SemanticModel | undefined
): string => {
    if (entries.length === 0) {
        return '';
    }
    const id = utilityGroupAnchor(group.kind);
    return (
        <section class="cdx-content-section" id={id}>
            <h2 class="cdx-section-heading">
                {t(group.titleKey)}
                <span class="cdx-badge cdx-badge--count">{entries.length}</span>
                <a class="cdx-member-permalink" href={`#${id}`}>
                    #
                </a>
            </h2>
            <table class="cdx-table">
                <thead>
                    <tr>
                        <th scope="col">{t('name')}</th>
                        <th scope="col">{t('description')}</th>
                        <th scope="col">{semantic ? t('used-by') : ''}</th>
                    </tr>
                </thead>
                <tbody>{entries.map(entry => Row(entry, depth, semantic))}</tbody>
            </table>
        </section>
    ) as string;
};

export const UtilitiesPage = (data: any): string => {
    const custom = renderCustomTemplate('utilities', data);
    if (custom !== null) {
        return custom;
    }
    const table: SymbolTable | undefined = data.symbols;
    const semantic: SemanticModel | undefined = data.semantic;
    const depth: number = data.depth ?? 0;
    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-text-secondary)">
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconCube()}
                </div>
                <h1 class="cdx-entity-hero-name">
                    <span>{t('utilities')}</span>
                </h1>
            </div>
            <div class="cdx-misc-filter">
                <input
                    type="text"
                    class="cdx-coverage-filter-input"
                    placeholder={t('filter-entities')}
                    aria-label={t('filter-entities')}
                    data-cdx-misc-filter
                />
                <button
                    type="button"
                    class="cdx-coverage-filter-clear"
                    aria-label={t('reset')}
                    data-cdx-misc-filter-clear
                >
                    &times;
                </button>
            </div>
            <div class="cdx-coverage-no-results" data-cdx-misc-no-results>
                {t('no-matching-entities')}
            </div>
            <div class="cdx-utilities-content">
                {GROUPS.map(group =>
                    Group(group, entriesOf(table, data.di, group.kind), depth, semantic)
                )}
            </div>
        </>
    ) as string;
};
