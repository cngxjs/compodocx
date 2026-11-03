import Html from '@kitajs/html';
import { AiGeneratedBanner } from '../components/AiGeneratedBadge';

type AdditionalPageProps = {
    readonly additionalPage: string;
    readonly aiGenerated?: string | true | false;
    readonly pageHeading?: string;
};

export const AdditionalPage = (props: AdditionalPageProps): string =>
    (
        <div class="cdx-readme">
            {AiGeneratedBanner({ aiGenerated: props.aiGenerated })}
            {props.pageHeading === undefined ? (
                ''
            ) : (
                <h1>{Html.escapeHtml(props.pageHeading) as string}</h1>
            )}
            {(props.additionalPage ?? '') as string}
        </div>
    ) as string;
