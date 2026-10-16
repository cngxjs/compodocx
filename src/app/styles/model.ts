import { isErr, type Result } from '../../lib';
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
    /** The `@themes` names of listed files; never resolved, since a listed file links nothing. */
    readonly listedThemes: readonly ListedThemes[];
    /** Symbol -> ids of the style files that theme it. */
    readonly byTarget: ReadonlyMap<SymbolId, readonly string[]>;
    readonly unknownTags: readonly UnknownStyleTag[];
}

/** A file listed without content that names `@themes` targets. */
export interface ListedThemes {
    readonly file: string;
    readonly names: readonly string[];
}

export interface StyleSourceFile {
    /** Relative to the cwd, forward slashes. */
    readonly file: string;
    readonly content: string;
}

const styleFileId = (file: string): string => `style:${file}`;

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
 * files listed without content (with their `@themes` names, if any), and
 * every unknown tag. `@themes` names stay unresolved here.
 */
export const buildStyleModel = (sources: readonly StyleSourceFile[]): StyleModel => {
    const read = [...sources]
        .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
        .map(readStyleFile);
    const listed = read.filter(file => !file.hasContent);
    return {
        files: read.filter(file => file.hasContent).map(({ unknownTags: _, ...file }) => file),
        listed: listed.map(file => file.file),
        listedThemes: listed
            .filter(file => file.themeNames.length > 0)
            .map(file => ({ file: file.file, names: file.themeNames })),
        byTarget: new Map(),
        unknownTags: read.flatMap(file => file.unknownTags)
    };
};

/** Why a `@themes` name did not resolve. */
export type ThemeMiss = 'not-found' | 'wrong-kind';

/** The `@themes` names of one file that did not resolve. */
export interface ThemeProblem {
    readonly file: string;
    readonly notFound: readonly string[];
    readonly wrongKind: readonly string[];
    /** Names several components or directives carry; the first by `{@link}` order is used. */
    readonly ambiguous: readonly string[];
}

/** A resolved `@themes` name. */
export interface ThemeHit {
    readonly id: SymbolId;
    /** Another component or directive has the same name. */
    readonly ambiguous: boolean;
}

/**
 * Resolve every file's `@themes` names (`resolve` returns the component or
 * directive a name stands for) and index the files by the symbols they theme.
 */
export const resolveThemes = (
    model: StyleModel,
    resolve: (name: string) => Result<ThemeHit, ThemeMiss>
): { readonly model: StyleModel; readonly problems: readonly ThemeProblem[] } => {
    const problems: ThemeProblem[] = [];
    const byTarget = new Map<SymbolId, string[]>();
    const files = model.files.map(file => {
        const themes: SymbolId[] = [];
        const notFound: string[] = [];
        const wrongKind: string[] = [];
        const ambiguous: string[] = [];
        for (const name of file.themeNames) {
            const hit = resolve(name);
            if (isErr(hit)) {
                (hit.message === 'wrong-kind' ? wrongKind : notFound).push(name);
                continue;
            }
            if (hit.value.ambiguous) {
                ambiguous.push(name);
            }
            if (!themes.includes(hit.value.id)) {
                themes.push(hit.value.id);
                byTarget.set(hit.value.id, [...(byTarget.get(hit.value.id) ?? []), file.id]);
            }
        }
        if (notFound.length > 0 || wrongKind.length > 0 || ambiguous.length > 0) {
            problems.push({ file: file.file, notFound, wrongKind, ambiguous });
        }
        return { ...file, themes };
    });
    return { model: { ...model, files, byTarget }, problems };
};

/** One warning per file with unresolved `@themes` names. */
export const formatThemeProblem = (problem: ThemeProblem): string => {
    const parts = [
        ...(problem.notFound.length > 0
            ? [`@themes ${problem.notFound.join(', ')} not found`]
            : []),
        ...(problem.wrongKind.length > 0
            ? [`@themes ${problem.wrongKind.join(', ')} is not a component or directive`]
            : []),
        ...(problem.ambiguous.length > 0
            ? [`@themes ${problem.ambiguous.join(', ')} names several symbols; using the first`]
            : [])
    ];
    return `Style file ${problem.file}: ${parts.join('; ')}`;
};

/** The warning for a listed file whose `@themes` names are dropped. */
export const formatListedThemes = (listed: ListedThemes): string =>
    `Style file ${listed.file}: @themes ${listed.names.join(', ')} ignored, ` +
    'the file has no overview, documented token or mixin';

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
