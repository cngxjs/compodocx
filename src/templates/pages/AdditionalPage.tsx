import Html from '@kitajs/html';
import { AiGeneratedBadge, AiGeneratedNote } from '../components/AiGeneratedBadge';

type AdditionalPageProps = {
    readonly additionalPage: string;
    readonly aiGenerated?: string | true | false;
    readonly pageHeading?: string;
};

export const AdditionalPage = (props: AdditionalPageProps): string =>
    (
        <div class="cdx-readme">
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
            {props.pageHeading === undefined ? (
                ''
            ) : (
                <h1>{Html.escapeHtml(props.pageHeading) as string}</h1>
            )}
            {(props.additionalPage ?? '') as string}
        </div>
    ) as string;
