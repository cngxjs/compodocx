import Html from '@kitajs/html';
import { extractJsdocParams, linkTypeHtml, oneParameterHas, parseDescription } from '../helpers';

type ParamsTableProps = {
    readonly jsdocTags: any[];
    readonly depth: number;
    /** Page depth for type links; omitted keeps the depth-1 default of `linkTypeHtml`. */
    readonly typeLinkDepth?: number;
    readonly showOptional?: boolean;
    readonly showDefaultValue?: boolean;
};

/** Render a JSDoc @param list as Angular.dev-style inline definitions. */
export const ParamsTable = (props: ParamsTableProps): string => {
    const tags = extractJsdocParams(props.jsdocTags);
    if (tags.length === 0) {
        return '';
    }

    const hasComment = oneParameterHas(tags, 'comment');
    const hasDefault = props.showDefaultValue !== false && oneParameterHas(tags, 'defaultValue');

    return (
        <div class="cdx-params">
            {tags.map(tag => (
                <div class="cdx-param-row">
                    <div class="cdx-param-header">
                        <span class="cdx-param-label">@param</span>
                        {tag.name && (
                            <span class="cdx-param-name">
                                {tag.name}
                                {tag.optional ? '?' : ''}
                            </span>
                        )}
                        {tag.type && (
                            <span class="cdx-param-type">
                                {linkTypeHtml(tag.type, { depth: props.typeLinkDepth })}
                            </span>
                        )}
                        {hasDefault && tag.defaultValue && (
                            <span class="cdx-param-default">
                                = <code>{tag.defaultValue}</code>
                            </span>
                        )}
                    </div>
                    {hasComment && tag.comment && (
                        <div class="cdx-param-desc">
                            {parseDescription(tag.comment, props.depth)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    ) as string;
};
