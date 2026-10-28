import Html from '@kitajs/html';
import { AiGeneratedBadge, AiGeneratedNote } from '../components/AiGeneratedBadge';

type MarkdownProps = {
    readonly markdown: string;
    readonly aiGenerated?: string | true | false;
};

export const Markdown = (props: MarkdownProps): string =>
    (
        <div class="cdx-prose">
            {props.aiGenerated ? (
                <div class="cdx-ai-generated-banner">
                    {AiGeneratedBadge({ aiGenerated: props.aiGenerated })}
                    {AiGeneratedNote({
                        aiGenerated: props.aiGenerated,
                        class: 'cdx-ai-generated-note'
                    })}
                </div>
            ) : (
                ''
            )}
            {props.markdown ?? ''}
        </div>
    ) as string;
