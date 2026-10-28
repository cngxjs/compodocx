import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { t } from '../helpers';
import { aiGeneratedNoteText } from '../helpers/ai-generated-note';
import { escapeHtmlText } from '../helpers/escape';

type AiGeneratedBadgeProps = {
    readonly aiGenerated?: string | true | false;
};

/**
 * Small chip shown on entity heroes and markdown pages whose source is
 * tagged with `@aiGenerated` (JSDoc) or `<!-- @aiGenerated -->`
 * (markdown). The marker value shows in the visible note next to it.
 */
export const AiGeneratedBadge = (props: AiGeneratedBadgeProps): string => {
    if (!props.aiGenerated) {
        return '' as string;
    }
    return (
        <span class="cdx-badge cdx-badge--ai-generated" title={t('ai-generated-tooltip')}>
            {t('ai-generated')}
        </span>
    ) as string;
};

type AiGeneratedNoteProps = AiGeneratedBadgeProps & {
    /** Wrapper class; the markdown banner and the entity hero style it differently. */
    readonly class: string;
};

/**
 * The visible sentence for an `@aiGenerated` marker: the `aiGeneratedNote`
 * config text, or the translated default with the marker value.
 */
export const AiGeneratedNote = (props: AiGeneratedNoteProps): string => {
    if (!props.aiGenerated) {
        return '' as string;
    }
    const text = aiGeneratedNoteText(
        props.aiGenerated,
        Configuration.mainData.aiGeneratedNote ?? '',
        t
    );
    return (<p class={props.class}>{escapeHtmlText(text)}</p>) as string;
};
