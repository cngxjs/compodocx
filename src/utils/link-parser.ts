export function extractLeadingText(string, completeTag) {
    const tagIndex = string.indexOf(completeTag);
    let leadingText;
    const leadingTextRegExp = /\[(.+?)\]/g;
    let leadingTextInfo = leadingTextRegExp.exec(string);

    // did we find leading text, and if so, does it immediately precede the tag?
    while (leadingTextInfo?.length) {
        if (leadingTextInfo.index + leadingTextInfo[0].length === tagIndex) {
            string = string.replace(leadingTextInfo[0], '');
            leadingText = leadingTextInfo[1];
            break;
        }

        leadingTextInfo = leadingTextRegExp.exec(string);
    }

    return {
        leadingText: leadingText,
        string: string
    };
}

export function splitLinkText(text) {
    let linkText;
    let target;
    let splitIndex;

    // if a pipe is not present, we split on the first space
    splitIndex = text.indexOf('|');
    if (splitIndex === -1) {
        splitIndex = text.search(/\s/);
    }

    if (splitIndex !== -1) {
        linkText = text.substr(splitIndex + 1);
        // Normalize subsequent newlines to a single space.
        linkText = linkText.replace(/\n+/, ' ');
        target = text.substr(0, splitIndex);
    }

    return {
        linkText: linkText,
        target: target || text
    };
}

/**
 * Plain text with every inline `{@link}` (`{@linkcode}`, `{@linkplain}`)
 * replaced by its link text: the leading `[text]`, the text after `|` or
 * the first space, else the target. For excerpts that show no links;
 * expects text without HTML tags.
 */
export const linkTagsAsText = (text: string): string =>
    text
        .replace(/\[([^\]]+)\]\{@link(?:code|plain)?\s[^}]*\}/g, '$1')
        .replace(/\{@link(?:code|plain)?\s+([^}]*?)\s*\}/g, (_tag, inner: string) => {
            const split = splitLinkText(inner.trim());
            return (split.linkText ?? split.target).trim();
        });
