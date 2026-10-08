import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { pageFile, relativePrefix } from '../../app/links/layout';
import { t } from '../helpers';

/** Entry rendered as a chip in the Used by list. */
export interface ReferencedByEntry {
    readonly name: string;
    readonly kind: string;
    readonly hrefPrefix: string;
    /** File name of the page when it is not `name` (a cluster page). */
    readonly pageName?: string;
    /** Section on the page (a member of a cluster page). */
    readonly anchor?: string;
}

/** The `<a>` href of a backlink; depth is supplied by the page. */
export function referencedByHref(entry: ReferencedByEntry, depth: number): string {
    const page = pageFile(entry.hrefPrefix, entry.pageName ?? entry.name);
    return `${relativePrefix(Math.max(depth, 0), 'bare')}${page}${entry.anchor ? `#${entry.anchor}` : ''}`;
}

/**
 * Renders the "Used by" chip list: the documented symbols that use this one,
 * from the semantic analysis. Returns an empty string when `entries` is
 * missing or empty, so callers can inline the call without a guard.
 *
 * Overridable as `referenced-by` via `--templates`.
 */
export const ReferencedBySection = (props: {
    entries?: ReferencedByEntry[];
    depth: number;
}): string => {
    const entries = props.entries ?? [];
    if (entries.length === 0) {
        return '';
    }

    const custom = renderCustomTemplate('referenced-by', props);
    if (custom !== null) {
        return custom;
    }

    return SymbolChips({
        entries,
        depth: props.depth,
        id: 'used-by',
        title: t('used-by'),
        className: 'cdx-referenced-by',
        block: 'referenced-by'
    });
};

/** A headed chip list of links to symbol pages (Used by, Provided by, Injected by). */
export const SymbolChips = (props: {
    readonly entries: readonly ReferencedByEntry[];
    readonly depth: number;
    readonly id: string;
    readonly title: string;
    readonly className?: string;
    /** `data-compodoc` name of the section. */
    readonly block?: string;
}): string =>
    props.entries.length === 0
        ? ''
        : ((
              <section
                  class={`cdx-content-section${props.className ? ` ${props.className}` : ''}`}
                  data-compodoc={props.block}
              >
                  <h3 class="cdx-section-heading" id={props.id}>
                      {props.title}
                      <a class="cdx-member-permalink" href={`#${props.id}`}>
                          #
                      </a>
                  </h3>
                  <div class="cdx-chip-list">
                      {props.entries.map(entry => (
                          <a
                              class={`cdx-chip cdx-chip--${entry.kind}`}
                              href={referencedByHref(entry, props.depth)}
                              data-cdx-kind={entry.kind}
                          >
                              {entry.name}
                          </a>
                      ))}
                  </div>
              </section>
          ) as string);
