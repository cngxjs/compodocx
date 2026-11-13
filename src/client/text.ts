import {
    type ClientTextKey,
    type ClientTexts,
    fillText,
    parseClientText
} from '../utils/client-text';

let texts: ClientTexts | undefined;

/** A text of the page language from `body[data-cdx-text]`, placeholders filled. */
export const clientText = (
    key: ClientTextKey,
    vars?: Readonly<Record<string, string | number>>
): string => {
    texts ??= parseClientText(document.body?.dataset.cdxText);
    return fillText(texts[key], vars);
};
