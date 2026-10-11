/** The fields of a `package.json` the import line reads. */
export interface PackageManifest {
    readonly name?: unknown;
    readonly exports?: unknown;
}

const posixDirname = (file: string): string => file.slice(0, Math.max(0, file.lastIndexOf('/')));

/** The file an `exports` value points at, for a plain string or a condition object. */
const exportTarget = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object') {
        for (const condition of ['style', 'sass', 'default', 'import']) {
            const nested = (value as Record<string, unknown>)[condition];
            if (typeof nested === 'string') {
                return nested;
            }
        }
    }
    return undefined;
};

/** The subpath an export key gives `relative` (`./x` form), or undefined. */
const subpathOf = (key: string, target: string, relative: string): string | undefined => {
    const star = target.indexOf('*');
    if (star === -1) {
        return target === relative ? key : undefined;
    }
    if (target.indexOf('*', star + 1) !== -1 || key.split('*').length !== 2) {
        return undefined;
    }
    const head = target.slice(0, star);
    const tail = target.slice(star + 1);
    if (!relative.startsWith(head) || !relative.endsWith(tail)) {
        return undefined;
    }
    const match = relative.slice(head.length, relative.length - tail.length);
    return match.includes('*') ? undefined : key.replace('*', match);
};

/**
 * How a consumer loads a style file: `@use '<name>/<subpath>';` (SCSS) or
 * `@import '<name>/<subpath>';` (CSS), from the nearest `package.json` above
 * the file whose `exports` map the file exactly or through one `*` pattern.
 * Undefined without such an entry. `manifest(dir)` reads `<dir>/package.json`
 * (cwd-relative folders, `''` for the cwd).
 */
export const styleImportLine = (
    file: string,
    manifest: (dir: string) => PackageManifest | undefined
): string | undefined => {
    const keyword = /\.scss$/i.test(file) ? '@use' : '@import';
    for (let dir = posixDirname(file); ; dir = posixDirname(dir)) {
        const pkg = manifest(dir);
        if (pkg && typeof pkg.name === 'string') {
            const exports = pkg.exports;
            if (!exports || typeof exports !== 'object') {
                return undefined;
            }
            const relative = `./${dir ? file.slice(dir.length + 1) : file}`;
            for (const [key, value] of Object.entries(exports as Record<string, unknown>)) {
                const target = exportTarget(value);
                const subpath = target === undefined ? undefined : subpathOf(key, target, relative);
                if (subpath !== undefined) {
                    const specifier =
                        subpath === '.' ? pkg.name : `${pkg.name}/${subpath.replace(/^\.\//, '')}`;
                    return `${keyword} '${specifier}';`;
                }
            }
            return undefined;
        }
        if (dir === '') {
            return undefined;
        }
    }
};
