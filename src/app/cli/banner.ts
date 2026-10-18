import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import osName from 'os-name';
import { ts } from 'ts-morph';

import AngularVersionUtil from '../../utils/angular-version.util';
import FileEngine from '../engines/file.engine';

export interface BannerContext {
    readonly pkgVersion: string;
    readonly cwd: string;
}

export interface BannerDisplayOptions {
    /** Mirrors `logger.silent`. When `true` (default state), the full banner prints; when `false`, the one-liner. */
    readonly loggerSilent: boolean;
    readonly isWatching: boolean;
    readonly isLlmMdStdoutMode: boolean;
}

export type BannerLogger = (line: string) => void;

/**
 * Resolve `src/banner` from either dev-tree (`<root>/src/app/cli/`) or the
 * published tarball (`<root>/dist/`). Mirrors the two-candidate scheme used
 * by `src/migrate/printer.ts:resolveBannerPath`.
 */
const resolveBannerPath = (): string | null => {
    const candidates = [
        path.join(__dirname, '..', '..', '..', 'src', 'banner'),
        path.join(__dirname, '..', 'src', 'banner')
    ];
    return candidates.find(p => fs.existsSync(p)) ?? null;
};

const readBannerText = (): string => {
    const p = resolveBannerPath();
    return p ? fs.readFileSync(p).toString() : '';
};

/**
 * Print the version block at the start of a doc-generation run.
 *
 * Dispatch matches the legacy `if (!logger.silent)` branch verbatim:
 *  - `isWatching` or `isLlmMdStdoutMode` → suppress entirely (downstream
 *    tools / SPA rebuilds never want it).
 *  - `loggerSilent === false` → one-liner `compodocx v<version>`.
 *  - `loggerSilent === true` (the default state) → full banner with TS, Node,
 *    and OS versions.
 *
 * The `log` injection point exists so tests can capture lines without
 * patching `console.log`.
 */
export function printBanner(
    ctx: BannerContext,
    opts: BannerDisplayOptions,
    log: BannerLogger = (line: string) => console.log(line)
): void {
    if (opts.isWatching || opts.isLlmMdStdoutMode) {
        return;
    }
    if (!opts.loggerSilent) {
        log(`compodocx v${ctx.pkgVersion}`);
        return;
    }
    log(readBannerText());
    log(ctx.pkgVersion);
    log('');
    log(`TypeScript version used by compodocx : ${ts.version}`);
    log('');

    const pkgJsonPath = `${ctx.cwd + path.sep}package.json`;
    if (FileEngine.existsSync(pkgJsonPath)) {
        const packageData = FileEngine.getSync(pkgJsonPath);
        if (packageData) {
            const parsedData = JSON.parse(packageData);
            const projectDevDependencies = parsedData.devDependencies;
            if (projectDevDependencies?.typescript) {
                const tsProjectVersion = AngularVersionUtil.cleanVersion(
                    projectDevDependencies.typescript
                );
                log(`TypeScript version of current project : ${tsProjectVersion}`);
                log('');
            }
        }
    }
    log(`Node.js version : ${process.version}`);
    log('');
    log(`Operating system : ${osName(os.platform(), os.release())}`);
    log('');
}
