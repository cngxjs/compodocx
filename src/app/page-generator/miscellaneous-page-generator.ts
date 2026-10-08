import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { type MiscKind, pageLocation } from '../links/layout';
import { symbolTarget } from '../links/resolve';

/** Engine object key the single-symbol page template reads, per kind. */
const PAGE_KINDS: readonly MiscKind[] = ['function', 'variable', 'typealias', 'enumeration'];

/** Path, name and depth of a collection page; its file name is its page name. */
const collectionPage = (kind: MiscKind) => {
    const { path, filename, depth } = pageLocation({ type: 'misc-collection', kind });
    return { path, name: filename, depth };
};

export class MiscellaneousPageGenerator {
    public prepare(someMisc?): Promise<any> {
        logger.info('Prepare miscellaneous');
        Configuration.mainData.miscellaneous = someMisc
            ? someMisc
            : DependenciesEngine.getMiscellaneous();

        return new Promise((resolve, _reject) => {
            if (Configuration.mainData.miscellaneous.functions.length > 0) {
                Configuration.addPage({
                    ...collectionPage('function'),
                    id: 'miscellaneous-functions',
                    context: 'miscellaneous-functions',
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                });
            }
            if (Configuration.mainData.miscellaneous.variables.length > 0) {
                Configuration.addPage({
                    ...collectionPage('variable'),
                    id: 'miscellaneous-variables',
                    context: 'miscellaneous-variables',
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                });
            }
            if (Configuration.mainData.miscellaneous.typealiases.length > 0) {
                Configuration.addPage({
                    ...collectionPage('typealias'),
                    id: 'miscellaneous-typealiases',
                    context: 'miscellaneous-typealiases',
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                });
            }
            if (Configuration.mainData.miscellaneous.enumerations.length > 0) {
                Configuration.addPage({
                    ...collectionPage('enumeration'),
                    id: 'miscellaneous-enumerations',
                    context: 'miscellaneous-enumerations',
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
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
                context: `miscellaneous-${kind}`,
                [kind]: entry.data,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            } as any);
        }
    }
}
