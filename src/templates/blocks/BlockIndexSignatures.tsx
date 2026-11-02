import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import {
    indexableSignature,
    indexSignatureAnchor,
    isTabEnabled,
    linkTypeHtml,
    parseDescription,
    t
} from '../helpers';

type BlockIndexSignaturesProps = {
    readonly indexables: any[];
    readonly file: string;
    readonly title?: string;
    readonly depth: number;
    readonly navTabs?: any[];
};

/**
 * Index signatures as member rows: the signature (`[key: string]`) stands in
 * for the name, the value type below it, as for properties.
 */
export const BlockIndexSignatures = (props: BlockIndexSignaturesProps): string => {
    const custom = renderCustomTemplate('block-index-signatures', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-indexables">
            <h3 id="indexables">
                {props.title ?? t('indexable')}
                <a class="cdx-member-permalink" href="#indexables">
                    #
                </a>
            </h3>
            {props.indexables.map((idx: any) => {
                const anchor = indexSignatureAnchor(idx);
                return (
                    <div class="cdx-io-member" id={anchor}>
                        <div class="cdx-io-member-head">
                            <div class="cdx-io-member-title">
                                <span class="cdx-io-member-name">
                                    {Html.escapeHtml(indexableSignature(idx))}
                                    <a class="cdx-member-permalink" href={`#${anchor}`}>
                                        #
                                    </a>
                                </span>
                                {idx.returnType && (
                                    <span class="cdx-io-member-type">
                                        {linkTypeHtml(idx.returnType, { depth: props.depth })}
                                    </span>
                                )}
                            </div>
                        </div>
                        {idx.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(idx.description, props.depth)}
                            </div>
                        )}
                        {idx.line && isTabEnabled(props.navTabs, 'source') && (
                            <div class="cdx-io-member-source">
                                {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                                <a href="#" data-cdx-line={String(idx.line)}>
                                    {props.file}:{idx.line}
                                </a>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    ) as string;
};
