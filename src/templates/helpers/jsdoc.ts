import { kindToType } from '../../utils/kind-to-type';
import { escapeHtmlText } from './escape';
import { parseDescription } from './parse-description';

export type JsdocTag = {
    name?: string;
    type?: string;
    comment?: string;
    defaultValue?: string;
    optional?: boolean;
    [key: string]: unknown;
};

/** A JSDoc tag (TS node or marked copy) as far as these helpers read it. */
type JsdocTagSource = {
    readonly tagName?: { readonly text?: string };
    readonly comment?: string;
    readonly typeExpression?: {
        readonly type?: { readonly name?: { readonly text?: string }; readonly kind?: number };
    };
    readonly type?: string;
    readonly defaultValue?: string;
    readonly name?: string | { readonly text?: string };
    readonly optional?: boolean;
};

/** A tag read by the playground parsers; `comment` may be a TS `NodeArray`. */
type PlaygroundTagSource = {
    readonly tagName?: { readonly text?: string };
    readonly comment?: unknown;
};

/** Check if any JSDoc tag is a @param tag. */
export const hasJsdocParams = (tags: JsdocTagSource[]): boolean =>
    tags.some(tag => tag.tagName?.text === 'param');

/** Extract structured @param tags from JSDoc. */
export const extractJsdocParams = (jsdocTags: JsdocTagSource[]): JsdocTag[] => {
    const tags: JsdocTag[] = [];
    for (const jt of jsdocTags) {
        if (jt.tagName?.text !== 'param') {
            continue;
        }

        const tag: JsdocTag = {};
        if (jt.typeExpression?.type?.name) {
            tag.type = jt.typeExpression.type.name.text;
        } else if (jt.typeExpression?.type?.kind) {
            tag.type = kindToType(jt.typeExpression.type.kind);
        } else {
            tag.type = jt.type;
        }
        if (jt.comment) {
            tag.comment = jt.comment;
        }
        if (jt.defaultValue) {
            tag.defaultValue = jt.defaultValue;
        }
        tag.name = (jt.name as { readonly text?: string })?.text ?? (jt.name as string);
        if (jt.optional) {
            tag.optional = true;
        }
        tags.push(tag);
    }
    return tags;
};

type CodeBlock = { language: string; code: string };

function parseCodeFences(comment: string): CodeBlock[] {
    const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match: RegExpExecArray | null;
    let hasCodeFences = false;

    while ((match = regex.exec(comment)) !== null) {
        hasCodeFences = true;
        let lang = (match[1] || 'html').toLowerCase();
        if (lang === 'js') {
            lang = 'javascript';
        }
        if (lang === 'ts') {
            lang = 'typescript';
        }
        let code = match[2].replaceAll('___COMPODOC_EMPTY_LINE___', '\n').trim();
        code = code.replaceAll(/```[\s\S]*?```/g, '');
        if (code.length > 0) {
            blocks.push({ language: lang, code });
        }
    }

    if (!hasCodeFences) {
        const trimmed = comment.trim();
        if (trimmed.length > 0) {
            blocks.push({ language: 'html', code: trimmed });
        }
    }
    return blocks;
}

/** Extract @example tags with code fence parsing (rendered as <pre><code>). */
export const extractJsdocCodeExamples = (jsdocTags: JsdocTagSource[]): JsdocTag[] => {
    const tags: JsdocTag[] = [];
    for (const jt of jsdocTags) {
        if (jt.tagName?.text !== 'example' || !jt.comment) {
            continue;
        }

        let comment = jt.comment;
        const captionMatch = comment.match(/<caption>([\s\S]*?)<\/caption>/);
        if (captionMatch) {
            tags.push({ comment: `<b><i>${captionMatch[1]}</i></b>` });
            comment = comment.replace(/<caption>[\s\S]*?<\/caption>/, '').trim();
        }

        for (const block of parseCodeFences(comment)) {
            tags.push({
                comment: `<pre class="cdx-code-example"><code class="language-${block.language}">${escapeHtmlText(block.code)}</code></pre>`
            });
        }
    }
    return tags;
};

