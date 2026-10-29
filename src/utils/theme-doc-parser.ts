import * as path from 'node:path';
import * as fs from 'fs-extra';
import { logger } from './logger';

/**
 * A single documented theming token extracted from an SCSS or CSS source file.
 *
 * The parser is deliberately tolerant: every field except `name`, `kind`, `file`
 * and `line` may be empty. A tag the parser does not know is left out of the
 * token and reported in `ParsedStyleResult.unknownTags`.
 */
export type ThemeTokenKind =
    | 'css-custom-property'
    | 'scss-variable'
    | 'css-at-property'
    | 'css-hook';

export interface ThemeToken {
    /** Variable name including prefix: `--cngx-alert-padding` or `$alert-padding` */
    name: string;
    /**
     * Source kind - drives rendering and the prefix in the name column.
     * `css-hook` is a property the component reads but never sets; it exists
     * only because a `@cssprop` tag names it.
     */
    kind: ThemeTokenKind;
    /** Resolved type - from @type tag, from @property syntax, or '' */
    type: string;
    /** Resolved default - from @default tag or the literal declaration value */
    defaultValue: string;
    /** Markdown description (everything before the tag block) */
    description: string;
    /** @group value or '' for the flat default bucket */
    group: string;
    /** Multi-line code from @example tags, in source order */
    examples: string[];
    /** @since version string or '' */
    since: string;
    /** @deprecated marker - null = not deprecated, '' = deprecated without reason, string = deprecated with reason */
    deprecated: string | null;
    /** @see entries (URLs or token names) in source order */
    see: string[];
    /** @relatedTo symbol names as written; set only when the token has one */
    relatedTo?: string[];
    /** Source location for "view in source" link */
    file: string;
    line: number;
}

/** One parameter of a documented SCSS mixin or function. */
export interface StyleMixinParam {
    /** Without the `$`. */
    readonly name: string;
    /** From `@param [default]`, else the signature default, else ''. */
    readonly default: string;
    readonly description: string;
    /** From `@param {Type}`, else ''. */
    readonly type: string;
}

/** An SCSS mixin or function documented with a `///` block. */
export interface StyleMixin {
    readonly name: string;
    readonly kind: 'mixin' | 'function';
    readonly params: readonly StyleMixinParam[];
    readonly description: string;
    /** `@content` description; null when the tag is absent. */
    readonly content: string | null;
    /** Functions: the `@return` text, else ''. */
    readonly returns: string;
    readonly examples: readonly string[];
    readonly since: string;
    readonly deprecated: string | null;
    readonly see: readonly string[];
    readonly relatedTo: readonly string[];
    readonly file: string;
    readonly line: number;
}

/** A tag in a style comment the parser does not read. */
export interface UnknownStyleTag {
    readonly file: string;
    /** 1-based line of the tag. */
    readonly line: number;
    readonly tag: string;
}

/** Where a style comment sits. */
export interface StyleCommentLocation {
    readonly file: string;
    /** 1-based line the comment starts on. */
    readonly line: number;
}

/** A hook token whose sheet also declares the property, so the declaration was kept. */
export interface HookConflict {
    readonly file: string;
    /** 1-based line of the declaration that was kept. */
    readonly line: number;
    readonly name: string;
}

export interface ThemeTokenGroup {
    /** '' for the flat default bucket */
    name: string;
    tokens: ThemeToken[];
}

export interface ParsedStyleResult {
    tokens: ThemeToken[];
    /** Markdown bodies harvested from `@overview` blocks, in source order. */
    overview: string[];
    /** `@themes` names of the file-level blocks, in source order. */
    themes: string[];
    /** `@relatedTo` names of the file-level blocks, in source order. */
    relatedTo: string[];
    /** Tags the parser does not read, in source order. */
    unknownTags: UnknownStyleTag[];
    /** Documented SCSS mixins and functions, in source order. */
    mixins: StyleMixin[];
    /** Hook tokens the same sheet also declares, one per name. */
    hookConflicts: HookConflict[];
    /** Doc blocks with token tags that document nothing, in source order. */
    orphanBlocks: StyleCommentLocation[];
}

export interface StyleSource {
    file: string;
    content: string;
    language: 'scss' | 'css';
}

const TAG_LINE_RE = /^@([a-zA-Z][\w-]*)(?:[ \t]+([\s\S]*))?$/;

/**
 * Parse a theme-doc comment body into structured tags + free-form description.
 *
 * The body must already have comment markers (`///`, `/**`, `* /`) stripped.
 * Tag detection is line-based; the first line that starts with `@<word>` ends
 * the description block. `@example` is special-cased: its body keeps everything
 * up to the next `@<word>` line, including blank lines and fenced code blocks.
 */
export function parseDocBody(body: string): {
    description: string;
    tags: { name: string; value: string }[];
} {
    const lines = body.split('\n');
    const descLines: string[] = [];
    const tags: { name: string; value: string }[] = [];

    let i = 0;
    while (i < lines.length) {
        const match = lines[i].match(TAG_LINE_RE);
        if (match) {
            break;
        }
        descLines.push(lines[i]);
        i++;
    }

    while (i < lines.length) {
        const match = lines[i].match(TAG_LINE_RE);
        if (!match) {
            i++;
            continue;
        }
        const tagName = match[1];
        const valueLines: string[] = [];
        if (match[2]) {
            valueLines.push(match[2]);
        }
        i++;
        while (i < lines.length) {
            const next = lines[i].match(TAG_LINE_RE);
            if (next) {
                break;
            }
            valueLines.push(lines[i]);
            i++;
        }
        tags.push({ name: tagName, value: valueLines.join('\n').trimEnd() });
    }

    return {
        description: descLines.join('\n').trim(),
        tags
    };
}

/**
 * Detect `@overview` in a doc-block body and return the assembled intro text.
 *
 * A block carrying `@overview` is treated as a file-level intro and is NEVER
 * associated with a following declaration. The intro text is the description
 * (everything before the tag block) joined with the `@overview` value, so
 * authors can write the body either above or after the tag and get the same
 * result.
 *
 * Returns `null` when the block has no `@overview` tag.
 */
