import * as path from 'node:path';
import * as fs from 'fs-extra';

import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import {
    AUTO_FORWARD_SKIP,
    extractImports,
    type PackageReader,
    validateImports
} from '../engines/stackblitz';

/**
 * Pre-publish breakage guard for the NON-vendored playground path.
 *
 * For every `@playground` whose imports resolve from the npm registry, scan
 * the bundled TS sources and check each bare import against the version of the
 * package actually installed in the consumer's `node_modules`. A subpath or
 * named symbol the pinned version is missing means the playground compiles
 * locally but fails in StackBlitz - surfaced here at docs-build time.
 *
 * Default behaviour is a `logger.warn` per issue; `--strictPlaygrounds`
 * promotes any issue to a hard build failure. Vendored packages
 * (`playgroundVendor`) are exempt - they ship the local build, not the
 * registry version - and so are framework peers (`@angular/*`, `rxjs`, …).
 *
 * The validation logic itself is the pure `validateImports`; this class only
 * collects per-playground sources from `mainData` and plugs a real
 * `node_modules` reader.
 */
export class PlaygroundValidator {
    /**
     * @param reader Package reader for the pinned versions. Defaults to the
     * consumer's `node_modules`; injectable for tests.
     */
    public resolve(reader: PackageReader = createNodeModulesReader(process.cwd())): void {
        // Skip framework peers (handled by the manifest's explicit dep table)
        // and any package that COULD be vendored - vendored packages ship the
        // local build, so the registry version is irrelevant to them.
        const skip = new Set<string>([
            ...AUTO_FORWARD_SKIP,
            ...Object.keys(Configuration.mainData.playgroundVendorPackages ?? {})
        ]);

        const playgroundFiles = Configuration.mainData.playgroundFiles ?? {};
        const entitySources = [
            Configuration.mainData.components,
            Configuration.mainData.directives,
            Configuration.mainData.injectables,
            Configuration.mainData.guards,
            Configuration.mainData.interceptors,
            Configuration.mainData.pipes,
            Configuration.mainData.classes,
            Configuration.mainData.interfaces,
            Configuration.mainData.entities
        ];

        let totalIssues = 0;

        for (const list of entitySources) {
            if (!Array.isArray(list)) {
                continue;
            }
            for (const entity of list) {
                const playgrounds = entity?.playgrounds as
                    | Array<{ title?: string; snippet?: string; language?: string }>
                    | undefined;
                if (!playgrounds || playgrounds.length === 0) {
                    continue;
                }
                for (let i = 0; i < playgrounds.length; i++) {
                    const block = playgrounds[i];
                    const sources = collectSources(
                        entity,
                        block,
                        playgroundFiles[`${entity.name}:${i}`]
                    );
                    if (sources.length === 0) {
                        continue;
                    }
                    const imports = extractImports(sources.join('\n'));
                    const issues = validateImports(imports, reader, skip);
                    for (const issue of issues) {
                        logger.warn(
                            `Playground "${block.title ?? '<untitled>'}" on ${entity.name}: ${issue.message}`
                        );
                    }
                    totalIssues += issues.length;
                }
            }
        }

        if (totalIssues > 0 && Configuration.mainData.strictPlaygrounds) {
            throw new Error(
                `strictPlaygrounds: ${totalIssues} playground import(s) reference a subpath or symbol absent from the pinned dependency version — see the warnings above`
            );
        }
    }
}

/**
 * Gather the TS sources that ship in one playground's StackBlitz project:
 * the documented entity's own source, every file in its resolved file-ref
 * bundle, and a TypeScript/JavaScript inline snippet. HTML snippets carry no
 * registry imports, so they are ignored.
 */
const collectSources = (
    entity: { sourceCode?: string },
    block: { snippet?: string; language?: string },
    bundle: { files?: Record<string, string> } | undefined
): string[] => {
    const sources: string[] = [];
    if (typeof entity?.sourceCode === 'string' && entity.sourceCode.length > 0) {
        sources.push(entity.sourceCode);
    }
    if (bundle?.files) {
        for (const content of Object.values(bundle.files)) {
            if (typeof content === 'string') {
                sources.push(content);
            }
        }
    }
    if (
        typeof block.snippet === 'string' &&
        (block.language === 'typescript' || block.language === 'javascript')
    ) {
        sources.push(block.snippet);
    }
    return sources;
};

/** A {@link PackageReader} backed by the consumer's `node_modules`. */
const createNodeModulesReader = (cwd: string): PackageReader => {
    const nm = path.join(cwd, 'node_modules');
    return {
        hasPackage: (root: string): boolean => {
            try {
                return fs.existsSync(path.join(nm, root, 'package.json'));
            } catch {
                return false;
            }
        },
        readPackageJson: (root: string) => {
            try {
                return JSON.parse(fs.readFileSync(path.join(nm, root, 'package.json'), 'utf8'));
            } catch {
                return null;
            }
        },
        readPackageFile: (root: string, rel: string): string | null => {
            try {
                return fs.readFileSync(path.join(nm, root, rel), 'utf8');
            } catch {
                return null;
            }
        }
    };
};
