import Html from '@kitajs/html';
import { renderEntityPage } from './EntityPage';

/** The "entity" context (TypeORM/custom entities). */
export const EntityDetailPage = (data: any): string =>
    renderEntityPage({
        entity: data.entity,
        entityKey: 'entity',
        breadcrumbLabel: 'entities',
        depth: data.depth,
        navTabs: data.navTabs,
        readmeAiGenerated: data.symbolReadmeAiGenerated,
        disableFilePath: data.disableFilePath,
        contextLine: undefined,
        showProperties: true,
        showJsdocBadges: true
    });
