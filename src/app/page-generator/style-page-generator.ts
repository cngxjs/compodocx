import * as fs from 'node:fs';
import * as path from 'node:path';
import { isThemingSection } from '../../templates/helpers/tab-helpers';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { groupThemeTokens } from '../../utils/theme-doc-parser';
import Configuration from '../configuration';
import { hrefFor, hrefText, pageLocation } from '../links/layout';
import { placedLink, symbolTarget } from '../links/resolve';
import type { SymbolId } from '../links/symbol-id';
import type { SymbolEntry } from '../links/symbol-table';
import { type PackageManifest, type StyleFile, styleImportLine } from '../styles';

/** A symbol the style file themes: its name and, unless hidden, its page. */
export interface StyleThemeLink {
    readonly name: string;
    readonly href?: string;
}

/** What the `style` override receives under `style`. */
export interface StylePageData {
    readonly file: string;
    readonly name: string;
    readonly language: 'css' | 'scss';
    /** `@use` / `@import` line from the package `exports`; undefined without one. */
    readonly importLine?: string;
    readonly overview: string;
    readonly groups: ReturnType<typeof groupThemeTokens>;
    readonly mixins: StyleFile['mixins'];
    readonly themes: readonly StyleThemeLink[];
    readonly relatedTo: readonly string[];
    readonly sources: readonly { file: string; content: string; language: 'css' | 'scss' }[];
}

const themeLinks = (ids: readonly SymbolId[], depth: number): StyleThemeLink[] => {
    const { symbols, di } = Configuration.mainData;
    return ids.flatMap(id => {
        const entry = symbols?.byId.get(id);
        if (!entry) {
            return [];
        }
        const link = placedLink(symbols, entry, di);
        return [
            link
                ? { name: entry.ref.name, href: hrefText(hrefFor(link.target, depth, link.anchor)) }
                : { name: entry.ref.name }
        ];
    });
};

/** The page data of one style file. */
export const stylePageData = (
    file: StyleFile,
    entry: SymbolEntry,
    importLine: string | undefined,
    depth: number
): StylePageData => {
    const showSource = isThemingSection('source') && !Configuration.mainData.disableSourceCode;
    return {
        file: file.file,
        name: entry.ref.name,
        language: file.language,
        ...(importLine ? { importLine } : {}),
        overview: file.overview,
        groups: groupThemeTokens([...file.tokens]),
        mixins: file.mixins,
        themes: themeLinks(file.themes, depth),
        relatedTo: file.relatedTo,
        sources: showSource
            ? [{ file: file.file, content: file.content, language: file.language }]
            : []
    };
};

/** `<dir>/package.json` relative to the cwd, read once per folder. */
const manifestReader = (cwd: string) => {
    const cache = new Map<string, PackageManifest | undefined>();
    return (dir: string): PackageManifest | undefined => {
        if (!cache.has(dir)) {
            let manifest: PackageManifest | undefined;
            try {
                manifest = JSON.parse(
                    fs.readFileSync(path.resolve(cwd, dir, 'package.json'), 'utf8')
                );
            } catch {
                manifest = undefined;
            }
            cache.set(dir, manifest);
        }
        return cache.get(dir);
    };
};

/** The style entries of the symbol table, in file order. */
export const styleEntries = (entries: Iterable<SymbolEntry>): readonly SymbolEntry[] =>
    [...entries]
        .filter(entry => entry.ref.kind === 'style')
        .sort((a, b) => (a.ref.file < b.ref.file ? -1 : a.ref.file > b.ref.file ? 1 : 0));

/** One page per style file that gets one (`hasStylePage`). */
export const createStylePageGenerator = () => ({
    prepare: (): Promise<true> => {
        const { symbols } = Configuration.mainData;
        const entries = symbols ? styleEntries(symbols.byId.values()) : [];
        if (entries.length === 0) {
            return Promise.resolve(true);
        }
        logger.info('Prepare style pages');
        const manifest = manifestReader(process.cwd());
        for (const entry of entries) {
            const file = entry.data as StyleFile;
            const location = pageLocation(symbolTarget(entry));
            Configuration.addPage({
                path: location.path,
                name: `style:${file.file}`,
                displayName: entry.ref.name,
                id: entry.id,
                filename: location.filename,
                context: 'style',
                style: stylePageData(
                    file,
                    entry,
                    styleImportLine(file.file, manifest),
                    location.depth
                ),
                styleEntry: entry,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            });
        }
        return Promise.resolve(true);
    }
});

export type StylePageGenerator = ReturnType<typeof createStylePageGenerator>;
