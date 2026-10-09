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

type BlockDerivedStateProps = {
    readonly properties: any[];
    readonly allSignalProps: any[];
    readonly file: string;
    readonly depth?: number;
    readonly navTabs?: any[];
};

/**
 * Filter signalDeps per spec: plain property access is always kept; a call
 * (name ending in `()`) is kept only when the callee resolves to a known
 * signal property on the class.
 */
const filterDeps = (rawDeps: readonly string[], signalNames: ReadonlySet<string>): string[] => {
    return rawDeps.filter(dep => {
        if (dep.endsWith('()')) {
            return signalNames.has(dep.slice(0, -2));
        }
        return true;
    });
};

export const BlockDerivedState = (props: BlockDerivedStateProps): string => {
    const custom = renderCustomTemplate('block-derived-state', props);
    if (custom !== null) {
        return custom;
    }
    const signalNames = new Set<string>(
        props.allSignalProps.filter((p: any) => p.signalKind).map((p: any) => p.name)
    );

    return (
        <section data-compodoc="block-derived-state">
            <h3 id="derived-state">
                {t('derived-state')}
                <a class="cdx-member-permalink" href="#derived-state">
                    #
                </a>
            </h3>
            {props.properties.map((p: any) => {
                const cls = ['cdx-io-member'];
                if (p.signalKind) {
                    cls.push(`cdx-io-member--${p.signalKind}`);
                }
                if (p.deprecated) {
                    cls.push('cdx-io-member--deprecated');
                }

                const deps = filterDeps(p.signalDeps ?? [], signalNames);
                const hasDesc = !!p.description;
                const hasDeps = deps.length > 0;

                return (
                    <div class={cls.join(' ')} id={memberAnchor(p.name)}>
                        <div class="cdx-io-member-title">
                            <span
                                class={`cdx-io-member-name${p.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {p.name}
                                <a class="cdx-member-permalink" href={`#${memberAnchor(p.name)}`}>
                                    #
                                </a>
                            </span>
                            {p.type && (
                                <span class="cdx-io-member-type">{linkTypeHtml(p.type)}</span>
                            )}
                        </div>
                        <div class="cdx-io-member-badges">
                            {p.signalKind && (
                                <span class={`cdx-badge cdx-badge--${p.signalKind}`}>
                                    {signalKindLabel(p.signalKind)}
                                </span>
                            )}
                        </div>
                        {(hasDesc || hasDeps) && (
                            <div class="cdx-io-member-desc">
                                {hasDesc && parseDescription(p.description, props.depth ?? 0)}
                                {hasDeps && (
                                    <p>
                                        {'Derives from '}
                                        {deps.map((dep, i) => (
                                            <>
                                                {i > 0 && ' \u00B7 '}
                                                <code>{dep}</code>
                                            </>
                                        ))}
                                        {'.'}
                                    </p>
                                )}
                            </div>
                        )}
                        {p.defaultValue && highlightedCodeWrap(p.defaultValue)}
                        {p.line && isTabEnabled(props.navTabs, 'source') && (
                            <div class="cdx-io-member-source">
                                {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                                <a href="#" data-cdx-line={String(p.line)}>
                                    {props.file}:{p.line}
                                </a>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    ) as string;
};
