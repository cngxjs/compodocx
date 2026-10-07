import type { ts } from 'ts-morph';

import { AngularDependencies } from '../compiler/angular-dependencies';

export interface CrawlerConfig {
    readonly tsconfigDirectory: string;
    /** Already parsed source files to reuse instead of parsing them again. */
    readonly sharedSourceFile?: (fileName: string) => ts.SourceFile | undefined;
}

export type DependenciesData = ReturnType<AngularDependencies['getDependencies']>;

export function crawlDependencies(
    files: ReadonlyArray<string>,
    cfg: CrawlerConfig
): DependenciesData {
    const crawler = new AngularDependencies([...files], {
        tsconfigDirectory: cfg.tsconfigDirectory,
        sharedSourceFile: cfg.sharedSourceFile
    });
    return crawler.getDependencies();
}

export function crawlMicroDependencies(
    updatedFiles: ReadonlyArray<string>,
    cfg: CrawlerConfig
): DependenciesData {
    const crawler = new AngularDependencies([...updatedFiles], {
        tsconfigDirectory: cfg.tsconfigDirectory,
        sharedSourceFile: cfg.sharedSourceFile
    });
    return crawler.getDependencies();
}
