import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import {
    functionSignature,
    hasJsdocParams,
    isTabEnabled,
    jsdocReturnsComment,
    linkTypeHtml,
    parseDescription,
    t
} from '../helpers';
import { ParamsTable } from './ParamsTable';

type BlockAccessorsProps = {
    readonly accessors: Record<string, any>;
    readonly file: string;
    readonly depth?: number;
    readonly navTabs?: any[];
};

export const BlockAccessors = (props: BlockAccessorsProps): string => {
    const custom = renderCustomTemplate('block-accessors', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-accessors">
            <h3 id="accessors">
                {t('accessors')}
                <a class="cdx-member-permalink" href="#accessors">
                    #
                </a>
            </h3>
            {Object.entries(props.accessors).map(([key, acc]) => {
                const isDeprecated = !!(
                    acc.getSignature?.deprecated || acc.setSignature?.deprecated
                );
                const returnType = acc.getSignature?.returnType;
                const cls = ['cdx-io-member'];
                if (isDeprecated) {
                    cls.push('cdx-io-member--deprecated');
                }

                return (
                    <div class={cls.join(' ')} id={memberAnchor(key)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${isDeprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {key}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(key)}`}>
                                    #
                                </a>
                            </span>
                            {returnType && (
                                <span class="cdx-io-member-type">{linkTypeHtml(returnType)}</span>
                            )}
                        </div>
                        <div class="cdx-io-member-badges">
                            {acc.getSignature && <span class="cdx-member-modifier">get</span>}
                            {acc.setSignature && <span class="cdx-member-modifier">set</span>}
                        </div>
                        {isDeprecated && (
                            <div class="cdx-member-deprecated">
                                {acc.getSignature?.deprecationMessage ||
                                    acc.setSignature?.deprecationMessage ||
                                    t('deprecated')}
                            </div>
                        )}
                        {acc.getSignature?.args?.length > 0 && (
                            <pre class="cdx-derived-body">
                                <code>{functionSignature(acc.getSignature)}</code>
                            </pre>
                        )}
                        {acc.setSignature?.args?.length > 0 && (
                            <pre class="cdx-derived-body">
                                <code>{functionSignature(acc.setSignature)}</code>
                            </pre>
                        )}
                        {acc.getSignature?.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(acc.getSignature.description, props.depth ?? 0)}
                            </div>
                        )}
                        {acc.setSignature?.description &&
                            acc.setSignature.description !== acc.getSignature?.description && (
                                <div class="cdx-io-member-desc">
                                    {parseDescription(
                                        acc.setSignature.description,
                                        props.depth ?? 0
                                    )}
                                </div>
                            )}
                        {acc.getSignature?.jsdoctags &&
                            hasJsdocParams(acc.getSignature.jsdoctags) && (
                                <div class="cdx-io-member-desc">
                                    {ParamsTable({
                                        jsdocTags: acc.getSignature.jsdoctags,
                                        depth: props.depth ?? 0,
                                        showOptional: true,
                                        showDefaultValue: false
                                    })}
                                </div>
                            )}
                        {acc.setSignature?.jsdoctags &&
                            hasJsdocParams(acc.setSignature.jsdoctags) && (
                                <div class="cdx-io-member-desc">
                                    {ParamsTable({
                                        jsdocTags: acc.setSignature.jsdoctags,
                                        depth: props.depth ?? 0,
                                        showOptional: true,
                                        showDefaultValue: false
                                    })}
                                </div>
                            )}
                        {returnType && acc.getSignature?.jsdoctags && (
                            <div class="cdx-io-member-desc">
                                {jsdocReturnsComment(acc.getSignature.jsdoctags)}
                            </div>
                        )}
                        {(() => {
                            const line = acc.getSignature?.line ?? acc.setSignature?.line;
                            return line && isTabEnabled(props.navTabs, 'source') ? (
                                <div class="cdx-io-member-source">
                                    {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                                    <a href="#" data-cdx-line={String(line)}>
                                        {props.file}:{line}
                                    </a>
                                </div>
                            ) : (
                                ''
                            );
                        })()}
                    </div>
                );
            })}
        </section>
    ) as string;
};