function extractOverview(body: string): string | null {
    const parsed = parseDocBody(body);
    const overviewTags = parsed.tags.filter(tag => tag.name === 'overview');
    if (overviewTags.length === 0) {
        return null;
    }
    const parts: string[] = [];
    if (parsed.description) {
        parts.push(parsed.description);
    }
    for (const tag of overviewTags) {
        const value = tag.value.trim();
        if (value) {
            parts.push(value);
        }
    }
    return parts.join('\n\n').trim();
}

/** Names in a `@themes` / `@relatedTo` value: its first line, comma or space separated. */
const tagNames = (value: string): string[] =>
    (value.split('\n')[0] ?? '')
        .split(/[\s,]+/)
        .map(name => name.trim())
        .filter(Boolean);

/** Line index in `body` of each tag `parseDocBody` returns, in the same order. */
const tagLineIndexes = (body: string): number[] => {
    const lines = body.split('\n');
    const indexes: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (TAG_LINE_RE.test(lines[i])) {
            indexes.push(i);
        }
    }
    return indexes;
};

/** What the file-level blocks of one source say. */
interface FileLevelCollector {
    readonly overview: string[];
    readonly themes: string[];
    readonly relatedTo: string[];
    readonly unknownTags: UnknownStyleTag[];
    /** Hook tokens written as `@cssprop` lines inside those blocks. */
    readonly hooks: ThemeToken[];
}

const newCollector = (): FileLevelCollector => ({
    overview: [],
    themes: [],
    relatedTo: [],
    unknownTags: [],
    hooks: []
});

/** The file-level fields of a collector as they appear in a scan result. */
const levelFields = (
    collector: FileLevelCollector
): Pick<ParsedStyleResult, 'overview' | 'themes' | 'relatedTo' | 'unknownTags'> => ({
    overview: collector.overview,
    themes: collector.themes,
    relatedTo: collector.relatedTo,
    unknownTags: collector.unknownTags
});

/** Tags a block needs to count as an attempt to document a token. */
const TOKEN_TAGS: readonly string[] = [
    'type',
    'default',
    'group',
    'example',
    'since',
    'deprecated',
    'see',
    'relatedTo'
];

/** `@internal` hides whatever the block documents; such a block is never reported as dropped. */
const isInternalBlock = (body: string): boolean =>
    parseDocBody(body).tags.some(tag => tag.name === 'internal');

const hasTokenTag = (body: string): boolean => {
    const tags = parseDocBody(body).tags;
    return (
        !tags.some(tag => tag.name === 'internal') &&
        tags.some(tag => TOKEN_TAGS.includes(tag.name))
    );
};

/** Tags that document a custom property the component reads (custom-elements-manifest names). */
export const HOOK_TAGS = ['cssprop', 'cssproperty'] as const;

const isHookTag = (name: string): boolean => (HOOK_TAGS as readonly string[]).includes(name);

/** Index of the bracket that closes the one at `open`, or -1. */
const closingIndex = (text: string, open: number, up: string, down: string): number => {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === up) {
            depth++;
        } else if (text[i] === down) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
};

interface HookLine {
    readonly name: string;
    readonly type: string;
    readonly defaultValue: string;
    readonly description: string;
}

/**
 * Read `{<syntax>} [--name=default] - description` (every part but the name
 * optional; `--name` without brackets is fine). Returns null when the name is
 * missing, does not start with `--`, or a bracket is left open.
 */
export function parseHookLine(value: string): HookLine | null {
    let rest = value.trim();
    let type = '';
    if (rest.startsWith('{')) {
        const close = closingIndex(rest, 0, '{', '}');
        if (close === -1) {
            return null;
        }
        type = rest.slice(1, close).trim();
        rest = rest.slice(close + 1).trimStart();
    }
    let name: string;
    let defaultValue = '';
    if (rest.startsWith('[')) {
        const close = closingIndex(rest, 0, '[', ']');
        if (close === -1) {
            return null;
        }
        const inner = rest.slice(1, close);
        const eq = inner.indexOf('=');
        name = (eq === -1 ? inner : inner.slice(0, eq)).trim();
        defaultValue = eq === -1 ? '' : inner.slice(eq + 1).trim();
        rest = rest.slice(close + 1);
    } else {
        name = rest.match(/^\S+/)?.[0] ?? '';
        rest = rest.slice(name.length);
    }
    if (!/^--[\w-]+$/.test(name)) {
        return null;
    }
    const description = rest.trim().replace(/^-(?:\s+|$)/, '');
    return { name, type, defaultValue, description };
}

/**
 * The hook tokens of one block, one per `@cssprop` line. `ownBlock` blocks
 * share their description and tags among the hooks (an inline text wins); in a
 * file-level block the description is the file overview, so only the inline
 * text counts. A line without a usable name is reported as an unknown tag.
 */
const readHooks = (args: {
    body: string;
    bodyLine: number;
    file: string;
    ownBlock: boolean;
    unknownTags: UnknownStyleTag[];
}): ThemeToken[] => {
    const parsed = parseDocBody(args.body);
    const lines = tagLineIndexes(args.body);
    const hooks: ThemeToken[] = [];
    parsed.tags.forEach((tag, i) => {
        if (!isHookTag(tag.name)) {
            return;
        }
        const line = args.bodyLine + (lines[i] ?? 0);
        const hook = parseHookLine(tag.value);
        if (!hook) {
            args.unknownTags.push({ file: args.file, line, tag: tag.name });
            return;
        }
        const token = buildToken({
            name: hook.name,
            kind: 'css-hook',
            body: args.ownBlock ? args.body : '',
            inferredType: hook.type,
            literalDefault: hook.defaultValue,
            file: args.file,
            line,
            bodyLine: args.bodyLine,
            unknownTags: hooks.length === 0 ? args.unknownTags : []
        });
        hooks.push({ ...token, description: hook.description || token.description });
    });
    return hooks;
};

/**
 * Claim a block with `@cssprop` lines: it documents the properties it names
 * and never attaches to the declaration after it. Returns false for any other
 * block.
 */
