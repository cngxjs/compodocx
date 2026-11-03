import Html from '@kitajs/html';
import { renderEntityPage } from './EntityPage';

export const InterfacePage = (data: any): string =>
    renderEntityPage({
        entity: data.interface,
        entityKey: 'interface',
        breadcrumbLabel: 'interfaces',
        depth: data.depth,
        navTabs: data.navTabs,
        readmeAiGenerated: data.symbolReadmeAiGenerated,
        disableFilePath: data.disableFilePath,
        showExtends: true,
        showIndex: true,
        showConstructor: true,
        showMethods: true,
        showProperties: true,
        showIndexSignatures: true,
        showAccessors: true,
        contextLine: undefined,
        showJsdocBadges: true
    });
