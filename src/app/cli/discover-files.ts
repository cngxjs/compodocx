import * as path from 'node:path';
import fg from 'fast-glob';

import { logger } from '../../utils/logger';
import { EXCLUDE_PATTERNS, INCLUDE_PATTERNS } from '../../utils/utils';

/** The `files` / `include` / `exclude` keys of a config file or a tsconfig. */
export interface FileSelection {
    readonly files?: readonly string[];
    readonly include?: readonly string[];
    readonly exclude?: readonly string[];
}

export interface DiscoveryInput {
    /** Folder of the tsconfig; relative tsconfig `files` resolve against it. */
    readonly projectDir: string;
    /** Source folder given as CLI argument; the glob runs there instead of `projectDir`. */
    readonly sourceFolder?: string;
    /** Selection keys of the compodocx config file. */
    readonly config: FileSelection;
    /** Selection keys of the tsconfig (its own file, `extends` is not followed). */
    readonly tsconfig: FileSelection;
}

export interface DiscoveryPlan {
    /** Files taken as they are, before the glob results. */
    readonly seeded: readonly string[];
    readonly patterns: readonly string[];
    readonly ignore: readonly string[];
    readonly cwd: string;
}

/**
 * The glob that selects the documented files. Config `exclude` replaces the
 * default excludes, tsconfig `exclude` and `include` are added to the config
 * ones, tsconfig `files` (resolved against the tsconfig folder) replace the
 * config `files` and are globbed as well; without any include the default
 * patterns apply.
 */
export const discoveryPlan = (input: DiscoveryInput): DiscoveryPlan => {
    const seeded = input.tsconfig.files
        ? input.tsconfig.files.map(file => input.projectDir + path.sep + file)
        : [...(input.config.files ?? [])];
    const exclude = [
        ...(input.config.exclude ?? EXCLUDE_PATTERNS),
        ...(input.tsconfig.exclude ?? [])
    ];
    const include = [...(input.config.include ?? []), ...(input.tsconfig.include ?? []), ...seeded];
    return {
        seeded,
        patterns: include.length > 0 ? include : INCLUDE_PATTERNS,
        ignore: exclude,
        cwd: input.sourceFolder || input.projectDir
    };
};

const isSourceFile = (file: string): boolean =>
    path.extname(file) === '.ts' || path.extname(file) === '.tsx';

/**
 * The documented files of a project, sorted. Used for the start scan and
 * for every rescan in watch mode.
 */
export const discoverSourceFiles = async (input: DiscoveryInput): Promise<string[]> => {
    const plan = discoveryPlan(input);
    const files = [...plan.seeded];
    const stream = fg.stream([...plan.patterns], {
        cwd: plan.cwd,
        ignore: [...plan.ignore],
        absolute: true
    });
    stream.on('data', (entry: string | Buffer) => {
        const file = entry.toString();
        if (isSourceFile(file)) {
            logger.debug('Including', file);
            files.push(file);
        } else {
            logger.warn('Excluding', file);
        }
    });
    await new Promise(resolve => stream.on('end', resolve));
    // fast-glob streams files in non-deterministic order; sort so crawl order,
    // duplicate suffixes and tie order in name sorts are stable between runs.
    return files.sort();
};
