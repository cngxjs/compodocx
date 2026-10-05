export { resolveBucketSegments } from './breadcrumb-bucket';
export { capitalize } from './capitalize';
export type { CoverageStats } from './coverage-stats';
export { computeCoverageStats } from './coverage-stats';
export { functionSignature } from './function-signature';
export { t } from './i18n';
export { indexableSignature } from './indexable-signature';
export type { ComponentPlaygroundBlock } from './jsdoc';
export {
    extractJsdocCodeExamples,
    extractJsdocExamples,
    extractJsdocParams,
    extractJsdocPlaygroundBlocks,
    hasJsdocParams,
    jsdocReturnsComment
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
    hasAnyApiSections,
    isApiSection,
    isInfoSection,
    isInitialTab,
    isTabEnabled,
    isThemingSection
} from './tab-helpers';

/** Check if a member has private or protected modifiers (SyntaxKind 123 = Private, 124 = Protected). */
export const isInternalMember = (modifierKind?: number[]): boolean =>
    (modifierKind ?? []).some(k => k === 123 || k === 124);

/** Wrap content in `<code>` (single-line) or `<pre>` (multi-line). Accepts pre-linked HTML. */
export const codeWrap = (html: unknown): string => {
    const str = String(html ?? '');
    if (!str) {
        return '';
    }
    const tag = str.includes('\n') || str.length > 80 ? 'pre' : 'code';
    return `<${tag}>${str}</${tag}>`;
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