const readHookBlock = (
    body: string,
    file: string,
    bodyLine: number,
    into: { readonly tokens: ThemeToken[]; readonly unknownTags: UnknownStyleTag[] }
): boolean => {
    if (!parseDocBody(body).tags.some(tag => isHookTag(tag.name))) {
        return false;
    }
    if (isInternalBlock(body)) {
        return true;
    }
    into.tokens.push(
        ...readHooks({ body, bodyLine, file, ownBlock: true, unknownTags: into.unknownTags })
    );
    return true;
};

/**
 * Read a block that carries `@overview` or `@themes`: such a block describes
 * the file and never documents the declaration after it. Returns false for
 * any other block. `bodyLine` is the 1-based file line of the body's first line.
 */
const readFileLevelBlock = (
    body: string,
    file: string,
    bodyLine: number,
    into: FileLevelCollector
): boolean => {
    const parsed = parseDocBody(body);
    if (!parsed.tags.some(tag => tag.name === 'overview' || tag.name === 'themes')) {
        return false;
    }
    const intro = extractOverview(body);
    if (intro) {
        into.overview.push(intro);
    }
    const lines = tagLineIndexes(body);
    const hooks = readHooks({
        body,
        bodyLine,
        file,
        ownBlock: false,
        unknownTags: into.unknownTags
    });
    if (!isInternalBlock(body)) {
        into.hooks.push(...hooks);
    }
    parsed.tags.forEach((tag, i) => {
        switch (tag.name) {
            case 'overview':
                break;
            case 'themes':
                into.themes.push(...tagNames(tag.value));
                break;
            case 'relatedTo':
                into.relatedTo.push(...tagNames(tag.value));
                break;
            case 'cssprop':
            case 'cssproperty':
            case 'internal':
                break;
            default:
                into.unknownTags.push({ file, line: bodyLine + (lines[i] ?? 0), tag: tag.name });
        }
    });
    return true;
};

/**
 * Build a ThemeToken from a doc-block body + a target declaration.
 *
 * `inferredType` and `literalDefault` are used as fallbacks when `@type` or
 * `@default` are absent. For `@property` rules, callers pre-extract the
 * `syntax` and `initial-value` descriptors and pass them as `inferredType` /
 * `literalDefault` - this implements the design's "@property merge" rule.
 */
function buildToken(args: {
    name: string;
    kind: ThemeToken['kind'];
    body: string;
    inferredType: string;
    literalDefault: string;
    file: string;
    line: number;
    /** 1-based file line of the body's first line. */
    bodyLine: number;
    unknownTags: UnknownStyleTag[];
}): ThemeToken {
    const parsed = parseDocBody(args.body);
    const lines = tagLineIndexes(args.body);
    const examples: string[] = [];
    const see: string[] = [];
    const relatedTo: string[] = [];
    let type = '';
    let defaultValue = '';
    let group = '';
    let since = '';
    let deprecated: string | null = null;

    for (const [i, tag] of parsed.tags.entries()) {
        switch (tag.name) {
            case 'type':
                type = tag.value.trim();
                break;
            case 'default':
                defaultValue = tag.value.trim();
                break;
            case 'group':
                group = tag.value.trim();
                break;
            case 'since':
                since = tag.value.trim();
                break;
            case 'deprecated':
                deprecated = tag.value.trim();
                break;
            case 'example':
                examples.push(tag.value.replace(/^\n+/, '').replace(/\n+$/, ''));
                break;
            case 'see':
                if (tag.value.trim()) {
                    see.push(tag.value.trim());
                }
                break;
            case 'relatedTo':
                relatedTo.push(...tagNames(tag.value));
                break;
            case 'cssprop':
            case 'cssproperty':
                break;
            default:
                args.unknownTags.push({
                    file: args.file,
                    line: args.bodyLine + (lines[i] ?? 0),
                    tag: tag.name
                });
        }
    }

    return {
        name: args.name,
        kind: args.kind,
        type: type || args.inferredType,
        defaultValue: defaultValue || args.literalDefault,
        description: parsed.description,
        group,
        examples,
        since,
        deprecated,
        see,
        ...(relatedTo.length > 0 && { relatedTo }),
        file: args.file,
        line: args.line
    };
}

// ---------------------------------------------------------------------------
// SCSS scanner - `///` line blocks above `$var: value [!default];`
// ---------------------------------------------------------------------------

const SCSS_VAR_DECL_RE = /^[ \t]*\$([\w-]+)\s*:\s*([\s\S]*?)(?:\s*!default)?\s*;/;
const SCSS_MIXIN_DECL_RE = /^[ \t]*@(mixin|function)\s+([\w-]+)/;
const PARAM_TAG_RE = /^(?:\{([^}]*)\}\s*)?\$?([\w-]+)(?:\s*\[([^\]]*)\])?\s*(?:-\s+)?([\s\S]*)$/;

/**
 * The parameter list of a mixin or function declared at `lines[start]`: the
 * text between the first `(` and its closing `)`, across lines. Empty when
 * the declaration has none or never closes.
 */
