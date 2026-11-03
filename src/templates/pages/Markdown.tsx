import Html from '@kitajs/html';
import { AiGeneratedBanner } from '../components/AiGeneratedBadge';

type MarkdownProps = {
    readonly markdown: string;
    readonly aiGenerated?: string | true | false;
};

export const Markdown = (props: MarkdownProps): string =>
    (
        <div class="cdx-prose">
            {AiGeneratedBanner({ aiGenerated: props.aiGenerated })}
            {props.markdown ?? ''}
        </div>
    ) as string;
