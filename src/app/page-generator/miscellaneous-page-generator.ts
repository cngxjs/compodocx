import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { type MiscKind, pageLocation } from '../links/layout';

interface DetailSpec {
    readonly collectionKey: 'functions' | 'variables' | 'typealiases' | 'enumerations';
    readonly singularKind: 'function' | 'variable' | 'typealias' | 'enumeration';
    readonly dataKey: 'function' | 'variable' | 'typealias' | 'enumeration';
}

const DETAIL_SPECS: readonly DetailSpec[] = [
    { collectionKey: 'functions', singularKind: 'function', dataKey: 'function' },
    { collectionKey: 'variables', singularKind: 'variable', dataKey: 'variable' },
    { collectionKey: 'typealiases', singularKind: 'typealias', dataKey: 'typealias' },
    { collectionKey: 'enumerations', singularKind: 'enumeration', dataKey: 'enumeration' }
] as const;

/** Miscellaneous symbols with a non-empty `@category` tag get their own detail page
 * under `miscellaneous/<plural>/<name>.html`. Untagged entries remain inline anchors
 * on the shared collection page. */
const isTagged = (item: unknown): boolean => {
    const category = (item as { category?: unknown })?.category;
    return typeof category === 'string' && category.trim() !== '';
};

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

            this.enqueueTaggedDetailPages();

            resolve(true);
        });
    }

    private enqueueTaggedDetailPages(): void {
        const misc = Configuration.mainData.miscellaneous ?? {};
        for (const spec of DETAIL_SPECS) {
            const items = misc[spec.collectionKey] ?? [];
            for (const item of items) {
                if (!isTagged(item)) {
                    continue;
                }
                const location = pageLocation({
                    type: 'symbol',
                    kind: spec.singularKind,
                    name: item.name,
                    detail: true
                });
                Configuration.addPage({
                    path: location.path,
                    name: `miscellaneous-${spec.singularKind}-${item.name}`,
                    filename: location.filename,
                    id: `miscellaneous-${spec.singularKind}-${item.name}`,
                    context: `miscellaneous-${spec.singularKind}`,
                    [spec.dataKey]: item,
                    depth: location.depth,
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                } as any);
            }
        }
    }
}
