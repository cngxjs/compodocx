import * as fs from 'fs-extra';

import { isErr } from '../../lib';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import {
    type FileRefBundle,
    type FsReader,
    type PlaygroundConfigBundle,
    readFileRef,
    readPlaygroundConfig
} from '../engines/stackblitz';

/**
 * Walk every entity kind that may carry `@playground fileRef` blocks
 * (components/directives/injectables/etc) and resolve each fileRef into
 * a `FileRefBundle` keyed by `${entityName}:${blockIndex}`. Read failures
 * surface as `logger.warn` and skip that block - the manifest builder
 * then falls back to its "Project assembly failed" path. Inline-only
 * playgrounds never enter this loop.
 *
 * Also resolves a component-level `@playgroundConfig <path>` once per entity
 * and merges the resulting `app.config.ts` (plus its import closure) into
 * EVERY playground block on that entity - inline blocks get a bundle created
 * for them. The config file overrides the scaffold's default `app.config.ts`,
 * so `bootstrapApplication(App, appConfig)` picks up the author's providers.
 */
export class PlaygroundFileResolver {
    public resolve(): void {
        const fsReader: FsReader = {
            readFile: (p: string): string | null => {
                try {
                    return fs.readFileSync(p, 'utf8');
                } catch {
                    return null;
                }
            },
            exists: (p: string): boolean => {
                try {
                    return fs.existsSync(p);
                } catch {
                    return false;
                }
            }
        };

        const out: Record<string, FileRefBundle> = {};
        const entitySources = [
            Configuration.mainData.components,
            Configuration.mainData.directives,
            Configuration.mainData.injectables,
            Configuration.mainData.services,
            Configuration.mainData.guards,
            Configuration.mainData.interceptors,
            Configuration.mainData.pipes,
            Configuration.mainData.classes,
            Configuration.mainData.interfaces,
            Configuration.mainData.entities
        ];

        for (const list of entitySources) {
            if (!Array.isArray(list)) {
                continue;
            }
            for (const entity of list) {
                const playgrounds = entity?.playgrounds as
                    | Array<{ title?: string; fileRef?: string }>
                    | undefined;
                if (!playgrounds || playgrounds.length === 0) {
                    continue;
                }
                const hostFile = entity.file;
                const hasHost = typeof hostFile === 'string' && hostFile.length > 0;

                for (let i = 0; i < playgrounds.length; i++) {
                    const block = playgrounds[i];
                    if (!block?.fileRef) {
                        continue;
                    }
                    if (!hasHost) {
                        logger.warn(
                            `Playground "${block.title ?? '<untitled>'}" on ${entity.name}: missing host file path`
                        );
                        continue;
                    }
                    const result = readFileRef(block.fileRef, hostFile, fsReader, {
                        maxFiles: Configuration.mainData.playgroundFileCountCap
                    });
                    if (isErr(result)) {
                        logger.warn(
                            `Playground "${block.title ?? '<untitled>'}" on ${entity.name}: ${result.message}`
                        );
                        continue;
                    }
                    out[`${entity.name}:${i}`] = result.value;
                }

                // Component-level `@playgroundConfig` - resolve once, merge into
                // every block on the entity (creating a bundle for inline ones).
                const configRef = (entity as { playgroundConfig?: string }).playgroundConfig;
                if (configRef && hasHost) {
                    const configResult = readPlaygroundConfig(configRef, hostFile, fsReader);
                    if (isErr(configResult)) {
                        logger.warn(
                            `@playgroundConfig "${configRef}" on ${entity.name}: ${configResult.message}`
                        );
                    } else {
                        for (let i = 0; i < playgrounds.length; i++) {
                            const key = `${entity.name}:${i}`;
                            out[key] = mergeConfigIntoBundle(
                                out[key],
                                configRef,
                                configResult.value
                            );
                        }
                    }
                }
            }
        }

        Configuration.mainData.playgroundFiles = out;
    }
}

/**
 * Fold a resolved `@playgroundConfig` bundle into a playground's bundle. For a
 * fileRef block the existing bundle is augmented (config `app.config.ts` +
 * deps win on collision, so the annotation beats a re-exported config). For an
 * inline block (no existing bundle) a minimal config-only bundle is created:
 * `replacesAppComponent: false` and no `htmlSnippet`, so the manifest builder
 * still treats the block as inline but ships the config files - overriding the
 * scaffold's default `app.config.ts`.
 */
const mergeConfigIntoBundle = (
    existing: FileRefBundle | undefined,
    configEntry: string,
    config: PlaygroundConfigBundle
): FileRefBundle => {
    if (!existing) {
        return {
            entry: configEntry,
            files: { ...config.files },
            bareSpecifiers: new Set(config.bareSpecifiers),
            replacesAppComponent: false
        };
    }
    const bareSpecifiers = new Set(existing.bareSpecifiers);
    for (const spec of config.bareSpecifiers) {
        bareSpecifiers.add(spec);
    }
    return {
        ...existing,
        files: { ...existing.files, ...config.files },
        bareSpecifiers
    };
};
