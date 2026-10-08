import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import {
    highlightedCodeWrap,
    isTabEnabled,
    linkTypeHtml,
    parseDescription,
    signalKindLabel,
    t
} from '../helpers';

type BlockInputProps = {
    readonly element: any;
    readonly file: string;
    readonly depth?: number;
    readonly navTabs?: any[];
};

const isUndefined = (v: unknown): boolean => v === undefined || v === 'undefined' || v === '';

export const BlockInput = (props: BlockInputProps): string => {
    const custom = renderCustomTemplate('block-input', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-inputs">
            <h3 id="inputs">
                {t('inputs')}
                <a class="cdx-member-permalink" href="#inputs">
                    #
                </a>
            </h3>
            {(props.element.inputsClass ?? []).map((inp: any) => {
                const cls = ['cdx-io-member'];
                if (inp.signalKind) {
                    cls.push(`cdx-io-member--${inp.signalKind}`);
                }
                if (inp.deprecated) {
                    cls.push('cdx-io-member--deprecated');
                }
                return (
                    <div class={cls.join(' ')} id={memberAnchor(inp.name)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${inp.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {inp.name}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(inp.name)}`}>
                                    #
                                </a>
                            </span>
                            {inp.type && (
                                <span class="cdx-io-member-type">{linkTypeHtml(inp.type)}</span>
                            )}
                        </div>
                        <div class="cdx-io-member-badges">
                            {inp.signalKind && (
                                <span class={`cdx-badge cdx-badge--${inp.signalKind}`}>
                                    {signalKindLabel(inp.signalKind)}
                                </span>
                            )}
                            {inp.alias && (
                                <span class="cdx-member-modifier">alias: {inp.alias}</span>
                            )}
                            {inp.required && (
                                <span class="cdx-badge cdx-badge--factory">Required</span>
                            )}
                        </div>
                        {inp.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(inp.description, props.depth ?? 0)}
                            </div>
                        )}
                        {!isUndefined(inp.defaultValue) && (
                            <div class="cdx-io-member-default">
                                <span class="cdx-io-member-default-label">default</span>{' '}
                                {highlightedCodeWrap(inp.defaultValue)}
                            </div>
                        )}
                        {inp.line && isTabEnabled(props.navTabs, 'source') && (
                            <div class="cdx-io-member-source">
                                {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                                <a href="#" data-cdx-line={String(inp.line)}>
                                    {props.element.file}:{inp.line}
                                </a>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    ) as string;
};
