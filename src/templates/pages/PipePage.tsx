import Html from '@kitajs/html';
import { MetadataCodeRow, MetadataSection } from '../blocks/MetadataRow';
import { isInfoSection, t } from '../helpers';
import { renderEntityPage } from './EntityPage';

const PipeMetadata = (pipe: any): string => {
    if (!isInfoSection('metadata')) {
        return '';
    }
    const rows: string[] = [];
    if (pipe.ngname) {
        rows.push(MetadataCodeRow(t('name'), pipe.ngname));
    }
    if (pipe.pure) {
        rows.push(MetadataCodeRow(t('pure'), String(pipe.pure)));
    }
    if (pipe.standalone) {
        rows.push(MetadataCodeRow(t('standalone'), String(pipe.standalone)));
    }
    return MetadataSection({ rows });
};

export const PipePage = (data: any): string =>
    renderEntityPage({
        entity: data.pipe,
        entityKey: 'pipe',
        breadcrumbLabel: 'pipes',
        depth: data.depth,
        navTabs: data.navTabs,
        disableFilePath: data.disableFilePath,
        metadataHtml: PipeMetadata(data.pipe),
        showMethods: true,
        showProperties: true,
        contextLine: data.pipe?.name ? `{{ value | ${data.pipe.name} }}` : undefined,
        showJsdocBadges: true,
        relationships: data.relationships
    });
