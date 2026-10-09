import * as path from 'node:path';

import type { ImportGraph } from './imports';
import { compareText, type EntryPoint } from './model';

/** What decided a feature. */
export type FeatureDetector = 'config' | 'tag' | 'cohesion' | 'entry-point' | 'folder';

/** `${entryPoint ?? ''}#${key}`; key `''` is the entry point's (or the app's) root feature. */
export type FeatureId = string;

export interface Feature {
    readonly id: FeatureId;
    /** Import path; undefined for apps and folders outside every entry point. */
    readonly entryPoint?: string;
    /** `''` or one segment `[a-z0-9][a-z0-9-]*`. */
    readonly key: string;
    /** The key, the last import path segment of a root feature, or the app name. */
    readonly label: string;
    /** Folder the feature lives in, relative to the cwd. */
    readonly root: string;
    readonly detector: FeatureDetector;
    /** `README.md` of the feature, relative to the cwd. */
    readonly readme?: string;
}

export interface FamilyLink {
    readonly from: FeatureId;
    readonly to: FeatureId;
    readonly reason: 'wraps' | 'same-name';
    /** Symbol edges from `from` to `to`. */
    readonly edges: number;
}

export interface FeatureModel {
    /** Sorted by entry point, then key. */
    readonly features: readonly Feature[];
    /** `factKey` -> feature. */
    readonly featureOf: ReadonlyMap<string, FeatureId>;
    readonly families: readonly FamilyLink[];
}

export interface FeatureSymbol {
    /** `factKey` of the symbol. */
    readonly key: string;
    /** Declaring file, relative to the cwd. */
    readonly file: string;
    /** Value of an `@feature` tag. */
    readonly tag?: string;
}

export interface FeatureConfig {
    /** Glob over cwd-relative file paths -> feature key, first match in object order. */
    readonly features: Readonly<Record<string, string>>;
    /** Folders whose children are the features of an app. */
    readonly containers: readonly string[];
    /** Folders below an entry point that belong to its root feature. */
    readonly utilityFolders: readonly string[];
}

/** File system questions, paths relative to the cwd. */
export interface FeatureFs {
    readonly isDirectory: (dir: string) => boolean;
    readonly isFile: (file: string) => boolean;
    /** `name` of `<dir>/package.json`, if any. */
    readonly packageName: (dir: string) => string | undefined;
}

export interface FeatureInput {
    /** Documented, exported symbols (hidden ones left out). */
    readonly symbols: readonly FeatureSymbol[];
    /** Every documented file, relative to the cwd. */
    readonly files: readonly string[];
    readonly entryPoints: readonly EntryPoint[];
    readonly imports: ImportGraph;
    readonly config: FeatureConfig;
    readonly fs: FeatureFs;
}

export interface FeatureDetection {
    readonly model: FeatureModel;
    readonly warnings: readonly string[];
}

export const DEFAULT_FEATURE_CONTAINERS: readonly string[] = ['features', 'pages', 'domains'];
export const DEFAULT_FEATURE_UTILITY_FOLDERS: readonly string[] = [
    'internal',
    'i18n',
    'utils',
    'testing',
    '__test-helpers',
    'examples'
];

const KEY = /^[a-z0-9][a-z0-9-]*$/;

export const isFeatureKey = (key: string): boolean => KEY.test(key);

export const featureId = (entryPoint: string | undefined, key: string): FeatureId =>
    `${entryPoint ?? ''}#${key}`;

/** A folder name as a feature key: lower case, other characters as `-`. */
const keyOfFolder = (folder: string): string =>
    folder
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '') || 'feature';

