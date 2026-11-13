import Html from '@kitajs/html';
import { HeritageRows, MetadataCodeRow, MetadataSection } from '../blocks/MetadataRow';
import { renderEntityPage } from './EntityPage';

/**
 * `autoProvided` and `factory` of the `@Service` decorator, when written,
 * then extends and implements.
 */
const ServiceMetadata = (service: any, depth: number): string => {
    const rows: string[] = [];
    if (typeof service?.autoProvided === 'boolean') {
        rows.push(MetadataCodeRow('autoProvided', String(service.autoProvided)));
    }
    if (service?.factory) {
        rows.push(MetadataCodeRow('factory', Html.escapeHtml(service.factory) as string));
    }
    rows.push(...HeritageRows(service ?? {}, depth));
    return MetadataSection({ title: 'Service Metadata', rows });
};

/** Page of a class decorated with Angular's `@Service`. */
export const ServicePage = (data: any): string =>
    renderEntityPage({
        entity: data.service,
        entityKey: 'service',
        breadcrumbLabel: 'services',
        depth: data.depth,
        navTabs: data.navTabs,
        readmeAiGenerated: data.symbolReadmeAiGenerated,
        disableFilePath: data.disableFilePath,
        showExtends: true,
        showIndex: true,
        showConstructor: true,
        showMethods: true,
        showProperties: true,
        showAccessors: true,
        contextLine: data.service?.autoProvided === false ? 'autoProvided: false' : undefined,
        showJsdocBadges: true,
        metadataHtml: ServiceMetadata(data.service, data.depth),
        relationships: data.relationships
    });