/** Extract @example tags (simple - caption replacement only). */
export const extractJsdocExamples = (jsdocTags: JsdocTagSource[]): JsdocTag[] => {
    const tags: JsdocTag[] = [];
    for (const jt of jsdocTags) {
        if (jt.tagName?.text !== 'example') {
            continue;
        }
        const comment = (jt.comment ?? '')
            .replaceAll('<caption>', '<b><i>')
            .replaceAll('/caption>', '/b></i>');
        tags.push({ comment });
    }
    return tags;
};

/**
 * One runnable playground block parsed from a `@playground <title>` JSDoc tag.
 * Surfaced on `IComponentDep.playgrounds` and consumed by the StackBlitz
 * project-builder. The `line` field is a zero-based offset relative to the
 * start of the source `tag.comment` text, pointing at the fence-open line
 * (inline mode) or the title line (file-ref mode).
 *
 * Two mutually-exclusive payload modes:
 *  - inline:    `snippet` + `language` set, `fileRef` undefined.
 *  - file-ref:  `fileRef` set (relative `.html` or `.ts` path), `snippet` and
 *               `language` undefined. The builder pipeline resolves the path
 *               against the host file before manifest assembly.
 */
export type ComponentPlaygroundBlock = {
    title: string;
    snippet?: string;
    language?: string;
    line: number;
    fileRef?: string;
};

const FENCE_BLOCK_REGEX = /```(\w+)?[ \t]*\r?\n([\s\S]*?)```/;

/**
 * Path-suffix detector for the file-ref form. Matches when the title line
 * ends with a relative `.html`/`.ts` token preceded by whitespace OR start
 * of line. `(?:^|\s)` lets a path-only title (`@playground ./foo.html`) be
 * detected so it can be reported as missing-title rather than silently
 * sliding into the inline path and warning about a missing fenced body.
 */
const PLAYGROUND_PATH_SUFFIX = /(?:^|\s)(\.\.?\/[^\s]+\.(?:html|ts))\s*$/;

const readTagComment = (tag: PlaygroundTagSource | undefined): string => {
    const c = tag?.comment;
    if (typeof c === 'string') {
        return c;
    }
    if (Array.isArray(c)) {
        return c.map((part: { readonly text?: string } | undefined) => part?.text ?? '').join('');
    }
    return '';
};

/**
 * Parse `@playground <title>` JSDoc blocks. Each block becomes one runnable
 * section on the Playground tab. Title is required; missing titles or unfenced
 * bodies produce a warning and the block is silently dropped.
 *
 * Returns the parsed blocks plus a list of warnings the caller can route to
 * `logger.warn`. No `console.log` inside this helper (build-path discipline).
 */