/** `**` any path, `*` and `?` inside one segment. */
export const globToRegExp = (glob: string): RegExp => {
    let source = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*' && glob[i + 1] === '*') {
            const slash = glob[i + 2] === '/';
            source += slash ? '(?:.*/)?' : '.*';
            i += slash ? 2 : 1;
        } else if (c === '*') {
            source += '[^/]*';
        } else if (c === '?') {
            source += '[^/]';
        } else {
            source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${source}$`);
};

const posix = path.posix;

const isInside = (dir: string, file: string): boolean => dir === '' || file.startsWith(`${dir}/`);

/** Folder segments of `file` below `root`, leading `src/` and `lib/` skipped. */
const segmentsBelow = (root: string, file: string): readonly string[] => {
    const rel = posix.relative(root, posix.dirname(file));
    const segments = rel === '' ? [] : rel.split('/');
    let skip = 0;
    while (skip < segments.length && (segments[skip] === 'src' || segments[skip] === 'lib')) {
        skip++;
    }
    return segments.slice(skip);
};

/** Folder of `file` up to and including its first segment below `root`. */
const firstFolder = (root: string, file: string, segment: string): string => {
    const rel = posix.relative(root, posix.dirname(file)).split('/');
    return posix.join(root, ...rel.slice(0, rel.indexOf(segment) + 1));
};

interface Owner {
    readonly entry: EntryPoint;
    /** Folder the cohesion segments are taken below. */
    readonly root: string;
}

/** The entry point whose root (or root without a trailing `src`) is the longest prefix. */
const ownerOf = (file: string, entryPoints: readonly EntryPoint[]): Owner | undefined => {
    let best: Owner | undefined;
    for (const entry of entryPoints) {
        for (const root of new Set([entry.root, entry.root.replace(/\/src$/, '')])) {
            if (isInside(root, file) && (!best || root.length > best.root.length)) {
                best = { entry, root };
            }
        }
    }
    return best;
};

/** Union-find over folder names; the smaller name is the root, so `''` wins. */
const unionFind = () => {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        let root = parent.get(x) ?? x;
        while ((parent.get(root) ?? root) !== root) {
            root = parent.get(root) as string;
        }
        parent.set(x, root);
        return root;
    };
    const union = (a: string, b: string): void => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) {
            const [low, high] = ra < rb ? [ra, rb] : [rb, ra];
            parent.set(high, low);
        }
    };
    return { find, union };
};

interface Cohesion {
    /** Every symbol of the entry point is in its root feature. */
    readonly glued: boolean;
    /** Folder segment -> component folder (`''` = root feature). */
    readonly componentOf: (segment: string) => string;
}

/**
 * The cohesion rule for one entry point: utility folders and root files fold
 * into the root feature; a non-utility folder imported by at least half of
 * the other folders (four folders or more) glues the whole entry point;
 * otherwise folders join on mutual edges or edges from two file pairs,
 * ignoring edges into hub folders.
 */
const cohesionOf = (
    segments: ReadonlySet<string>,
    pairs: ReadonlyMap<string, ReadonlySet<string>>,
    utility: ReadonlySet<string>
): Cohesion => {
    const others = segments.size - 1;
    const importers = new Map<string, Set<string>>();
    for (const edge of pairs.keys()) {
        const [from, to] = edge.split('>');
        const set = importers.get(to) ?? new Set<string>();
        set.add(from);
        importers.set(to, set);
    }
    const hubs = new Set<string>();
    if (others >= 3) {
        for (const [to, from] of importers) {
            if (from.size >= 0.5 * others) {
                hubs.add(to);
            }
        }
    }
    const glued = [...hubs].some(hub => !utility.has(hub));
    const uf = unionFind();
    for (const segment of segments) {
        if (utility.has(segment)) {
            uf.union('', segment);
        }
    }
    for (const [edge, filePairs] of pairs) {
        const [from, to] = edge.split('>');
        if (utility.has(from) || utility.has(to) || hubs.has(from) || hubs.has(to)) {
            continue;
        }
        if (pairs.has(`${to}>${from}`) || filePairs.size >= 2) {
            uf.union(from, to);
        }
    }
    return { glued, componentOf: segment => uf.find(segment) };
};

const DETECTOR_RANK: Readonly<Record<FeatureDetector, number>> = {
    config: 0,
    tag: 1,
    cohesion: 2,
    'entry-point': 3,
    folder: 4
};

interface Placement {
    readonly entryPoint?: string;
    readonly key: string;
    readonly detector: FeatureDetector;
    /** Folder the key came from. */
    readonly root: string;
    /** Root-feature label of the entry point or app. */
    readonly rootLabel: string;
}

const lastSegment = (importPath: string): string => importPath.split('/').pop() ?? importPath;

const commonRoot = (files: readonly string[]): string => {
    if (files.length === 0) {
        return '';
    }
    let parts = posix.dirname(files[0]).split('/');
    for (const file of files) {
        const dir = posix.dirname(file).split('/');
        let i = 0;
        while (i < parts.length && parts[i] === dir[i]) {
            i++;
        }
        parts = parts.slice(0, i);
    }
    return parts.join('/');
};

/**
 * Derive a feature for every symbol: config glob map, then `@feature` tag,
 * then the cohesion rule inside an entry point (root feature otherwise),
 * then the folder convention for apps and files outside every entry point.
 * Features never span entry points.
 */
export const detectFeatures = (input: FeatureInput): FeatureDetection => {
    const { config, entryPoints, fs } = input;
    const warnings: string[] = [];
    const warned = new Set<string>();
    const warnOnce = (message: string): void => {
        if (!warned.has(message)) {
            warned.add(message);
            warnings.push(message);
        }
    };
    const utility = new Set(config.utilityFolders);
    const containers = new Set(config.containers);
    const barrels = new Set(entryPoints.map(entry => entry.file));
    const globs = Object.entries(config.features).map(([glob, key]) => ({
        glob,
        key,
        re: globToRegExp(glob)
    }));

    // Cohesion input: folder segments and folder edges per entry point.
    const owners = new Map<string, Owner | undefined>();
    const owner = (file: string): Owner | undefined => {
        if (!owners.has(file)) {
            owners.set(file, ownerOf(file, entryPoints));
        }
        return owners.get(file);
    };
    const segmentOf = (o: Owner, file: string): string => segmentsBelow(o.root, file)[0] ?? '';
    const segments = new Map<string, Set<string>>();
    const segmentFolders = new Map<string, string>();
    for (const file of input.files) {
        const o = owner(file);
        if (!o || barrels.has(file)) {
            continue;
        }
        const segment = segmentOf(o, file);
        const set = segments.get(o.entry.importPath) ?? new Set<string>();
        set.add(segment);
        segments.set(o.entry.importPath, set);
        const folderKey = `${o.entry.importPath}\0${segment}`;
        if (segment !== '' && !segmentFolders.has(folderKey)) {
            segmentFolders.set(folderKey, firstFolder(o.root, file, segment));
        }
    }
    const pairs = new Map<string, Map<string, Set<string>>>();
    for (const [from, targets] of input.imports.edges) {
        const a = owner(from);
        if (!a || barrels.has(from)) {
            continue;
        }
        for (const to of targets) {
            const b = owner(to);
            if (!b || b.entry !== a.entry) {
                continue;
            }
            const sa = segmentOf(a, from);
            const sb = segmentOf(b, to);
            if (sa === sb) {
                continue;
            }
            const map = pairs.get(a.entry.importPath) ?? new Map<string, Set<string>>();
            const set = map.get(`${sa}>${sb}`) ?? new Set<string>();
            set.add(`${from}>${to}`);
            map.set(`${sa}>${sb}`, set);
            pairs.set(a.entry.importPath, map);
        }
    }
    const cohesion = new Map<string, Cohesion>();
    const cohesionFor = (importPath: string): Cohesion => {
        let c = cohesion.get(importPath);
        if (!c) {
            c = cohesionOf(
                segments.get(importPath) ?? new Set(),
                pairs.get(importPath) ?? new Map(),
                utility
            );
            cohesion.set(importPath, c);
        }
        return c;
    };

    // Folder convention: app root and program root.
    const programRoot = commonRoot(input.files);
    const appRoot =
        ['src/app', 'app']
            .map(candidate => posix.join(programRoot, candidate))
            .find(candidate => fs.isDirectory(candidate)) ?? programRoot;
    const appLabel = (() => {
        for (let dir = appRoot; isInside(programRoot, dir) || dir === programRoot; ) {
            const name = fs.packageName(dir);
            if (name) {
                return name;
            }
            if (dir === programRoot || dir === '' || dir === '.') {
                break;
            }
            dir = posix.dirname(dir);
        }
        return 'app';
    })();
    const folderPlacement = (file: string): Placement => {
        const inApp = isInside(appRoot, file);
        const base = inApp ? appRoot : programRoot;
        const segs = segmentsBelow(base, file);
        const folder = inApp && containers.has(segs[0]) && segs.length > 1 ? segs[1] : segs[0];
        if (folder === undefined) {
            return { key: '', detector: 'folder', root: base, rootLabel: appLabel };
        }
        return {
            key: keyOfFolder(folder),
            detector: 'folder',
            root: firstFolder(base, file, folder),
            rootLabel: appLabel
        };
    };

    const validKey = (key: string, source: string): string | undefined => {
        if (isFeatureKey(key)) {
            return key;
        }
        warnOnce(
            `Ignoring feature key "${key}" from ${source}: expected one segment [a-z0-9][a-z0-9-]*`
        );
        return undefined;
    };

    const placementOf = (symbol: FeatureSymbol): Placement => {
        const o = owner(symbol.file);
        const scope = o
            ? {
                  entryPoint: o.entry.importPath,
                  root: o.root,
                  rootLabel: lastSegment(o.entry.importPath)
              }
            : { entryPoint: undefined, root: appRoot, rootLabel: appLabel };
        const configured = globs.find(g => g.re.test(symbol.file));
        const configKey = configured && validKey(configured.key, `features["${configured.glob}"]`);
        if (configKey) {
            return { ...scope, key: configKey, detector: 'config' };
        }
        const tagKey =
            symbol.tag !== undefined
                ? validKey(symbol.tag, `@feature in ${symbol.file}`)
                : undefined;
        if (tagKey) {
            return { ...scope, key: tagKey, detector: 'tag' };
        }
        if (!o) {
            return folderPlacement(symbol.file);
        }
        const c = cohesionFor(o.entry.importPath);
        const segment = segmentOf(o, symbol.file);
        const component = c.glued ? '' : c.componentOf(segment);
        if (component === '') {
            return { ...scope, key: '', detector: 'entry-point' };
        }
        return {
            ...scope,
            key: keyOfFolder(component),
            detector: 'cohesion',
            root: segmentFolders.get(`${o.entry.importPath}\0${component}`) ?? o.root
        };
    };

    const placements = new Map(input.symbols.map(symbol => [symbol.key, placementOf(symbol)]));

    // Two folders that give one derived key (e.g. two containers with the same
    // child): the first folder keeps the key, the others get `-2`, `-3`, ...
    const derived = new Map<string, string[]>();
    for (const p of placements.values()) {
        if ((p.detector === 'folder' || p.detector === 'cohesion') && p.key !== '') {
            const id = featureId(p.entryPoint, p.key);
            const roots = derived.get(id) ?? [];
            if (!roots.includes(p.root)) {
                roots.push(p.root);
            }
            derived.set(id, roots);
        }
    }
    const taken = new Set([...placements.values()].map(p => featureId(p.entryPoint, p.key)));
    const renamed = new Map<string, string>();
    for (const [id, roots] of derived) {
        if (roots.length < 2) {
            continue;
        }
        const [entryPoint, key] = [
            id.slice(0, id.lastIndexOf('#')),
            id.slice(id.lastIndexOf('#') + 1)
        ];
        for (const root of [...roots].sort(compareText).slice(1)) {
            let n = 2;
            while (taken.has(featureId(entryPoint || undefined, `${key}-${n}`))) {
                n++;
            }
            const next = `${key}-${n}`;
            taken.add(featureId(entryPoint || undefined, next));
            renamed.set(`${id}\0${root}`, next);
            warnOnce(
                `Feature key "${key}" of ${root} clashes with another folder; using "${next}"`
            );
        }
    }
    for (const [symbolKey, p] of placements) {
        const next = renamed.get(`${featureId(p.entryPoint, p.key)}\0${p.root}`);
        if (next) {
            placements.set(symbolKey, { ...p, key: next });
        }
    }

    // An entry point whose symbols all sit in one cohesion feature is its root feature.
    const keysByEntry = new Map<string, Set<string>>();
    for (const p of placements.values()) {
        if (p.entryPoint !== undefined) {
            const keys = keysByEntry.get(p.entryPoint) ?? new Set<string>();
            keys.add(p.detector === 'cohesion' ? p.key : `\0${p.key}`);
            keysByEntry.set(p.entryPoint, keys);
        }
    }
    const collapse = new Set(
        [...keysByEntry]
            .filter(([, keys]) => keys.size === 1 && ![...keys][0].startsWith('\0'))
            .map(([entryPoint]) => entryPoint)
    );

    const features = new Map<FeatureId, Feature>();
    const featureOf = new Map<string, FeatureId>();
    const entryByPath = new Map(entryPoints.map(entry => [entry.importPath, entry]));
    for (const symbol of input.symbols) {
        let p = placements.get(symbol.key) as Placement;
        if (p.detector === 'cohesion' && p.entryPoint !== undefined && collapse.has(p.entryPoint)) {
            const o = owner(symbol.file) as Owner;
            p = { ...p, key: '', detector: 'entry-point', root: o.root };
        }
        const id = featureId(p.entryPoint, p.key);
        featureOf.set(symbol.key, id);
        const known = features.get(id);
        if (known) {
            if (DETECTOR_RANK[p.detector] < DETECTOR_RANK[known.detector]) {
                features.set(id, { ...known, detector: p.detector });
            }
            continue;
        }
        const entry = p.entryPoint !== undefined ? entryByPath.get(p.entryPoint) : undefined;
        const root = p.key === '' && entry ? entry.root : p.root;
        const readmeDirs = p.key === '' && entry ? [posix.dirname(entry.file), entry.root] : [root];
        const readme = [...new Set(readmeDirs)]
            .map(dir => posix.join(dir, 'README.md'))
            .find(file => fs.isFile(file));
        features.set(id, {
            id,
            entryPoint: p.entryPoint,
            key: p.key,
            label: p.key === '' ? p.rootLabel : p.key,
            root,
            detector: p.detector,
            readme
        });
    }

    const sorted = [...features.values()].sort(
        (a, b) => compareText(a.entryPoint ?? '', b.entryPoint ?? '') || compareText(a.key, b.key)
    );
    return { model: { features: sorted, featureOf, families: [] }, warnings };
};

/** Detector counts for the build log. */
export const featureCounts = (model: FeatureModel): Readonly<Record<FeatureDetector, number>> => {
    const counts: Record<FeatureDetector, number> = {
        config: 0,
        tag: 0,
        cohesion: 0,
        'entry-point': 0,
        folder: 0
    };
    for (const feature of model.features) {
        counts[feature.detector]++;
    }
    return counts;
};

/** The one-line build log summary of the feature model. */
export const formatFeatureSummary = (model: FeatureModel): string => {
    const c = featureCounts(model);
    const entryPoints = new Set(model.features.flatMap(f => (f.entryPoint ? [f.entryPoint] : [])))
        .size;
    return (
        `Features: ${model.features.length} in ${entryPoints} entry points (config ${c.config}, ` +
        `tag ${c.tag}, cohesion ${c.cohesion}, entry point ${c['entry-point']}, folder ${c.folder})`
    );
};
