import Html from '@kitajs/html';
import { MetadataCodeRow, MetadataSection } from '../blocks/MetadataRow';
import { formatProvidedIn } from '../helpers';
import { renderEntityPage } from './EntityPage';

const TokenMetadata = (injectable: any): string => {
    if (!injectable.isToken) {
        return '';
    }
    const rows: string[] = [];
    if (injectable.tokenType) {
        rows.push(MetadataCodeRow('Type', injectable.tokenType));
    }
    if (injectable.providedIn) {
        rows.push(MetadataCodeRow('Provided in', formatProvidedIn(injectable.providedIn)));
    }
    return MetadataSection({ title: 'Token Metadata', rows });
};

export const InjectablePage = (data: any): string =>
    renderEntityPage({
        entity: data.injectable,
        entityKey: 'injectable',
        breadcrumbLabel: 'injectables',
        depth: data.depth,
        navTabs: data.navTabs,
        disableFilePath: data.disableFilePath,
        showExtends: true,
        showIndex: true,
        showConstructor: true,
        showMethods: true,
        showProperties: true,
        showAccessors: true,
        contextLine: data.injectable?.providedIn
            ? `providedIn: ${formatProvidedIn(data.injectable.providedIn)}`
            : undefined,
        showTokenBadge: true,
        showJsdocBadges: true,
        metadataHtml: TokenMetadata(data.injectable),
        relationships: data.relationships
    });