export const extractJsdocPlaygroundBlocks = (
    jsdocTags: PlaygroundTagSource[]
): { blocks: ComponentPlaygroundBlock[]; warnings: string[] } => {
    const blocks: ComponentPlaygroundBlock[] = [];
    const warnings: string[] = [];
    if (!Array.isArray(jsdocTags)) {
        return { blocks, warnings };
    }

    for (const jt of jsdocTags) {
        if (jt?.tagName?.text !== 'playground') {
            continue;
        }
        const raw = readTagComment(jt);
        const lines = raw.split(/\r?\n/);

        // Title is the first non-empty line (TS strips the @tag prefix and
        // leaves everything after `@playground ` in `comment`).
        let titleLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().length > 0) {
                titleLine = i;
                break;
            }
        }
        if (titleLine === -1 || lines[titleLine].trim().startsWith('```')) {
            warnings.push('@playground block dropped: missing title');
            continue;
        }

        const rawTitleLine = lines[titleLine].trim();
        const fenceSearch = lines.slice(titleLine + 1).join('\n');

        // File-ref form: trailing `.html` / `.ts` path token on the title line.
        // Mutually exclusive with a fenced body - having both is ambiguous and
        // dropped with a warning so the author can pick one.
        const pathMatch = rawTitleLine.match(PLAYGROUND_PATH_SUFFIX);
        if (pathMatch) {
            const fileRef = pathMatch[1];
            const titleBeforePath = rawTitleLine.slice(0, pathMatch.index ?? 0).trim();
            if (!titleBeforePath) {
                warnings.push('@playground block dropped: missing title');
                continue;
            }
            if (FENCE_BLOCK_REGEX.test(fenceSearch)) {
                warnings.push(
                    `@playground block "${titleBeforePath}" dropped: fileRef and fenced body are mutually exclusive`
                );
                continue;
            }
            blocks.push({ title: titleBeforePath, fileRef, line: titleLine });
            continue;
        }

        const title = rawTitleLine;
        const fenceMatch = fenceSearch.match(FENCE_BLOCK_REGEX);
        if (!fenceMatch) {
            warnings.push(`@playground block "${title}" dropped: no fenced code body`);
            continue;
        }

        let language = (fenceMatch[1] || 'html').toLowerCase();
        if (language === 'js') {
            language = 'javascript';
        }
        if (language === 'ts') {
            language = 'typescript';
        }
        const snippet = fenceMatch[2].replaceAll('___COMPODOC_EMPTY_LINE___', '\n').trimEnd();

        // Fence-open line, zero-indexed against the start of `tag.comment`.
        const fenceOffset = fenceSearch.slice(0, fenceMatch.index ?? 0).split('\n').length - 1;
        const line = titleLine + 1 + fenceOffset;

        blocks.push({ title, snippet, language, line });
    }
    return { blocks, warnings };
};

// A relative `.ts` path token - the only valid `@playgroundConfig` value.
const PLAYGROUND_CONFIG_PATH = /^(\.\.?\/[^\s]+\.ts)$/;

/**
 * Parse a component-level `@playgroundConfig <path>` tag - the supported way to
 * ship an `app.config.ts` (with `provideRouter`, interceptors, …) into the
 * component's `@playground` projects and wire `bootstrapApplication(App,
 * appConfig)`. Replaces the undocumented `export { appConfig } from
 * './app.config'` re-export trick (which still works for back-compat).
 *
 * One per component (applies to every `@playground` block on it). The
 * referenced file must be a relative `.ts` path and export `appConfig`. Extra
 * tags after the first are ignored with a warning.
 */
export const extractJsdocPlaygroundConfig = (
    jsdocTags: PlaygroundTagSource[]
): { configRef?: string; warnings: string[] } => {
    const warnings: string[] = [];
    if (!Array.isArray(jsdocTags)) {
        return { warnings };
    }
    let configRef: string | undefined;
    for (const jt of jsdocTags) {
        if (jt?.tagName?.text !== 'playgroundConfig') {
            continue;
        }
        const value = readTagComment(jt).trim();
        const match = value.match(PLAYGROUND_CONFIG_PATH);
        if (!match) {
            warnings.push(
                `@playgroundConfig dropped: expected a relative .ts path, got "${value || '<empty>'}"`
            );
            continue;
        }
        if (configRef !== undefined) {
            warnings.push(
                `@playgroundConfig "${match[1]}" ignored: only one is allowed per component`
            );
            continue;
        }
        configRef = match[1];
    }
    return { configRef, warnings };
};

/** Get the comment from the first @returns/@return tag. */
export const jsdocReturnsComment = (jsdocTags: JsdocTagSource[]): string => {
    for (const jt of jsdocTags) {
        if (jt.tagName?.text === 'returns' || jt.tagName?.text === 'return') {
            return jt.comment ?? '';
        }
    }
    return '';
};

/** The first @returns/@return comment with its links resolved for a page at `depth`. */
export const returnsHtml = (jsdocTags: JsdocTagSource[], depth: number): string =>
    parseDescription(jsdocReturnsComment(jsdocTags), depth);
