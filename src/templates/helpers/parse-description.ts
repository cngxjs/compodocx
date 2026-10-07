import DependenciesEngine from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText } from '../../app/links/layout';
import { targetOfData } from '../../app/links/resolve';
import { extractLeadingText, splitLinkText } from '../../utils/link-parser';

/**
 * Process {@link ...} tags in a description string, resolving targets
 * via DependenciesEngine and building relative hrefs based on depth.
 */
export const parseDescription = (description: string, depth: number): string => {
    if (!description) {
        return '';
    }

    const tagRegExp = /\{@link\s+((?:.|\n)+?)\}/i;
    let result = description;

    // Clean up markdown-parsed <a> tags that got wrapped around @link targets
    if (result.indexOf('href=') !== -1) {
        const matches = result.match(/<a [^>]+>([^<]+)<\/a>/g);
        if (matches) {
            for (const _match of matches) {
                const parsed = /<a [^>]+>([^<]+)<\/a>/.exec(result);
                if (parsed && parsed.length === 2) {
                    const inner = parsed[1];
                    result = result.replace(
                        `{@link <a href="${encodeURI(inner)}">${inner}</a>`,
                        `{@link ${inner}`
                    );
                }
            }
        }
    }

    let previousResult: string;
    let matches: RegExpExecArray | null;
    do {
        previousResult = result;
        matches = tagRegExp.exec(result);
        if (!matches) {
            break;
        }

        const completeTag = matches[0];
        const text = matches[1];

        const leading = extractLeadingText(result, completeTag);
        const split = splitLinkText(text);

        let target = split.target;
        let anchor = '';
        if (target.indexOf('#') !== -1) {
            anchor = target.substring(target.indexOf('#'));
            target = target.substring(0, target.indexOf('#'));
        }

        const found = DependenciesEngine.findInCompodoc(
            typeof split.linkText !== 'undefined' ? split.target : target
        );

        // Determine what string to replace
        let stringToReplace: string;
        if (leading.leadingText !== undefined) {
            stringToReplace = `[${leading.leadingText}]${completeTag}`;
        } else if (typeof split.linkText !== 'undefined') {
            stringToReplace = completeTag;
        } else {
            stringToReplace = completeTag;
        }

        const foundTarget = found ? targetOfData(found, { detail: true }) : undefined;
        if (found && foundTarget) {
            let label = found.name;

            if (leading.leadingText !== undefined) {
                label = leading.leadingText;
            }
            if (typeof split.linkText !== 'undefined') {
                label = split.linkText;
            }

            const href = hrefFor(foundTarget, depth, anchor.slice(1) || undefined);
            const newLink = `<a href="${hrefText(href, 'description')}">${label}</a>`;
            result = result.replace(stringToReplace, newLink);
        } else {
            // External or unknown link
            const label = leading.leadingText ?? split.linkText ?? split.target;
            const href = split.target;
            const newLink = `<a href="${href}">${label}</a>`;
            result = result.replace(stringToReplace, newLink);
        }
    } while (matches && previousResult !== result);

    // Convert empty line placeholders
    result = result.replace(/___COMPODOC_EMPTY_LINE___/g, '\n');

    return result;
};
