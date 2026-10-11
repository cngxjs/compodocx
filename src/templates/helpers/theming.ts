import type { MainDataInterface } from '../../app/interfaces/main-data.interface';
import { entryInFile } from '../../app/links/symbol-table';
import type { StyleFile } from '../../app/styles/model';
import {
    type StyleMixin,
    type StyleSource,
    styleMixins,
    type ThemeToken
} from '../../utils/theme-doc-parser';

/** A style file that themes the symbol through `@themes`. */
export interface LinkedStyleFile {
    readonly file: string;
    /** File name shown on the tab. */
    readonly label: string;
}

/** What a component's or directive's Theming tab shows. */
export interface Theming {
    readonly tokens: readonly ThemeToken[];
    readonly overview: string;
    readonly sources: readonly StyleSource[];
    readonly mixins: readonly StyleMixin[];
    readonly linked: readonly LinkedStyleFile[];
}

type Themable = {
    readonly name?: unknown;
    readonly file?: unknown;
    readonly themeTokens?: ThemeToken[];
    readonly themeOverview?: string;
    readonly themeStyleSources?: StyleSource[];
};

const basename = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

/** The style files whose `@themes` names the symbol, in file order. */
export const linkedStyleFiles = (
    data: Themable,
    kind: 'component' | 'directive',
    mainData: Pick<MainDataInterface, 'styles' | 'symbols'>
): readonly StyleFile[] => {
    const styles = mainData.styles;
    if (!styles || styles.byTarget.size === 0 || typeof data.name !== 'string') {
        return [];
    }
    const entry = entryInFile(
        mainData.symbols,
        kind,
        data.name,
        typeof data.file === 'string' ? data.file : undefined
    );
    const ids = entry ? (styles.byTarget.get(entry.id) ?? []) : [];
    return styles.files.filter(file => ids.includes(file.id));
};

/**
 * The Theming tab of a component or directive: its own style tokens,
 * overview, sources and mixins (components), then the tokens, overview and
 * sources of every style file that themes it. The overview of a linked file
 * follows the own overview under the file's name. Nothing is written to the
 * engine object.
 */
export const themingFor = (
    data: Themable,
    kind: 'component' | 'directive',
    mainData: Pick<MainDataInterface, 'styles' | 'symbols'>
): Theming => {
    const ownSources = data.themeStyleSources ?? [];
    const linked = linkedStyleFiles(data, kind, mainData);
    const overview = [
        (data.themeOverview ?? '').trim(),
        ...linked
            .filter(file => file.overview !== '')
            .map(file => `#### ${basename(file.file)}\n\n${file.overview}`)
    ]
        .filter(Boolean)
        .join('\n\n');
    return {
        tokens: [...(data.themeTokens ?? []), ...linked.flatMap(file => file.tokens)],
        overview,
        sources: [
            ...ownSources,
            ...linked.map(file => ({
                file: file.file,
                content: file.content,
                language: file.language
            }))
        ],
        mixins: styleMixins(ownSources),
        linked: linked.map(file => ({ file: file.file, label: basename(file.file) }))
    };
};

/** True when the tab has anything to show. */
export const hasTheming = (theming: Theming): boolean =>
    theming.tokens.length > 0 || theming.overview !== '' || theming.mixins.length > 0;
