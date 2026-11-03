import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { t } from '../helpers';
import { aiGeneratedNoteText } from '../helpers/ai-generated-note';
import { escapeHtmlText } from '../helpers/escape';

type AiGeneratedBadgeProps = {
    readonly aiGenerated?: string | true | false;
};

/** The marker when it is shown; `hideAiGeneratedBadge` hides every marker in the HTML. */
const shownMarker = (aiGenerated: string | true | false | undefined): string | true | false =>
    Configuration.mainData.hideAiGeneratedBadge ? false : (aiGenerated ?? false);

/**
 * Small chip shown on entity heroes and markdown pages whose source is
 * tagged with `@aiGenerated` (JSDoc) or `<!-- @aiGenerated -->`
 * (markdown). The marker value shows in the visible note next to it. None
 * of the three renders with `hideAiGeneratedBadge`.
 */
export const AiGeneratedBadge = (props: AiGeneratedBadgeProps): string => {
    if (!shownMarker(props.aiGenerated)) {
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
    const marker = shownMarker(props.aiGenerated);
    if (!marker) {
        return '' as string;
    }
    const text = aiGeneratedNoteText(marker, Configuration.mainData.aiGeneratedNote ?? '', t);
    return (<p class={props.class}>{escapeHtmlText(text)}</p>) as string;
};

/**
 * Banner above Markdown content marked `<!-- @aiGenerated [value] -->`:
 * the chip and the note. Used by root Markdown pages, additional pages and
 * the README tab of entity pages.
 */
export const AiGeneratedBanner = (props: AiGeneratedBadgeProps): string => {
    if (!shownMarker(props.aiGenerated)) {
        return '' as string;
    }
    return (
        <div class="cdx-ai-generated-banner">
            {AiGeneratedBadge({ aiGenerated: props.aiGenerated })}
            {AiGeneratedNote({ aiGenerated: props.aiGenerated, class: 'cdx-ai-generated-note' })}
        </div>
    ) as string;
};
