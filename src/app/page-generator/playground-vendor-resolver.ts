import * as path from 'node:path';
import * as fs from 'fs-extra';

import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import { resolveVendorPackages, type VendorFsReader } from '../engines/stackblitz';

/**
 * Resolve the `playgroundVendor` closure from the locally built `dist/` once
 * per build and stash it on `Configuration.mainData.playgroundVendorPackages`,
 * where the manifest builder reads it to embed the per-playground import
 * closure as `file:` dependencies.
 *
 * Mirrors {@link PlaygroundFileResolver}: real `fs` plugs an in-module reader;
 * the resolution logic itself is the pure `resolveVendorPackages`. Hard errors
 * (missing vendor root, an explicitly-named package absent) FAIL the build by
 * throwing - vendoring an unbuilt library would silently fall back to stale
 * registry versions, the exact skew this feature exists to kill. Glob misses
 * only warn.
 */
export class PlaygroundVendorResolver {
    public resolve(): void {
        const patterns = Configuration.mainData.playgroundVendor;
        if (!Array.isArray(patterns) || patterns.length === 0) {
            Configuration.mainData.playgroundVendorPackages = {};
            return;
        }

        const vendorRoot = path.resolve(Configuration.mainData.playgroundVendorRoot || 'dist');

        const reader: VendorFsReader = {
            exists: (p: string): boolean => {
                try {
                    return fs.existsSync(p);
                } catch {
                    return false;
                }
            },
            readFile: (p: string): string | null => {
                try {
                    return fs.readFileSync(p, 'utf8');
                } catch {
                    return null;
                }
            },
            listFiles: (dir: string): string[] => listFilesRecursive(dir)
        };

        const result = resolveVendorPackages(patterns, vendorRoot, reader, {
            includeSourcemaps: Configuration.mainData.playgroundVendorIncludeSourcemaps === true
        });

        for (const warning of result.warnings) {
            logger.warn(warning);
        }
        if (result.errors.length > 0) {
            for (const error of result.errors) {
                logger.error(error);
            }
            throw new Error(result.errors.join('; '));
        }

        Configuration.mainData.playgroundVendorPackages = result.packages;
        const count = Object.keys(result.packages).length;
        if (count > 0) {
            logger.info(`playgroundVendor: resolved ${count} package(s) from ${vendorRoot}`);
        }
    }
}

/**
 * Recursively list every file under `dir` (POSIX-joined). Skips nested
 * `node_modules` - a built `dist/` should not contain them, and walking one
 * would be both wrong and slow. Returns `[]` when `dir` is unreadable.
 */
const listFilesRecursive = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name === 'node_modules') {
                continue;
            }
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile()) {
                out.push(full.split(path.sep).join('/'));
            }
        }
    };
    walk(dir);
    return out;
};
