import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import type { Feature, FeatureDetector, FeatureId } from '../compiler/semantic/features';
import { factKey, type SemanticModel } from '../compiler/semantic/model';
import Configuration from '../configuration';
import { type DiView, placementOf } from '../di/model';
import MarkdownEngine from '../engines/markdown.engine';
import { featureSegments } from '../links/feature-paths';
import { hrefFor, hrefText, pageLocation } from '../links/layout';
import { toSymbolKey } from '../links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../links/symbol-table';

/** Members of a feature by the section that lists them. */
export interface FeatureMembers {
    readonly components: readonly SymbolEntry[];
    readonly directives: readonly SymbolEntry[];
    readonly pipes: readonly SymbolEntry[];
    readonly services: readonly SymbolEntry[];
    /** Tokens, providers, feature functions and feature types. */
    readonly configuration: readonly SymbolEntry[];
    readonly utilities: readonly SymbolEntry[];
    readonly constants: readonly SymbolEntry[];
    readonly types: readonly SymbolEntry[];
    readonly classes: readonly SymbolEntry[];
}

export interface FeatureCard {
    readonly id: FeatureId;
    readonly label: string;
    readonly segments: readonly string[];
    readonly memberCount: number;
    /** First paragraph of the feature's README, as HTML. */
    readonly summary?: string;
}

/** What the `feature` page context receives under `feature`. */
export interface FeaturePageData {
    readonly id: FeatureId;
    readonly label: string;
    readonly entryPoint?: string;
    /** Import path of the members; undefined for apps. */
    readonly importPath?: string;
    readonly detector: FeatureDetector;
    readonly segments: readonly string[];
    /** The entry point's root feature, for the breadcrumb of a sub-feature. */
    readonly parent?: FeatureCard;
    readonly readme?: { readonly file: string; readonly html: string };
    readonly members: FeatureMembers;
    readonly subFeatures: readonly FeatureCard[];
}

type Section = keyof FeatureMembers;

/** The section of a member, from its kind and its place in the DI view. */
const sectionOf = (entry: SymbolEntry, view: DiView | undefined): Section | undefined => {
    const placement = placementOf(view, entry.id).type;
    if (placement === 'hidden') {
        return undefined;
    }
    if (placement !== 'own' || entry.ref.kind === 'token') {
        return 'configuration';
    }
    switch (entry.ref.kind) {
        case 'component':
            return 'components';
        case 'directive':
            return 'directives';
        case 'pipe':
            return 'pipes';
        case 'injectable':
            return 'services';
        case 'variable':
            return 'constants';
        case 'interface':
        case 'typealias':
        case 'enumeration':
            return 'types';
        case 'class':
        case 'entity':
            return 'classes';
        default:
            return 'utilities';
    }
};

const emptyMembers = (): Record<Section, SymbolEntry[]> => ({
    components: [],
    directives: [],
    pipes: [],
    services: [],
    configuration: [],
    utilities: [],
    constants: [],
    types: [],
    classes: []
});

const byName = (a: SymbolEntry, b: SymbolEntry): number => a.ref.name.localeCompare(b.ref.name);

const memberCount = (members: FeatureMembers): number =>
    Object.values(members).reduce((sum, list) => sum + list.length, 0);

/** Members of every feature, sorted by name inside each section. */
export const featureMembers = (
    semantic: SemanticModel,
    table: SymbolTable,
    view: DiView | undefined
): ReadonlyMap<FeatureId, FeatureMembers> => {
    const byFeature = new Map<FeatureId, Record<Section, SymbolEntry[]>>();
    const featureOf = semantic.features?.featureOf;
    for (const entry of table.byId.values()) {
        const id = featureOf?.get(factKey(toSymbolKey(entry.ref)));
        const section = id === undefined ? undefined : sectionOf(entry, view);
        if (id === undefined || section === undefined) {
            continue;
        }
        const members = byFeature.get(id) ?? emptyMembers();
        members[section].push(entry);
        byFeature.set(id, members);
    }
    for (const members of byFeature.values()) {
        for (const list of Object.values(members)) {
            list.sort(byName);
        }
    }
    return byFeature;
};

const posixDirname = (file: string): string => file.slice(0, Math.max(0, file.lastIndexOf('/')));

/** `rel` resolved against folder `dir`, both relative to the cwd. */
const resolveRelative = (dir: string, rel: string): string => {
    const parts = dir ? dir.split('/') : [];
    for (const part of rel.split('/')) {
        if (part === '..') {
            parts.pop();
        } else if (part !== '.' && part !== '') {
            parts.push(part);
        }
    }
    return parts.join('/');
};

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * README links made to work from the feature page: a relative link (or one
 * from the workspace root, `/...`) to another feature's README or folder
 * points at that feature's page, anchor kept; any other such link is
 * dropped, its text kept.
 */
