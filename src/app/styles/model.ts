import {
    parseStyleSource,
    type StyleMixin,
    type ThemeToken,
    type UnknownStyleTag
} from '../../utils/theme-doc-parser';
import type { SymbolId } from '../links/symbol-id';

/** A free-standing style file matched by `styleFiles`. */
export interface StyleFile {
    /** `style:<file>`. */
    readonly id: string;
    /** Relative to the cwd, forward slashes. */
    readonly file: string;
    readonly language: 'css' | 'scss';
    readonly content: string;
    /** The `@overview` bodies joined, `''` when none. */
    readonly overview: string;
    readonly tokens: readonly ThemeToken[];
    readonly mixins: readonly StyleMixin[];
    /** `@themes` names as written. */
    readonly themeNames: readonly string[];
    /** The components and directives the `@themes` names resolved to. */
    readonly themes: readonly SymbolId[];
    readonly relatedTo: readonly string[];
    /** An overview, a documented token or a documented mixin. */
    readonly hasContent: boolean;
}

export interface StyleModel {
    /** Files with content, sorted by file. */
    readonly files: readonly StyleFile[];
    /** Matched files without content, sorted. */
    readonly listed: readonly string[];
    /** Symbol -> ids of the style files that theme it. */
    readonly byTarget: ReadonlyMap<SymbolId, readonly string[]>;
    readonly unknownTags: readonly UnknownStyleTag[];
}

export interface StyleSourceFile {
    /** Relative to the cwd, forward slashes. */
    readonly file: string;
    readonly content: string;
}

export const styleFileId = (file: string): string => `style:${file}`;

/**
 * A token counts as documented when it has a description, a group, or a type
 * of its own; an undocumented `@property` (type from its syntax) does not.
 */
export const isDocumentedToken = (token: ThemeToken): boolean =>
    token.description.trim() !== '' ||
    token.group !== '' ||
    (token.type !== '' && token.kind !== 'css-at-property');

const languageOf = (file: string): 'css' | 'scss' => (/\.scss$/i.test(file) ? 'scss' : 'css');

/** One matched file, parsed. */
export const readStyleFile = (
    source: StyleSourceFile
): StyleFile & {
    readonly unknownTags: readonly UnknownStyleTag[];
} => {
    const language = languageOf(source.file);
    const parsed = parseStyleSource(source.content, source.file, language);
    const overview = parsed.overview.join('\n\n').trim();
    return {
        id: styleFileId(source.file),
        file: source.file,
        language,
        content: source.content,
        overview,
        tokens: parsed.tokens,
        mixins: parsed.mixins,
        themeNames: [...new Set(parsed.themes)],
        themes: [],
        relatedTo: [...new Set(parsed.relatedTo)],
        hasContent:
            overview !== '' || parsed.tokens.some(isDocumentedToken) || parsed.mixins.length > 0,
        unknownTags: parsed.unknownTags
    };
};

/**
 * The style model of the matched files: files with content (sorted), the
 * files listed without content, and every unknown tag. `@themes` names stay
 * unresolved here.
 */
export const buildStyleModel = (sources: readonly StyleSourceFile[]): StyleModel => {
    const read = [...sources]
        .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
        .map(readStyleFile);
    return {
        files: read.filter(file => file.hasContent).map(({ unknownTags: _, ...file }) => file),
        listed: read.filter(file => !file.hasContent).map(file => file.file),
        byTarget: new Map(),
        unknownTags: read.flatMap(file => file.unknownTags)
    };
};

/**
 * A style file gets a page of its own when it has content and themes no
 * symbol, themes several, or documents mixins. A file that themes exactly
 * one symbol renders on that symbol's Theming tab only.
 */
export const hasStylePage = (file: StyleFile): boolean =>
    file.hasContent && (file.themes.length !== 1 || file.mixins.length > 0);

/** The build log line of the model. */
export const formatStyleSummary = (model: StyleModel): string => {
    const pages = model.files.filter(hasStylePage).length;
    const linked = model.files.filter(file => file.themes.length > 0).length;
    const symbols = model.byTarget.size;
    const total = model.files.length + model.listed.length;
    return (
        `Style files: ${total} (${pages} pages, ${linked} linked to ${symbols} symbols, ` +
        `${model.listed.length} without documented content)`
    );
};

/** The info line naming the first files listed without content; empty when none. */
export const formatListedNote = (model: StyleModel, shown = 5): string => {
    const { listed } = model;
    if (listed.length === 0) {
        return '';
    }
    const head = listed.slice(0, shown).join(', ');
    const more = listed.length > shown ? ', ...' : '';
    return `${listed.length} style files have no documented tokens, mixins or overview: ${head}${more}`;
};
