import * as path from 'node:path';
import * as fs from 'fs-extra';
import { logger } from './logger';

/**
 * Utility class for mapping dist declaration file paths to source file paths
 */
class SourcePathMapper {
    private distPath: string;
    private sourceRoot: string;
    private cachedMappings: Map<string, string>;

    constructor(distPath: string, sourceRoot: string) {
        this.distPath = path.resolve(distPath);
        this.sourceRoot = path.resolve(sourceRoot);
        this.cachedMappings = new Map<string, string>();
    }

    /**
     * Map a dist declaration file path to its corresponding source file
     * @param distFilePath Absolute path to .d.ts file in dist
     * @returns Absolute path to source .ts file, or null if not found
     */
    public mapDistToSource(distFilePath: string): string | null {
        // Check cache first
        if (this.cachedMappings.has(distFilePath)) {
            return this.cachedMappings.get(distFilePath)!;
        }

        const result = this.findSourceFile(distFilePath);

        // Cache the result (even if null)
        this.cachedMappings.set(distFilePath, result);

        if (result) {
            logger.debug(`Mapped ${distFilePath} -> ${result}`);
        } else {
            logger.debug(`Could not map dist file to source: ${distFilePath}`);
        }

        return result;
    }

    /**
     * Find the source file corresponding to a dist declaration file
     */
    private findSourceFile(distFilePath: string): string | null {
        // Get the relative path from dist root
        const relativePath = path.relative(this.distPath, distFilePath);

        // Remove .d.ts extension, leaving .ts
        const withoutDTs = relativePath.replace(/\.d\.ts$/, '.ts');

        // Try common patterns
        const patterns = this.generateSourcePatterns(withoutDTs);

        for (const pattern of patterns) {
            const fullPath = path.join(this.sourceRoot, pattern);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    /**
     * Generate possible source file path patterns
     * Handles common library build structures
     */
    private generateSourcePatterns(relativePath: string): string[] {
        const patterns: string[] = [];

        // Pattern 1: Direct mapping
        // dist/libs/my-lib/core/index.d.ts -> libs/my-lib/core/src/index.ts
        patterns.push(relativePath);

        // Pattern 2: Add 'src' directory
        // dist/libs/my-lib/core/index.d.ts -> libs/my-lib/core/src/index.ts
        const parts = relativePath.split(path.sep);
        if (parts.length > 1) {
            // Insert 'src' before the last part (filename)
            const filename = parts[parts.length - 1];
            const dirs = parts.slice(0, -1);
            patterns.push(path.join(...dirs, 'src', filename));
        }

        // Pattern 3: ng-packagr pattern - remove dist prefix and add src
        // dist/libs/my-lib/core/core.module.d.ts -> libs/my-lib/core/src/core.module.ts
        if (
            relativePath.startsWith(`libs${path.sep}`) ||
            relativePath.startsWith(`packages${path.sep}`)
        ) {
            const withoutLeading = relativePath;
            const pathParts = withoutLeading.split(path.sep);
            if (pathParts.length > 2) {
                const filename = pathParts[pathParts.length - 1];
                const dirs = pathParts.slice(0, -1);
                patterns.push(path.join(...dirs, 'src', filename));
            }
        }

        // Pattern 4: Flat structure with src
        // dist/core/index.d.ts -> src/core/index.ts
        patterns.push(path.join('src', relativePath));

        // Pattern 5: Handle esm2022 and fesm2022 folders (skip them)
        // dist/esm2022/core/index.mjs -> libs/core/src/index.ts
        const cleanedPath = relativePath
            .replace(/^esm\d+[/\\]/, '')
            .replace(/^fesm\d+[/\\]/, '')
            .replace(/\.mjs$/, '.ts');
        patterns.push(cleanedPath);
        patterns.push(path.join('src', cleanedPath));

        return patterns;
    }

    /**
     * Map multiple dist files to source files
     */
    public mapMultipleDistToSource(distFiles: Set<string>): Map<string, string> {
        const result = new Map<string, string>();

        for (const distFile of distFiles) {
            const sourceFile = this.mapDistToSource(distFile);
            if (sourceFile) {
                result.set(distFile, sourceFile);
            }
        }

        return result;
    }

    /**
     * Get source files for all declaration files that export a given symbol
     */
    public getSourceFilesForSymbol(
        symbolName: string,
        symbolToFiles: Map<string, Set<string>>
    ): Set<string> {
        const sourceFiles = new Set<string>();

        const declarationFiles = symbolToFiles.get(symbolName);
        if (!declarationFiles) {
            return sourceFiles;
        }

        for (const declFile of declarationFiles) {
            const sourceFile = this.mapDistToSource(declFile);
            if (sourceFile) {
                sourceFiles.add(sourceFile);
            }
        }

        return sourceFiles;
    }
}

/**
 * Create a source path mapper instance
 */
export function createSourcePathMapper(
    distPath: string,
    sourceRoot: string = process.cwd()
): SourcePathMapper {
    return new SourcePathMapper(distPath, sourceRoot);
}
