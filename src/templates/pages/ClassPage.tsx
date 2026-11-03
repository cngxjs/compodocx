import { renderEntityPage } from './EntityPage';

const classContextLine = (cls: any): string | undefined => {
    if (cls.extends?.length) {
        return `extends ${cls.extends[0]}`;
    }
    if (cls.implements?.length) {
        return `implements ${cls.implements[0]}`;
    }
    return undefined;
};

export const ClassPage = (data: any): string =>
    renderEntityPage({
        entity: data.class,
        entityKey: 'class',
        breadcrumbLabel: 'classes',
        depth: data.depth,
        navTabs: data.navTabs,
        readmeAiGenerated: data.symbolReadmeAiGenerated,
        disableFilePath: data.disableFilePath,
        showExtends: true,
        showIndex: true,
        showConstructor: true,
        showInputs: true,
        showOutputs: true,
        showHostBindings: true,
        showHostListeners: true,
        showMethods: true,
        showProperties: true,
        showIndexSignatures: true,
        showAccessors: true,
        showJsdocBadges: true,
        contextLine: classContextLine(data.class)
    });
