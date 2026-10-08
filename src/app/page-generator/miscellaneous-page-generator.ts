import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation, type UtilityKind } from '../links/layout';
import { symbolTarget } from '../links/resolve';

/** Engine object key the single-symbol page template reads, per kind. */
const PAGE_KINDS: readonly UtilityKind[] = ['function', 'variable', 'typealias', 'enumeration'];

const UTILITIES_PAGE = 'utilities';

/** The Utilities landing page and one page per function, constant, type alias and enum. */
export class MiscellaneousPageGenerator {
    public prepare(someMisc?): Promise<any> {
        logger.info('Prepare utilities');
        Configuration.mainData.miscellaneous = someMisc
            ? someMisc
            : DependenciesEngine.getMiscellaneous();

        return new Promise((resolve, _reject) => {
            const misc = Configuration.mainData.miscellaneous;
            const hasAny =
                misc.functions.length > 0 ||
                misc.variables.length > 0 ||
                misc.typealiases.length > 0 ||
                misc.enumerations.length > 0;
            if (hasAny) {
                const location = pageLocation({ type: 'root', page: UTILITIES_PAGE });
                Configuration.addPage({
                    path: location.path,
                    name: location.filename,
                    id: UTILITIES_PAGE,
                    context: UTILITIES_PAGE,
                    depth: location.depth,
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                });
            }

            this.enqueueSymbolPages();

            resolve(true);
        });
    }

    /** One page per symbol; overloads share one, same-name copies get their `-N` page. */
    private enqueueSymbolPages(): void {
        const table = Configuration.mainData.symbols;
        if (!table) {
            return;
        }
        for (const entry of table.byId.values()) {
            const kind = entry.ref.kind;
            if (!(PAGE_KINDS as readonly string[]).includes(kind)) {
                continue;
            }
            const location = pageLocation(symbolTarget(entry, { duplicate: true }));
            Configuration.addPage({
                path: location.path,
                name: `${kind}-${location.filename}`,
                filename: location.filename,
                id: `${kind}-${location.filename}`,
                context: kind,
                [kind]: entry.data,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            } as any);
        }
    }
}