const signatureParams = (
    lines: readonly string[],
    start: number
): { name: string; default: string }[] => {
    const text = lines.slice(start, start + 50).join('\n');
    const open = text.indexOf('(');
    const brace = text.indexOf('{');
    if (open === -1 || (brace !== -1 && brace < open)) {
        return [];
    }
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (let i = open + 1; i < text.length; i++) {
        const c = text[i];
        if (c === '(' || c === '[') {
            depth++;
        } else if (c === ')' || c === ']') {
            if (depth === 0) {
                parts.push(current);
                return parts
                    .map(part => part.trim())
                    .filter(part => part.startsWith('$'))
                    .map(part => {
                        const colon = part.indexOf(':');
                        const name = (colon === -1 ? part : part.slice(0, colon)).trim().slice(1);
                        return {
                            name: name.replace(/\.\.\.$/, ''),
                            default: colon === -1 ? '' : part.slice(colon + 1).trim()
                        };
                    });
            }
            depth--;
        } else if (c === ',' && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += c;
    }
    return [];
};

/**
 * A SassDoc example (`@example scss` + indented code) as a fenced block, so
 * it renders like a token's fenced example. Other forms are kept as written.
 */
const sassDocExample = (value: string): string => {
    const trimmed = value.replace(/^\n+/, '').replace(/\n+$/, '');
    const [first, ...rest] = trimmed.split('\n');
    if (!/^(scss|sass|css)$/.test(first.trim()) || rest.length === 0) {
        return trimmed;
    }
    const indent = Math.min(
        ...rest.filter(line => line.trim() !== '').map(line => line.match(/^ */)?.[0].length ?? 0)
    );
    const code = rest.map(line => line.slice(indent)).join('\n');
    return `\`\`\`${first.trim()}\n${code}\n\`\`\``;
};

const isPrivateName = (name: string): boolean => name.startsWith('_') || name.startsWith('-');

/** A documented mixin or function from its `///` body and declaration. */
const buildMixin = (args: {
    kind: StyleMixin['kind'];
    name: string;
    body: string;
    signature: readonly { name: string; default: string }[];
    file: string;
    line: number;
    bodyLine: number;
    unknownTags: UnknownStyleTag[];
}): StyleMixin => {
    const parsed = parseDocBody(args.body);
    const lines = tagLineIndexes(args.body);
    const documented: StyleMixinParam[] = [];
    const examples: string[] = [];
    const see: string[] = [];
    const relatedTo: string[] = [];
    const outputs: string[] = [];
    let content: string | null = null;
    let returns = '';
    let since = '';
    let deprecated: string | null = null;
    for (const [i, tag] of parsed.tags.entries()) {
        const value = tag.value.trim();
        switch (tag.name) {
            case 'param': {
                const m = value.match(PARAM_TAG_RE);
                if (m) {
                    documented.push({
                        name: m[2],
                        type: (m[1] ?? '').trim(),
                        default: (m[3] ?? '').trim(),
                        description: (m[4] ?? '').trim()
                    });
                }
                break;
            }
            case 'content':
                content = value;
                break;
            case 'return':
                returns = value;
                break;
            case 'output':
                if (value) {
                    outputs.push(value);
                }
                break;
            case 'example':
                examples.push(sassDocExample(tag.value));
                break;
            case 'since':
                since = value;
                break;
            case 'deprecated':
                deprecated = value;
                break;
            case 'see':
                if (value) {
                    see.push(value);
                }
                break;
            case 'relatedTo':
                relatedTo.push(...tagNames(tag.value));
                break;
            case 'cssprop':
            case 'cssproperty':
                break;
            default:
                args.unknownTags.push({
                    file: args.file,
                    line: args.bodyLine + (lines[i] ?? 0),
                    tag: tag.name
                });
        }
    }
    const byName = new Map(documented.map(param => [param.name, param]));
    const params: StyleMixinParam[] = args.signature.map(({ name, default: fallback }) => {
        const doc = byName.get(name);
        byName.delete(name);
        return {
            name,
            default: doc?.default || fallback,
            description: doc?.description ?? '',
            type: doc?.type ?? ''
        };
    });
    params.push(...byName.values());
    return {
        name: args.name,
        kind: args.kind,
        params,
        description: [parsed.description, ...outputs].filter(Boolean).join('\n\n'),
        content,
        returns,
        examples,
        since,
        deprecated,
        see,
        relatedTo,
        file: args.file,
        line: args.line
    };
};

export function parseScssTokens(source: string, file: string): ParsedStyleResult {
    const lines = source.split('\n');
    const tokens: ThemeToken[] = [];
    const mixins: StyleMixin[] = [];
    const fileLevel = newCollector();
    const orphanBlocks: StyleCommentLocation[] = [];

    let pending: { body: string; line: number } | null = null;
    const dropBlock = (block: { body: string; line: number }) => {
        if (hasTokenTag(block.body)) {
            orphanBlocks.push({ file, line: block.line });
        }
    };
    let pendingLines: string[] | null = null;
    let pendingStart = -1;

    const flushPending = () => {
        if (pendingLines?.length) {
            if (pending) {
                dropBlock(pending);
            }
            const body = pendingLines.join('\n');
            const fileBlock = readFileLevelBlock(body, file, pendingStart + 1, fileLevel);
            tokens.push(...fileLevel.hooks.splice(0));
            const claimed =
                fileBlock ||
                readHookBlock(body, file, pendingStart + 1, {
                    tokens,
                    unknownTags: fileLevel.unknownTags
                });
            if (claimed) {
                pending = null;
            } else {
                pending = { body, line: pendingStart + 1 };
            }
        } else {
            pending = null;
        }
        pendingLines = null;
        pendingStart = -1;
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        if (trimmed.startsWith('///')) {
            if (pendingLines === null) {
                pendingLines = [];
                pendingStart = i;
            }
            pendingLines.push(trimmed.slice(3).replace(/^ /, ''));
            continue;
        }

        if (pendingLines !== null) {
            flushPending();
        }

        if (trimmed === '') {
            continue;
        }

        const internalBlock = pending !== null && isInternalBlock(pending.body);
        const mixinMatch = pending ? raw.match(SCSS_MIXIN_DECL_RE) : null;
        if (pending && mixinMatch && !isPrivateName(mixinMatch[2]) && !internalBlock) {
            mixins.push(
                buildMixin({
                    kind: mixinMatch[1] as StyleMixin['kind'],
                    name: mixinMatch[2],
                    body: pending.body,
                    signature: signatureParams(lines, i),
                    file,
                    line: i + 1,
                    bodyLine: pending.line,
                    unknownTags: fileLevel.unknownTags
                })
            );
        }

        if (pending) {
            const declMatch = raw.match(SCSS_VAR_DECL_RE);
            if (declMatch && !internalBlock) {
                tokens.push(
                    buildToken({
                        name: `$${declMatch[1]}`,
                        kind: 'scss-variable',
                        body: pending.body,
                        inferredType: '',
                        literalDefault: declMatch[2].trim(),
                        file,
                        line: i + 1,
                        bodyLine: pending.line,
                        unknownTags: fileLevel.unknownTags
                    })
                );
            }
            const isDeclaration = declMatch !== null || mixinMatch !== null;
            if (!isDeclaration) {
                dropBlock(pending);
            }
            pending = null;
        }

        // The chain breaks: any non-comment, non-blank line that is not a
        // matching declaration cancels the pending doc block. This mirrors the
        // "immediately above" requirement.
    }

    // Flush any trailing `///` block at end-of-file (overview-only fixture case).
    if (pendingLines !== null) {
        flushPending();
    }
    if (pending) {
        dropBlock(pending);
    }

    const resolved = resolveHookConflicts(source, file, tokens, true);
    return {
        tokens: resolved.tokens,
        ...levelFields(fileLevel),
        mixins,
        hookConflicts: resolved.conflicts,
        orphanBlocks
    };
}

// ---------------------------------------------------------------------------
// CSS scanner - `/** */` blocks above `--prop: value;` or `@property --prop`
// ---------------------------------------------------------------------------

// Strip a doc-comment block to its plain body, dropping leading-asterisk gutters.
function stripJsdocBlock(raw: string): string {
    return raw
        .split('\n')
        .map(line => line.replace(/^[ \t]*\*\s?/, ''))
        .join('\n')
        .trim();
}

// 1-based file line of the first body line of a block opened at `open`:
// the line of `/**` plus the blank lines `stripJsdocBlock` trims off.
function bodyStartLine(source: string, open: number, inner: string): number {
    const lines = inner.split('\n');
    let skip = 0;
    while (skip < lines.length - 1 && lines[skip].replace(/^[ \t]*\*\s?/, '').trim() === '') {
        skip++;
    }
    return offsetToLine(source, open) + skip;
}

// Find every `/** ... */` block. Single-asterisk blocks are ignored.
function scanJsdocBlocks(
    source: string
): { start: number; end: number; body: string; bodyLine: number }[] {
    const blocks: { start: number; end: number; body: string; bodyLine: number }[] = [];
    let i = 0;
    while (i < source.length) {
        const open = source.indexOf('/**', i);
        if (open === -1) {
            break;
        }
        // Reject `/***` (three asterisks) only if followed by `*` again - pure
        // `/**` followed by alphanumerics is fine. Single-asterisk `/*` was
        // already filtered by the indexOf('/**') above.
        const close = source.indexOf('*/', open + 3);
        if (close === -1) {
            break;
        }
        const inner = source.slice(open + 3, close);
        blocks.push({
            start: open,
            end: close + 2,
            body: stripJsdocBlock(inner),
            bodyLine: bodyStartLine(source, open, inner)
        });
        i = close + 2;
    }
    return blocks;
}

/** Convert a string offset to a 1-based line number. */
function offsetToLine(source: string, offset: number): number {
    let line = 1;
    for (let i = 0; i < offset && i < source.length; i++) {
        if (source[i] === '\n') {
            line++;
        }
    }
    return line;
}

/**
 * Find the next non-whitespace declaration after `offset` and return it,
 * provided only whitespace separates it from the offset. Returns null when
 * any other syntax interrupts (another comment, a different at-rule, etc.).
 */
function consumeWhitespace(source: string, offset: number): number {
    while (offset < source.length) {
        const ch = source[offset];
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            offset++;
            continue;
        }
        return offset;
    }
    return offset;
}

