import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import {
    functionSignature,
    hasJsdocParams,
    isTabEnabled,
    jsdocReturnsComment,
    linkTypeHtml,
    modifKind,
    parseDescription,
    t
} from '../helpers';
import { ParamsTable } from './ParamsTable';

type BlockMethodProps = {
    readonly methods: any[];
    readonly file: string;
    readonly title?: string;
    readonly depth?: number;
    readonly navTabs?: any[];
};

export const BlockMethod = (props: BlockMethodProps): string => {
    const custom = renderCustomTemplate('block-method', props);
    if (custom !== null) {
        return custom;
    }
    // `title: ''` is an explicit opt-out — collection pages and misc detail
    // pages wrap each block under their own section heading, so the inner
    // `<h3>methods</h3>` would render an empty heading with a stray permalink.
    const showHeading = props.title !== '';
    const headingText = props.title || t('methods');
    const headingId = props.title ? props.title.toLowerCase() : 'methods';
    return (
        <section data-compodoc="block-methods">
            {showHeading && (
                <h3 id={headingId}>
                    {headingText}
                    <a class="cdx-member-permalink" href={`#${headingId}`}>
                        #
                    </a>
                </h3>
            )}
            {props.methods.map((m: any) => {
                const cls = ['cdx-io-member', 'cdx-io-member--method'];
                if (m.deprecated) {
                    cls.push('cdx-io-member--deprecated');
                }
                return (
                    <div class={cls.join(' ')} id={memberAnchor(m.name)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${m.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {m.name}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(m.name)}`}>
                                    #
                                </a>
                            </span>
                            {m.returnType && (
                                <span class="cdx-io-member-type">{linkTypeHtml(m.returnType)}</span>
                            )}
                        </div>
                        <div class="cdx-io-member-badges">
                            {(m.modifierKind ?? []).map((k: number) => (
                                <span class="cdx-member-modifier">{modifKind(k)}</span>
                            ))}
                            {m.optional && <span class="cdx-member-modifier">{t('optional')}</span>}
                        </div>
                        {m.decorators?.length > 0 && (
                            <div class="cdx-member-decorators">
                                <code>
                                    {`${m.decorators
                                        .map((d: any) =>
                                            d.stringifiedArguments
                                                ? `@${d.name}(${d.stringifiedArguments})`
                                                : `@${d.name}()`
                                        )
                                        .join('<br />')}<br />`}
                                </code>
                            </div>
                        )}
                        {m.deprecated && m.deprecationMessage && (
                            <div class="cdx-member-deprecated">{m.deprecationMessage}</div>
                        )}
                        {m.args?.length > 0 && (
                            <pre class="cdx-derived-body">
                                <code>{functionSignature(m)}</code>
                            </pre>
                        )}
                        {m.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(m.description, props.depth ?? 0)}
                            </div>
                        )}
                        {m.jsdoctags && hasJsdocParams(m.jsdoctags) && (
                            <div class="cdx-io-member-desc">
                                {ParamsTable({
                                    jsdocTags: m.jsdoctags,
                                    depth: props.depth ?? 0,
                                    showOptional: true,
                                    showDefaultValue: true
                                })}
                            </div>
                        )}
                        {m.returnType && m.jsdoctags && (
                            <div class="cdx-io-member-desc">{jsdocReturnsComment(m.jsdoctags)}</div>
                        )}
                        {m.line && isTabEnabled(props.navTabs, 'source') && (
                            <div class="cdx-io-member-source">
                                {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                                <a href="#" data-cdx-line={String(m.line)}>
                                    {props.file}:{m.line}
                                </a>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    ) as string;
};