export const rewriteReadmeLinks = (
    html: string,
    readme: string,
    featureAt: (folder: string) => readonly string[] | undefined,
    depth: number
): string =>
    html.replace(
        /<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,
        (link, href: string, rest: string, text: string) => {
            if (EXTERNAL.test(href)) {
                return link;
            }
            const [target, anchor] = href.split('#');
            const base = target.startsWith('/') ? '' : posixDirname(readme);
            const resolved = resolveRelative(base, target);
            const folder = /\.md$/i.test(resolved) ? posixDirname(resolved) : resolved;
            const segments = featureAt(folder);
            if (!segments) {
                return text;
            }
            const page = hrefText(
                hrefFor({ type: 'feature', segments }, depth, anchor || undefined)
            );
            return `<a href="${page}"${rest}>${text}</a>`;
        }
    );

const firstParagraph = (html: string): string | undefined =>
    /<p>([\s\S]*?)<\/p>/.exec(html)?.[1]?.trim() || undefined;

/** The page data of every feature; `readme` renders a README file to HTML. */
export const featurePages = (
    semantic: SemanticModel,
    table: SymbolTable,
    view: DiView | undefined,
    readme: (file: string) => string | undefined
): readonly FeaturePageData[] => {
    const model = semantic.features;
    if (!model || model.features.length === 0) {
        return [];
    }
    const members = featureMembers(semantic, table, view);
    const { segments } = featureSegments(model.features);
    const byFolder = new Map<string, readonly string[]>();
    for (const f of model.features) {
        const own = segments.get(f.id) ?? [];
        for (const folder of [
            f.root,
            f.readme === undefined ? undefined : posixDirname(f.readme)
        ]) {
            if (folder !== undefined && !byFolder.has(folder)) {
                byFolder.set(folder, own);
            }
        }
    }
    const html = new Map(
        model.features.flatMap(f => {
            const rendered = f.readme === undefined ? undefined : readme(f.readme);
            if (rendered === undefined || f.readme === undefined) {
                return [];
            }
            const depth = (segments.get(f.id) ?? []).length;
            const linked = rewriteReadmeLinks(rendered, f.readme, dir => byFolder.get(dir), depth);
            return [[f.id, linked] as const];
        })
    );
    const none = emptyMembers();
    const card = (feature: Feature): FeatureCard => {
        const readmeHtml = html.get(feature.id);
        const summary = readmeHtml === undefined ? undefined : firstParagraph(readmeHtml);
        return {
            id: feature.id,
            label: feature.label,
            segments: segments.get(feature.id) ?? [],
            memberCount: memberCount(members.get(feature.id) ?? none),
            ...(summary ? { summary } : {})
        };
    };
    const roots = new Map(
        model.features.filter(f => f.key === '').map(f => [f.entryPoint ?? '', f] as const)
    );
    return model.features.map(feature => {
        const scope = feature.entryPoint ?? '';
        const root = roots.get(scope);
        const isRoot = feature.key === '';
        const readmeHtml = html.get(feature.id);
        return {
            id: feature.id,
            label: feature.label,
            ...(feature.entryPoint ? { entryPoint: feature.entryPoint } : {}),
            ...(feature.entryPoint ? { importPath: feature.entryPoint } : {}),
            detector: feature.detector,
            segments: segments.get(feature.id) ?? [],
            ...(!isRoot && root ? { parent: card(root) } : {}),
            ...(feature.readme && readmeHtml !== undefined
                ? { readme: { file: feature.readme, html: readmeHtml } }
                : {}),
            members: members.get(feature.id) ?? none,
            subFeatures: isRoot
                ? model.features
                      .filter(f => f.key !== '' && (f.entryPoint ?? '') === scope)
                      .map(card)
                : []
        };
    });
};

const renderReadme = (file: string): string | undefined => {
    try {
        return MarkdownEngine.getTraditionalMarkdownSync(file);
    } catch {
        logger.warn(`Cannot read the feature README ${file}`);
        return undefined;
    }
};

/** One page per feature; the root feature of an entry point is its entry point page. */
export const createFeaturePageGenerator = () => ({
    prepare: (): Promise<true> => {
        const { semantic, symbols, di } = Configuration.mainData;
        if (!semantic?.features || !symbols) {
            return Promise.resolve(true);
        }
        logger.info('Prepare feature pages');
        for (const clash of featureSegments(semantic.features.features).clashes) {
            logger.warn(clash);
        }
        for (const feature of featurePages(semantic, symbols, di, renderReadme)) {
            const location = pageLocation({ type: 'feature', segments: feature.segments });
            Configuration.addPage({
                path: location.path,
                name: `feature:${feature.id}`,
                id: `feature:${feature.id}`,
                filename: location.filename,
                context: 'feature',
                feature,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            });
        }
        return Promise.resolve(true);
    }
});

export type FeaturePageGenerator = ReturnType<typeof createFeaturePageGenerator>;
