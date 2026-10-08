import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import { codeWrap, parseDescription, t } from '../helpers';

type EnumChild = {
    readonly name?: string;
    readonly value?: string;
    readonly deprecated?: boolean;
    readonly deprecationMessage?: string;
};
type EnumItem = {
    readonly name: string;
    readonly deprecated?: boolean;
    readonly deprecationMessage?: string;
    readonly description?: string;
    readonly childs?: EnumChild[];
};

type BlockEnumProps = {
    readonly enums: EnumItem[];
    readonly depth?: number;
};

export const BlockEnum = (props: BlockEnumProps): string => {
    const custom = renderCustomTemplate('block-enum', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-enums">
            {props.enums.map(e => {
                const cls = ['cdx-io-member', 'cdx-io-member--enumeration'];
                if (e.deprecated) {
                    cls.push('cdx-io-member--deprecated');
                }
                const members = e.childs ?? [];
                return (
                    <div class={cls.join(' ')} id={memberAnchor(e.name)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${e.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {e.name}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(e.name)}`}>
                                    #
                                </a>
                            </span>
                        </div>
                        {e.deprecated && e.deprecationMessage && (
                            <div class="cdx-member-deprecated">{e.deprecationMessage}</div>
                        )}
                        {e.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(e.description, props.depth ?? 0)}
                            </div>
                        )}
                        {members.length > 0 && (
                            <ul class="cdx-enum-members">
                                {members.map(child => {
                                    if (!child.name) {
                                        return '';
                                    }
                                    return (
                                        <li>
                                            <code
                                                class={
                                                    child.deprecated
                                                        ? 'cdx-member-name--deprecated'
                                                        : ''
                                                }
                                            >
                                                {child.name}
                                            </code>
                                            {child.value && (
                                                <>
                                                    {' = '}
                                                    {codeWrap(child.value)}
                                                </>
                                            )}
                                            {child.deprecated && (
                                                <span class="cdx-badge cdx-badge--deprecated">
                                                    {child.deprecationMessage || t('deprecated')}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                );
            })}
        </section>
    ) as string;
};
