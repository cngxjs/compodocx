import type { ts } from 'ts-morph';

import { logger } from '../../utils/logger';
import type { SymbolTable } from '../links/symbol-table';
import {
    buildRouting,
    declarationKey,
    EMPTY_ROUTING,
    formatRoutingSummary,
    lazyResolver,
    nameRouting,
    type RoutingModel
} from '../routing';

/**
 * The route model of the documented files, read from the semantic program.
 * Runs before the crawler: the crawler re-binds the source files it shares
 * with the semantic program, after which the semantic checker no longer
 * resolves imports. Symbols are `file#name` keys until `nameRoutes`.
 * Without a program or with routes disabled the model is empty.
 */
export const draftRoutes = (
    program: ts.Program | undefined,
    files: readonly string[],
    cwd: string,
    disabled: boolean
): RoutingModel => {
    if (!program || disabled) {
        return EMPTY_ROUTING;
    }
    const symbolOf = declarationKey(cwd);
    return buildRouting({
        program,
        files,
        cwd,
        symbolOf,
        lazy: notes => lazyResolver(program, symbolOf, cwd, notes)
    });
};

/** The draft with the ids of the documented symbols. */
export const nameRoutes = (draft: RoutingModel | undefined, table: SymbolTable): RoutingModel =>
    draft && draft.roots.length > 0 ? nameRouting(draft, table) : EMPTY_ROUTING;

/** The `Routes:` line, and every note at debug level. */
export const logRouting = (model: RoutingModel): void => {
    logger.info(formatRoutingSummary(model));
    for (const note of model.notes) {
        logger.debug(`Routes: ${note.file}:${note.line} ${note.what}`);
    }
};