const CSS_CUSTOM_PROP_RE = /^(--[\w-]+)\s*:\s*([^;{}]*?)\s*;/;
const AT_PROPERTY_RE = /^@property\s+(--[\w-]+)\s*\{([^}]*)\}/;
const SELECTOR_HEAD_RE = /^([^{};/]+?)\{/;
const FIRST_INNER_DECL_RE = /^[\s/*]*?(--[\w-]+)\s*:\s*([^;{}]*?)\s*;/;

interface AtPropertyInfo {
    syntax: string;
    initialValue: string;
}

function parseAtPropertyBody(body: string): AtPropertyInfo {
    let syntax = '';
    let initialValue = '';
    const decls = body.split(';');
    for (const decl of decls) {
        const colon = decl.indexOf(':');
        if (colon === -1) {
            continue;
        }
        const key = decl.slice(0, colon).trim().toLowerCase();
        const value = decl.slice(colon + 1).trim();
        if (key === 'syntax') {
            // Strip surrounding quotes if present
            syntax = value.replace(/^['"]|['"]$/g, '');
        } else if (key === 'initial-value') {
            initialValue = value;
        }
    }
    return { syntax, initialValue };
}

/** Block comments (and `//` lines in SCSS) blanked out, line breaks kept so offsets still map to lines. */
const blankComments = (source: string, scss: boolean): string => {
    const blank = (text: string): string => text.replace(/[^\n]/g, ' ');
    const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, blank);
    return scss
        ? noBlocks.replace(/(^|[^:])(\/\/[^\n]*)/g, (_, lead, rest) => lead + blank(rest))
        : noBlocks;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueConflicts = (conflicts: readonly HookConflict[]): HookConflict[] => {
    const seen = new Set<string>();
    return conflicts.filter(conflict => {
        const key = `${conflict.file}\0${conflict.name}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

/**
 * A hook token names a property the component only reads. When the same sheet
 * declares it (`--x:` or `@property --x`), the declaration is the better
 * truth: the hook becomes that kind of token at the declaration's line and the
 * conflict is recorded once per name. A `var(--x)` read is not a declaration.
 */
function resolveHookConflicts(
    source: string,
    file: string,
    tokens: ThemeToken[],
    scss: boolean
): { tokens: ThemeToken[]; conflicts: HookConflict[] } {
    if (!tokens.some(token => token.kind === 'css-hook')) {
        return { tokens, conflicts: [] };
    }
    const clean = blankComments(source, scss);
    const conflicts: HookConflict[] = [];
    const resolved = tokens.map(token => {
        if (token.kind !== 'css-hook') {
            return token;
        }
        const name = escapeRegExp(token.name);
        const declared = new RegExp(`(^|[;{\\s])(${name})\\s*:\\s*([^;{}]*?)\\s*;`).exec(clean);
        const registered = new RegExp(`@property\\s+${name}\\s*\\{([^}]*)\\}`).exec(clean);
        const declaredAt = declared ? declared.index + declared[1].length : Infinity;
        const registeredAt = registered?.index ?? Infinity;
        if (declaredAt === Infinity && registeredAt === Infinity) {
            return token;
        }
        const useRegistered = registered !== null && registeredAt < declaredAt;
        const at = useRegistered ? registeredAt : declaredAt;
        const info = useRegistered ? parseAtPropertyBody(registered?.[1] ?? '') : null;
        const line = offsetToLine(source, at);
        conflicts.push({ file, line, name: token.name });
        return {
            ...token,
            kind: useRegistered ? ('css-at-property' as const) : ('css-custom-property' as const),
            type: token.type || (info?.syntax ?? ''),
            defaultValue: token.defaultValue || (info ? info.initialValue : (declared?.[3] ?? '')),
            line
        };
    });
    return { tokens: resolved, conflicts: uniqueConflicts(conflicts) };
}

export function parseCssTokens(source: string, file: string): ParsedStyleResult {
    const tokens: ThemeToken[] = [];
    const fileLevel = newCollector();
    const blocks = scanJsdocBlocks(source);
    const consumedAtProperties = new Set<string>();

    const orphanBlocks: StyleCommentLocation[] = [];
    // The block whose attachment is still open: it counts as dropped when the
    // next block (or the end of the file) arrives and no token came out of it.
    let open: { body: string; start: number; tokenCount: number } | null = null;
    const closeBlock = () => {
        if (open && tokens.length === open.tokenCount && hasTokenTag(open.body)) {
            orphanBlocks.push({ file, line: offsetToLine(source, open.start) });
        }
        open = null;
    };

    for (const block of blocks) {
        closeBlock();
        if (readFileLevelBlock(block.body, file, block.bodyLine, fileLevel)) {
            tokens.push(...fileLevel.hooks.splice(0));
            continue;
        }
        if (
            readHookBlock(block.body, file, block.bodyLine, {
                tokens,
                unknownTags: fileLevel.unknownTags
            })
        ) {
            continue;
        }
        const after = consumeWhitespace(source, block.end);
        const rest = source.slice(after);

        if (isInternalBlock(block.body)) {
            // The fallback below must not bring a hidden `@property` back.
            const hiddenAtProp = rest.match(AT_PROPERTY_RE);
            if (hiddenAtProp) {
                consumedAtProperties.add(hiddenAtProp[1]);
            }
            continue;
        }
        open = { body: block.body, start: block.start, tokenCount: tokens.length };
        const docArgs = {
            body: block.body,
            bodyLine: block.bodyLine,
            unknownTags: fileLevel.unknownTags
        };

        const atPropMatch = rest.match(AT_PROPERTY_RE);
        if (atPropMatch) {
            const propName = atPropMatch[1];
            const info = parseAtPropertyBody(atPropMatch[2]);
            tokens.push(
                buildToken({
                    name: propName,
                    kind: 'css-at-property',
                    ...docArgs,
                    inferredType: info.syntax,
                    literalDefault: info.initialValue,
                    file,
                    line: offsetToLine(source, after)
                })
            );
            consumedAtProperties.add(propName);
            continue;
        }

        const customMatch = rest.match(CSS_CUSTOM_PROP_RE);
        if (customMatch) {
            tokens.push(
                buildToken({
                    name: customMatch[1],
                    kind: 'css-custom-property',
                    ...docArgs,
                    inferredType: '',
                    literalDefault: customMatch[2].trim(),
                    file,
                    line: offsetToLine(source, after)
                })
            );
            continue;
        }

        // Fallback: doc block above a selector wrapper like `:host { --foo: 1; }`.
        // The doc associates with the first custom property declared inside.
        const selMatch = rest.match(SELECTOR_HEAD_RE);
        if (selMatch) {
            const braceOpen = after + selMatch[0].length - 1;
            const braceClose = source.indexOf('}', braceOpen);
            if (braceClose !== -1) {
                const innerStart = braceOpen + 1;
                const inner = source.slice(innerStart, braceClose);
                const innerMatch = inner.match(FIRST_INNER_DECL_RE);
                if (innerMatch) {
                    const propLine = offsetToLine(source, innerStart + innerMatch.index!);
                    tokens.push(
                        buildToken({
                            name: innerMatch[1],
                            kind: 'css-custom-property',
                            ...docArgs,
                            inferredType: '',
                            literalDefault: innerMatch[2].trim(),
                            file,
                            line: propLine
                        })
                    );
                }
            }
        }
    }

    closeBlock();

    // Pick up any undocumented `@property --foo { ... }` rules so the
    // browser-native source-of-truth still surfaces. Documented ones were
    // already captured above; the Set guards against duplicates.
    const undocAtProp = /@property\s+(--[\w-]+)\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null = undocAtProp.exec(source);
    while (m !== null) {
        const propName = m[1];
        if (!consumedAtProperties.has(propName)) {
            const info = parseAtPropertyBody(m[2]);
            tokens.push({
                name: propName,
                kind: 'css-at-property',
                type: info.syntax,
                defaultValue: info.initialValue,
                description: '',
                group: '',
                examples: [],
                since: '',
                deprecated: null,
                see: [],
                file,
                line: offsetToLine(source, m.index)
            });
        }
        m = undocAtProp.exec(source);
    }

    const resolved = resolveHookConflicts(source, file, tokens, /\.scss$/i.test(file));
    return {
        tokens: resolved.tokens,
        ...levelFields(fileLevel),
        mixins: [],
        hookConflicts: resolved.conflicts,
        orphanBlocks
    };
}

export function parseStyleSource(
    source: string,
    file: string,
    lang: 'scss' | 'css'
): ParsedStyleResult {
    if (lang === 'scss') {
        const scss = parseScssTokens(source, file);
        const css = parseCssTokens(source, file);
        return {
            tokens: [...scss.tokens, ...css.tokens],
            overview: [...scss.overview, ...css.overview],
            themes: [...scss.themes, ...css.themes],
            relatedTo: [...scss.relatedTo, ...css.relatedTo],
            unknownTags: [...scss.unknownTags, ...css.unknownTags],
            mixins: scss.mixins,
            hookConflicts: uniqueConflicts([...scss.hookConflicts, ...css.hookConflicts]),
            orphanBlocks: [...scss.orphanBlocks, ...css.orphanBlocks]
        };
    }
    return parseCssTokens(source, file);
}

// ---------------------------------------------------------------------------
// Source resolver - pulls styleUrls + inline styles, follows @import/@use one
// level deep for SCSS partials.
// ---------------------------------------------------------------------------

const SCSS_IMPORT_RE = /^[ \t]*@(?:import|use)\s+['"]([^'"]+)['"]/gm;

function readStyleFile(absPath: string): { content: string; lang: 'scss' | 'css' } | null {
    try {
        const content = fs.readFileSync(absPath, 'utf8');
        const ext = path.extname(absPath).toLowerCase();
        const lang = ext === '.scss' || ext === '.sass' ? 'scss' : 'css';
        return { content, lang };
    } catch (err) {
        logger.warn(`theme-doc-parser: unable to read ${absPath}: ${(err as Error).message}`);
        return null;
    }
}

function resolveScssPartial(spec: string, fromDir: string): string | null {
    const candidates: string[] = [];
    const ext = path.extname(spec);
    const dir = path.dirname(spec);
    const base = path.basename(spec, ext);

    const tryNames = ext ? [base + ext] : [`${base}.scss`, `_${base}.scss`, `${base}.css`];

    for (const name of tryNames) {
        candidates.push(path.resolve(fromDir, dir, name));
        // `@use 'theme/tokens'` resolves to `_tokens.scss` in many setups
        candidates.push(path.resolve(fromDir, dir, name.startsWith('_') ? name : `_${name}`));
    }

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

/**
 * Project-relative, forward-slash form of a resolved style path, matching the
 * `file` convention of every other entity. Keeps machine paths out of exports.
 */
const toProjectPath = (absolutePath: string): string =>
    path.relative(process.cwd(), absolutePath).split(path.sep).join('/');

/**
 * Resolve the style sources for a component-like dependency.
 *
 * - `styleUrls` are read relative to `entityFile`'s directory.
 * - For SCSS files, top-level `@import`/`@use` rules are followed one level deep.
 * - Inline `styles[]` strings become anonymous CSS sources keyed by index.
 * - `file` is stored relative to the working directory; the absolute path is
 *   only used to read the file.
 * - Missing files emit a warning (not an error) and are skipped.
 */
export function collectStyleSources(args: {
    entityFile: string | undefined | null;
    styleUrls?: string[];
    styles?: string[];
}): StyleSource[] {
    const sources: StyleSource[] = [];
    const seen = new Set<string>();

    if (args.entityFile && args.styleUrls?.length) {
        const dir = path.dirname(args.entityFile);
        for (const url of args.styleUrls) {
            const resolved = path.resolve(dir, url);
            if (seen.has(resolved)) {
                continue;
            }
            seen.add(resolved);
            const file = readStyleFile(resolved);
            if (!file) {
                continue;
            }
            sources.push({
                file: toProjectPath(resolved),
                content: file.content,
                language: file.lang
            });

            if (file.lang === 'scss') {
                const fromDir = path.dirname(resolved);
                let m: RegExpExecArray | null = SCSS_IMPORT_RE.exec(file.content);
                while (m !== null) {
                    const spec = m[1];
                    const partial = resolveScssPartial(spec, fromDir);
                    if (partial && !seen.has(partial)) {
                        seen.add(partial);
                        const partialFile = readStyleFile(partial);
                        if (partialFile) {
                            sources.push({
                                file: toProjectPath(partial),
                                content: partialFile.content,
                                language: partialFile.lang
                            });
                        }
                    }
                    m = SCSS_IMPORT_RE.exec(file.content);
                }
                SCSS_IMPORT_RE.lastIndex = 0;
            }
        }
    }

    if (args.styles?.length) {
        args.styles.forEach((content, idx) => {
            sources.push({
                file: `<inline-style-${idx}>`,
                content,
                language: 'css'
            });
        });
    }

    return sources;
}

/**
 * Pull every documented theme token out of a component's styles. Convenience
 * wrapper that runs `collectStyleSources()` and `parseStyleSource()` end-to-end.
 */
export function collectThemeTokens(args: {
    entityFile: string | undefined | null;
    styleUrls?: string[];
    styles?: string[];
}): { tokens: ThemeToken[]; sources: StyleSource[]; overview: string; mixins: StyleMixin[] } {
    const sources = collectStyleSources(args);
    const tokens: ThemeToken[] = [];
    const mixins: StyleMixin[] = [];
    const overviewParts: string[] = [];
    for (const src of sources) {
        const parsed = parseStyleSource(src.content, src.file, src.language);
        tokens.push(...parsed.tokens);
        mixins.push(...parsed.mixins);
        overviewParts.push(...parsed.overview);
    }
    return {
        tokens: mergeThemeTokens(tokens),
        sources,
        overview: overviewParts.join('\n\n').trim(),
        mixins
    };
}

/** How firmly a kind declares its token: a registered property beats a plain declaration. */
const KIND_RANK: Record<ThemeToken['kind'], number> = {
    'css-at-property': 3,
    'css-custom-property': 2,
    'scss-variable': 2,
    'css-hook': 1
};

/**
 * Collapse tokens that share a name into one, at the position of the first.
 * The strongest kind wins (ties keep the first in list order) and supplies
 * `kind`, `file` and `line`; `type` and `defaultValue` fall back to the first
 * non-empty value, and the prose fields (`description`, `group`, `examples`,
 * `since`, `see`, `relatedTo`) come from the first token that has them.
 * Returns the input array itself when no name repeats.
 */
export function mergeThemeTokens(tokens: readonly ThemeToken[]): ThemeToken[] {
    const byName = new Map<string, ThemeToken[]>();
    for (const token of tokens) {
        const same = byName.get(token.name);
        if (same) {
            same.push(token);
        } else {
            byName.set(token.name, [token]);
        }
    }
    if (byName.size === tokens.length) {
        return tokens as ThemeToken[];
    }
    return [...byName.values()].map(group => (group.length === 1 ? group[0] : mergeGroup(group)));
}

const mergeGroup = (group: readonly ThemeToken[]): ThemeToken => {
    const winner = group.reduce((best, token) =>
        KIND_RANK[token.kind] > KIND_RANK[best.kind] ? token : best
    );
    const first = <T>(read: (token: ThemeToken) => T, isSet: (value: T) => boolean): T =>
        read(group.find(token => isSet(read(token))) ?? winner);
    const filled = (value: string | readonly unknown[]): boolean => value.length > 0;
    const relatedTo = first(token => token.relatedTo ?? [], filled);
    return {
        name: winner.name,
        kind: winner.kind,
        type: winner.type || firstNonEmpty(group, 'type'),
        defaultValue: winner.defaultValue || firstNonEmpty(group, 'defaultValue'),
        description: first(token => token.description, filled),
        group: first(token => token.group, filled),
        examples: first(token => token.examples, filled),
        since: first(token => token.since, filled),
        deprecated:
            winner.deprecated ?? group.find(token => token.deprecated !== null)?.deprecated ?? null,
        see: first(token => token.see, filled),
        ...(relatedTo.length > 0 && { relatedTo }),
        file: winner.file,
        line: winner.line
    };
};

const firstNonEmpty = (group: readonly ThemeToken[], field: 'type' | 'defaultValue'): string =>
    group.find(token => token[field] !== '')?.[field] ?? '';

/** Documented mixins and functions of every source, each file read once. */
export const styleMixins = (sources: readonly StyleSource[]): StyleMixin[] => {
    const seen = new Set<string>();
    const found: StyleMixin[] = [];
    for (const src of sources) {
        if (src.language !== 'scss' || seen.has(src.file)) {
            continue;
        }
        seen.add(src.file);
        found.push(...parseScssTokens(src.content, src.file).mixins);
    }
    return found;
};

/**
 * Unknown tags of every source, each file read once (a file shared by
 * several components is reported once).
 */
export const unknownStyleTags = (sources: readonly StyleSource[]): UnknownStyleTag[] => {
    const seen = new Set<string>();
    const found: UnknownStyleTag[] = [];
    for (const src of sources) {
        if (seen.has(src.file)) {
            continue;
        }
        seen.add(src.file);
        found.push(...parseStyleSource(src.content, src.file, src.language).unknownTags);
    }
    return found;
};

/** Doc blocks that attach to nothing, every source's file read once. */
export const styleOrphanBlocks = (sources: readonly StyleSource[]): StyleCommentLocation[] => {
    const seen = new Set<string>();
    const found: StyleCommentLocation[] = [];
    for (const src of sources) {
        if (seen.has(src.file)) {
            continue;
        }
        seen.add(src.file);
        found.push(...parseStyleSource(src.content, src.file, src.language).orphanBlocks);
    }
    return found;
};

/** Hook conflicts of every source, each file read once. */
export const styleHookConflicts = (sources: readonly StyleSource[]): HookConflict[] => {
    const seen = new Set<string>();
    const found: HookConflict[] = [];
    for (const src of sources) {
        if (seen.has(src.file)) {
            continue;
        }
        seen.add(src.file);
        found.push(...parseStyleSource(src.content, src.file, src.language).hookConflicts);
    }
    return found;
};

/**
 * The build notice for unknown style-comment tags: a count line with the
 * tag tally, then one `file:line @tag` per finding. Empty without findings.
 */
export const formatUnknownStyleTagNotice = (
    findings: readonly UnknownStyleTag[]
): readonly string[] => {
    if (findings.length === 0) {
        return [];
    }
    const counts = new Map<string, number>();
    for (const finding of findings) {
        counts.set(finding.tag, (counts.get(finding.tag) ?? 0) + 1);
    }
    const tally = [...counts].map(([tag, count]) => `@${tag} x${count}`).join(', ');
    const noun = findings.length === 1 ? 'tag' : 'tags';
    return [
        `Style comments: ${findings.length} unknown ${noun} ignored (${tally})`,
        ...findings.map(finding => `  ${finding.file}:${finding.line} @${finding.tag}`)
    ];
};

/**
 * The build notice for doc blocks that carry token tags but sit above nothing
 * the parser can document: a count line, then one `file:line` per block.
 * Empty without any.
 */
export const formatOrphanBlockNotice = (
    blocks: readonly StyleCommentLocation[]
): readonly string[] => {
    if (blocks.length === 0) {
        return [];
    }
    const noun = blocks.length === 1 ? 'doc block' : 'doc blocks';
    return [
        `Style comments: ${blocks.length} ${noun} not attached`,
        ...blocks.map(block => `  ${block.file}:${block.line}`)
    ];
};

/**
 * The build notice for hook tokens whose sheet also declares the property:
 * a count line, then one `file:line --name` per conflict. Empty without any.
 */
export const formatHookConflictNotice = (conflicts: readonly HookConflict[]): readonly string[] => {
    if (conflicts.length === 0) {
        return [];
    }
    const one = conflicts.length === 1;
    return [
        `Style comments: ${conflicts.length} hook ${one ? 'token' : 'tokens'} also declared in ${
            one ? 'its sheet' : 'their sheets'
        }, declaration kept`,
        ...conflicts.map(conflict => `  ${conflict.file}:${conflict.line} ${conflict.name}`)
    ];
};

/** Group tokens by `@group`. The `''` bucket renders without a sub-heading. */
export function groupThemeTokens(tokens: ThemeToken[]): ThemeTokenGroup[] {
    const buckets = new Map<string, ThemeToken[]>();
    for (const token of tokens) {
        const key = token.group ?? '';
        const existing = buckets.get(key);
        if (existing) {
            existing.push(token);
        } else {
            buckets.set(key, [token]);
        }
    }

    const groups: ThemeTokenGroup[] = [];
    // Default (flat) bucket first when present, then named buckets in source order
    if (buckets.has('')) {
        groups.push({ name: '', tokens: buckets.get('')! });
        buckets.delete('');
    }
    for (const [name, list] of buckets) {
        groups.push({ name, tokens: list });
    }
    return groups;
}
