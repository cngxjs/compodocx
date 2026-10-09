import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import { isTabEnabled, linkTypeHtml, parseDescription, signalKindLabel, t } from '../helpers';

type BlockOutputProps = {
    readonly element: any;
    readonly file: string;
    readonly depth?: number;
    readonly navTabs?: any[];
};

export const BlockOutput = (props: BlockOutputProps): string => {
    const custom = renderCustomTemplate('block-output', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-outputs">
            <h3 id="outputs">
                {t('outputs')}
                <a class="cdx-member-permalink" href="#outputs">
                    #
                </a>
            </h3>
            {(props.element.outputsClass ?? []).map((out: any) => {
                const cls = ['cdx-io-member'];
                if (out.signalKind) {
                    cls.push(`cdx-io-member--${out.signalKind}`);
                }
                if (out.deprecated) {
                    cls.push('cdx-io-member--deprecated');
                }
                return (
                    <div class={cls.join(' ')} id={memberAnchor(out.name)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${out.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {out.name}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(out.name)}`}>
                                    #
                                </a>
                            </span>
                            {out.type && (
                                <span class="cdx-io-member-type">{linkTypeHtml(out.type)}</span>
                            )}
                        </div>
                        <div class="cdx-io-member-badges">
                            {out.signalKind && (
                                <span class={`cdx-badge cdx-badge--${out.signalKind}`}>
                                    {signalKindLabel(out.signalKind)}
                                </span>
                            )}
                            {out.alias && (
                                <span class="cdx-member-modifier">alias: {out.alias}</span>
                            )}
                        </div>
                        {out.description && (
                            <div class="cdx-io-member-desc">
                                {parseDescription(out.description, props.depth ?? 0)}
                            </div>
                        )}
                        {out.line && isTabEnabled(props.navTabs, 'source') && (
                            <div class="cdx-io-member-source">
                                {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                                <a href="#" data-cdx-line={String(out.line)}>
                                    {props.element.file}:{out.line}
                                </a>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    ) as string;
};
