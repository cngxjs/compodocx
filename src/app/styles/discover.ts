import { globToRegExp } from '../compiler/semantic/features';

/** Folders a `styleFiles` glob never descends into. */
const ALWAYS_EXCLUDED: readonly string[] = ['node_modules', 'dist', '.git'];

const STYLE_FILE = /\.(s?css)$/i;

/** Directory listing, paths relative to the base folder (`''` = the base). */
export interface StyleFs {
    readonly list: (dir: string) => readonly { readonly name: string; readonly dir: boolean }[];
}

export interface DiscoveredStyleFiles {
    /** Matched `.css` / `.scss` files, relative to the base folder, sorted. */
    readonly files: readonly string[];
    /** Matched files of another type, relative to the base folder, sorted. */
    readonly ignored: readonly string[];
}

/** `a/{b,c}/*.{css,scss}` -> every combination, braces expanded left to right. */
export const expandBraces = (glob: string): readonly string[] => {
    const open = glob.indexOf('{');
    const close = open === -1 ? -1 : glob.indexOf('}', open);
    if (open === -1 || close === -1) {
        return [glob];
    }
    const head = glob.slice(0, open);
    const tail = glob.slice(close + 1);
    return glob
        .slice(open + 1, close)
        .split(',')
        .flatMap(option => expandBraces(`${head}${option}${tail}`));
};

/** The folder below which a glob can match: its segments before the first wildcard. */
const staticPrefix = (glob: string): string => {
    const segments = glob.split('/');
    const fixed: string[] = [];
    for (const segment of segments.slice(0, -1)) {
        if (/[*?[]/.test(segment)) {
            break;
        }
        fixed.push(segment);
    }
    return fixed.join('/');
};

const normalise = (glob: string): string => glob.replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * The files the `styleFiles` globs match below the base folder. Globs are
 * relative to the base; `node_modules`, `dist`, `.git` and every folder in
 * `exclude` (base-relative, e.g. the output folder) are never entered.
 * Matches that are not `.css` / `.scss` are returned apart.
 */
export const discoverStyleFiles = (
    globs: readonly string[],
    exclude: readonly string[],
    fs: StyleFs
): DiscoveredStyleFiles => {
    const patterns = globs.flatMap(glob => expandBraces(normalise(glob)));
    const matchers = patterns.map(pattern => globToRegExp(pattern));
    const skip = new Set(exclude.map(dir => normalise(dir).replace(/\/+$/, '')));
    const matched = new Set<string>();
    const walk = (dir: string): void => {
        for (const entry of fs.list(dir)) {
            const path = dir ? `${dir}/${entry.name}` : entry.name;
            if (entry.dir) {
                if (!ALWAYS_EXCLUDED.includes(entry.name) && !skip.has(path)) {
                    walk(path);
                }
            } else if (matchers.some(re => re.test(path))) {
                matched.add(path);
            }
        }
    };
    const prefixes = [...new Set(patterns.map(staticPrefix))].filter(
        prefix => !prefix.split('/').some(segment => ALWAYS_EXCLUDED.includes(segment))
    );
    const covered = (prefix: string): boolean =>
        prefixes.some(
            other => other !== prefix && (other === '' || prefix.startsWith(`${other}/`))
        );
    for (const prefix of prefixes.filter(prefix => !covered(prefix))) {
        walk(prefix);
    }
    const sorted = [...matched].sort();
    return {
        files: sorted.filter(file => STYLE_FILE.test(file)),
        ignored: sorted.filter(file => !STYLE_FILE.test(file))
    };
};
