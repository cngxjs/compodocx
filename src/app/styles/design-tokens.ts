import type { ThemeToken } from '../../utils/theme-doc-parser';
import { isDocumentedToken, type StyleFile } from './model';

/** One row of the design tokens page. */
export interface DesignToken {
    readonly token: ThemeToken;
    /** Element id, `token-<name>`; `-2`, `-3` for later files defining the same name. */
    readonly id: string;
    /** The style file that defines it. */
    readonly file: string;
}

export interface DesignTokenGroup {
    /** `@group` value, `''` for the default group. */
    readonly name: string;
    /** Element id, `group-<slug>`. */
    readonly id: string;
    readonly tokens: readonly DesignToken[];
}

export interface DesignTokens {
    readonly groups: readonly DesignTokenGroup[];
    /** Token names more than one file defines, with the files in order. */
    readonly duplicates: readonly { readonly name: string; readonly files: readonly string[] }[];
}

const slug = (text: string): string =>
    text
        .replace(/^[$-]+/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'default';

/** Style files that theme no symbol: their tokens are the project's global tokens. */
export const unlinkedTokenFiles = (files: readonly StyleFile[]): readonly StyleFile[] =>
    files.filter(file => file.themes.length === 0 && file.tokens.some(isDocumentedToken));

/**
 * The documented tokens of every style file that themes no symbol, grouped
 * by `@group`: the default group first, then by name. Inside a group,
 * file order, then source order. The first file keeps `token-<name>`.
 */
export const designTokens = (files: readonly StyleFile[]): DesignTokens => {
    const byGroup = new Map<string, DesignToken[]>();
    const seen = new Map<string, string[]>();
    const ids = new Set<string>();
    for (const file of unlinkedTokenFiles(files)) {
        for (const token of file.tokens.filter(isDocumentedToken)) {
            const base = `token-${slug(token.name)}`;
            let id = base;
            for (let n = 2; ids.has(id); n++) {
                id = `${base}-${n}`;
            }
            ids.add(id);
            seen.set(token.name, [...(seen.get(token.name) ?? []), file.file]);
            byGroup.set(token.group, [
                ...(byGroup.get(token.group) ?? []),
                { token, id, file: file.file }
            ]);
        }
    }
    const names = [...byGroup.keys()].sort((a, b) =>
        a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)
    );
    return {
        groups: names.map(name => ({
            name,
            id: `group-${slug(name)}`,
            tokens: byGroup.get(name) ?? []
        })),
        duplicates: [...seen]
            .filter(([, defined]) => defined.length > 1)
            .map(([name, defined]) => ({ name, files: defined }))
    };
};

/** The one build-log line for token names several unlinked files define; '' when none. */
export const formatDuplicateTokens = (tokens: DesignTokens): string =>
    tokens.duplicates.length === 0
        ? ''
        : `Design tokens: ${tokens.duplicates.length} names defined more than once; the first file is linked: ` +
          tokens.duplicates.map(d => `${d.name} (${d.files.join(', ')})`).join('; ');
