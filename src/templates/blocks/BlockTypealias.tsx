import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import { codeWrap, functionSignature, linkTypeHtml, parseDescription, t } from '../helpers';

type TypealiasItem = {
    readonly name: string;
    readonly kind?: number;
    readonly deprecated?: boolean;
    readonly deprecationMessage?: string;
    readonly description?: string;
    readonly modifierKind?: number[];
    readonly rawtype?: string;
    readonly args?: any[];
    [key: string]: unknown;
};

type BlockTypealiasProps = {
    readonly typealias: TypealiasItem[];
    readonly depth?: number;
};

export const BlockTypealias = (props: BlockTypealiasProps): string => {
    const custom = renderCustomTemplate('block-typealias', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-typealias">
            {props.typealias.map(ta => {
                const cls = ['cdx-io-member', 'cdx-io-member--typealias'];
                if (ta.deprecated) {
                    cls.push('cdx-io-member--deprecated');
                }
                const body =
                    ta.kind === 160
                        ? codeWrap(functionSignature(ta))
                        : codeWrap(linkTypeHtml(ta.rawtype ?? ''));
                return (
                    <div class={cls.join(' ')} id={memberAnchor(ta.name)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${ta.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {ta.name}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(ta.name)}`}>
                                    #
                                </a>
                            </span>
                        </div>
                        {ta.deprecated && ta.deprecationMessage && (
                            <div class="cdx-member-deprecated">{ta.deprecationMessage}</div>
                        )}
                        {ta.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(ta.description, props.depth ?? 0)}
                            </div>
                        )}
                        <div class="cdx-io-member-default">{body}</div>
                    </div>
                );
            })}
        </section>
    ) as string;
};
