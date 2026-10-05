import * as path from 'node:path';
import * as fs from 'fs-extra';
import { logger } from './logger';

/**
 * A single documented theming token extracted from an SCSS or CSS source file.
 *
 * The parser is deliberately tolerant: every field except `name`, `kind`, `file`
 * and `line` may be empty. Anything not matched by a known tag is preserved
 * verbatim in `description`, so users can extend the convention without the
 * parser breaking.
 */
export interface ThemeToken {
    /** Variable name including prefix: `--cngx-alert-padding` or `$alert-padding` */
    name: string;
    /** Source kind — drives rendering and the prefix in the name column */
    kind: 'css-custom-property' | 'scss-variable' | 'css-at-property';
    /** Resolved type — from @type tag, from @property syntax, or '' */
    type: string;
    /** Resolved default — from @default tag or the literal declaration value */
    defaultValue: string;
    /** Markdown description (everything before the tag block) */
    description: string;
    /** @group value or '' for the flat default bucket */
    group: string;
    /** Multi-line code from @example tags, in source order */
    examples: string[];
    /** @since version string or '' */
    since: string;
    /** @deprecated marker — null = not deprecated, '' = deprecated without reason, string = deprecated with reason */
    deprecated: string | null;
    /** @see entries (URLs or token names) in source order */
    see: string[];
    /** Source location for "view in source" link */
    file: string;
    line: number;
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
export function extractOverview(body: string): string | null {
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

/**
 * Build a ThemeToken from a doc-block body + a target declaration.
 *
 * `inferredType` and `literalDefault` are used as fallbacks when `@type` or
 * `@default` are absent. For `@property` rules, callers pre-extract the
 * `syntax` and `initial-value` descriptors and pass them as `inferredType` /
 * `literalDefault` — this implements the design's "@property merge" rule.
 */
function buildToken(args: {
    name: string;
    kind: ThemeToken['kind'];
    body: string;
    inferredType: string;
    literalDefault: string;
    file: string;
    line: number;
}): ThemeToken {
    const parsed = parseDocBody(args.body);
    const examples: string[] = [];
    const see: string[] = [];
    let type = '';
    let defaultValue = '';
    let group = '';
    let since = '';
    let deprecated: string | null = null;

    for (const tag of parsed.tags) {
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
            default:
                // Unknown tag — fold it back into the description as plain text
                // so authors can layer their own conventions without breakage.
                parsed.description =
                    `${parsed.description}\n@${tag.name}${tag.value ? ` ${tag.value}` : ''}`.trim();
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
        file: args.file,
        line: args.line
    };
}

// ---------------------------------------------------------------------------
// SCSS scanner — `///` line blocks above `$var: value [!default];`
// ---------------------------------------------------------------------------

const SCSS_VAR_DECL_RE = /^[ \t]*\$([\w-]+)\s*:\s*([\s\S]*?)(?:\s*!default)?\s*;/;

export function parseScssTokens(source: string, file: string): ParsedStyleResult {
    const lines = source.split('\n');
    const tokens: ThemeToken[] = [];
    const overview: string[] = [];

    let pending: { body: string; line: number } | null = null;
    let pendingLines: string[] | null = null;
    let pendingStart = -1;

    const flushPending = () => {
        if (pendingLines?.length) {
            const body = pendingLines.join('\n');
            const intro = extractOverview(body);
            if (intro !== null) {
                if (intro) {
                    overview.push(intro);
                }
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

        if (pending) {
            const declMatch = raw.match(SCSS_VAR_DECL_RE);
            if (declMatch) {
                tokens.push(
                    buildToken({
                        name: `$${declMatch[1]}`,
                        kind: 'scss-variable',
                        body: pending.body,
                        inferredType: '',
                        literalDefault: declMatch[2].trim(),
                        file,
                        line: i + 1
                    })
                );
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

    return { tokens, overview };
}

// ---------------------------------------------------------------------------
// CSS scanner — `/** */` blocks above `--prop: value;` or `@property --prop`
// ---------------------------------------------------------------------------

// Strip a doc-comment block to its plain body, dropping leading-asterisk gutters.
function stripJsdocBlock(raw: string): string {
    return raw
        .split('\n')
        .map(line => line.replace(/^[ \t]*\*\s?/, ''))
        .join('\n')
        .trim();
}

// Find every `/** ... */` block. Single-asterisk blocks are ignored.
function scanJsdocBlocks(source: string): { start: number; end: number; body: string }[] {
    const blocks: { start: number; end: number; body: string }[] = [];
    let i = 0;
    while (i < source.length) {
        const open = source.indexOf('/**', i);
        if (open === -1) {
            break;
        }
        // Reject `/***` (three asterisks) only if followed by `*` again — pure
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
            body: stripJsdocBlock(inner)
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

export function parseCssTokens(source: string, file: string): ParsedStyleResult {
    const tokens: ThemeToken[] = [];
    const overview: string[] = [];
    const blocks = scanJsdocBlocks(source);
    const consumedAtProperties = new Set<string>();

    for (const block of blocks) {
        const intro = extractOverview(block.body);
        if (intro !== null) {
            if (intro) {
                overview.push(intro);
            }
            continue;
        }

        const after = consumeWhitespace(source, block.end);
        const rest = source.slice(after);

        const atPropMatch = rest.match(AT_PROPERTY_RE);
        if (atPropMatch) {
            const propName = atPropMatch[1];
            const info = parseAtPropertyBody(atPropMatch[2]);
            tokens.push(
                buildToken({
                    name: propName,
                    kind: 'css-at-property',
                    body: block.body,
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
                    body: block.body,
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
                            body: block.body,
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

    return { tokens, overview };
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
            overview: [...scss.overview, ...css.overview]
        };
    }
    return parseCssTokens(source, file);
}

// ---------------------------------------------------------------------------
// Source resolver — pulls styleUrls + inline styles, follows @import/@use one
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
}): { tokens: ThemeToken[]; sources: StyleSource[]; overview: string } {
    const sources = collectStyleSources(args);
    const tokens: ThemeToken[] = [];
    const overviewParts: string[] = [];
    for (const src of sources) {
        const parsed = parseStyleSource(src.content, src.file, src.language);
        tokens.push(...parsed.tokens);
        overviewParts.push(...parsed.overview);
    }
    return { tokens, sources, overview: overviewParts.join('\n\n').trim() };
}

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
