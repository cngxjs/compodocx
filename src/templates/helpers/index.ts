import Html from '@kitajs/html';

export { capitalize } from './capitalize';
export type { CoverageStats } from './coverage-stats';
export { computeCoverageStats } from './coverage-stats';
export { functionSignature } from './function-signature';
export { t } from './i18n';
export { indexableSignature } from './indexable-signature';
export type { ComponentPlaygroundBlock } from './jsdoc';
export {
    exampleComments,
    extractJsdocExamples,
    extractJsdocParams,
    extractJsdocPlaygroundBlocks,
    hasJsdocParams,
    jsdocReturnsComment,
    returnsHtml
} from './jsdoc';
export { linkTypeHtml, resolveType } from './link-type';
export { modifIcon, modifIconFromArray } from './modif-icon';
export { modifKind, modifSlug } from './modif-kind';
export { oneParameterHas } from './one-parameter-has';
export type { PagefindFilterInput, PagefindMetaInput } from './pagefind-meta';
export {
    deriveLibFromBucket,
    firstSentence,
    KIND_LABELS,
    KIND_LETTER,
    pagefindFilterBlock,
    pagefindMetaBlock
} from './pagefind-meta';
export { parseDescription } from './parse-description';
export { parseProperty } from './parse-property';
export { formatProvidedIn } from './provided-in';
export { relativeUrl } from './relative-url';
export { shortPath, shortUrl } from './short-url';
export { signalKindLabel } from './signal-kind';
export {
    isApiSection,
    isInfoSection,
    isInitialTab,
    isTabEnabled,
    isThemingSection
} from './tab-helpers';

const codeTag = (text: string): 'pre' | 'code' =>
    text.includes('\n') || text.length > 80 ? 'pre' : 'code';

/** Wrap content in `<code>` (single-line) or `<pre>` (multi-line). Accepts pre-linked HTML. */
export const codeWrap = (html: unknown): string => {
    const str = String(html ?? '');
    if (!str) {
        return '';
    }
    const tag = codeTag(str);
    return `<${tag}>${str}</${tag}>`;
};

/** Like `codeWrap` for plain source text: escapes it, picks the tag by the raw length. */
export const codeText = (text: unknown): string => {
    const str = String(text ?? '');
    if (!str) {
        return '';
    }
    const tag = codeTag(str);
    return `<${tag}>${Html.escapeHtml(str)}</${tag}>`;
};

export { highlightedCodeWrap } from './highlighted-code-wrap';

/** A readme that is only a heading (no paragraphs, lists, code blocks) is treated as empty. */
export const isReadmeEmpty = (readme: string | undefined): boolean => {
    if (!readme) {
        return true;
    }
    const stripped = readme
        .replaceAll(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi, '')
        .replaceAll(/<[^>]+>/g, '')
        .trim();
    return stripped.length === 0;
};

/** Extract heading HTML from readme (shown above empty state when readme is heading-only). */
export const extractReadmeHeadings = (readme: string | undefined): string => {
    if (!readme) {
        return '';
    }
    const headings = readme.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi);
    return headings ? headings.join('') : '';
};
