import * as path from 'node:path';
import { logger } from '../../../utils/logger';
import Configuration from '../../configuration';

export class PublicApiFilter {
    private readonly allowedSymbols: Set<string> = new Set<string>();
    private readonly allowedFiles: Set<string> = new Set<string>();

    /**
     * Initialize public API filtering if enabled
     */
    public initializePublicApiFiltering(): void {
        if (
            Configuration.mainData.publicApiOnly &&
            Configuration.mainData.publicApiDeclarations.size > 0
        ) {
            logger.info('Public API filtering enabled');

            // Build set of allowed symbols and files
            for (const [symbolName, sourceFiles] of Configuration.mainData.publicApiDeclarations) {
                this.allowedSymbols.add(symbolName);
                for (const sourceFile of sourceFiles) {
                    this.allowedFiles.add(path.resolve(sourceFile));
                }
            }

            logger.info(
                `Allowed ${this.allowedSymbols.size} public API symbol(s) from ${this.allowedFiles.size} file(s)`
            );
        }
    }

    /**
     * Check if a symbol is part of the public API. A namespace member is
     * named `Ns.Member`; a module augmentation member (`byFile`) is never a
     * named export and counts when its file declares a public symbol.
     */
    public isSymbolAllowed(symbolName: string, fileName: string, byFile = false): boolean {
        // If public API filtering is not enabled, allow all symbols
        if (!Configuration.mainData.publicApiOnly) {
            return true;
        }

        // If no symbols are defined, allow all (fallback)
        if (this.allowedSymbols.size === 0) {
            return true;
        }

        const resolvedFileName = path.resolve(fileName);

        if (byFile) {
            return this.allowedFiles.has(resolvedFileName);
        }

        // Check if the symbol is explicitly allowed
        if (this.allowedSymbols.has(symbolName)) {
            // Verify the symbol is from an allowed file
            const allowedSourceFiles = Configuration.mainData.publicApiDeclarations.get(symbolName);
            if (allowedSourceFiles?.has(resolvedFileName)) {
                return true;
            }
        }

        return false;
    }
}
