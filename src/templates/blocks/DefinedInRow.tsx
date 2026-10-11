import Html from '@kitajs/html';
import { isTabEnabled, linkTypeHtml, t } from '../helpers';

type DefinedInRowProps = {
    readonly line?: number;
    readonly file: string;
    readonly inheritance?: { readonly file: string };
    readonly navTabs?: any[];
    readonly depth: number;
};

/** Render "Inherited from" + "Defined in" rows for a member card. */
export const DefinedInRow = (props: DefinedInRowProps): string => {
    if (!props.line || !isTabEnabled(props.navTabs, 'source')) {
        return '';
    }

    return (
        <>
            {props.inheritance && (
                <div class="cdx-member-row">
                    {t('inherited-from')}{' '}
                    {linkTypeHtml(props.inheritance.file, { depth: props.depth })}
                </div>
            )}
            <div class="cdx-member-row">
                {props.inheritance ? (
                    <span>
                        {t('defined-in')}{' '}
                        {linkTypeHtml(props.inheritance.file, {
                            depth: props.depth,
                            withLine: true,
                            line: props.line
                        })}
                    </span>
                ) : (
                    <span>
                        {t('defined-in')}{' '}
                        {/* biome-ignore lint/a11y/useValidAnchor: href rewritten by client JS via data-cdx-line */}
                        <a href="#" data-cdx-line={String(props.line)} class="cdx-link-to-source">
                            {props.file}:{props.line}
                        </a>
                    </span>
                )}
            </div>
        </>
    ) as string;
};
