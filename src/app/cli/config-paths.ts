import * as path from 'node:path';

export interface ApplySources {
    readonly cwd: string;
    /** Folder of the config file, when one was loaded. */
    readonly configDir?: string;
}

/**
 * A file or folder path from the config file. Relative values resolve against
 * the config file's folder; absolute values, values without a config file and
 * values of a config file in the cwd stay as written.
 */
export const fromConfigFile = (value: string, sources: ApplySources): string => {
    if (!value || path.isAbsolute(value) || !sources.configDir) {
        return value;
    }
    if (path.resolve(sources.configDir) === path.resolve(sources.cwd)) {
        return value;
    }
    return path.resolve(sources.configDir, value);
};

/** `theme` holds a name or a path; only the path form is resolved. */
export const isThemePath = (value: string): boolean =>
    value.includes('/') || value.includes(path.sep) || value.endsWith('.css');
