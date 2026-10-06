import { ContentSlotsSection } from '../blocks/ContentSlots';
import {
    MetadataChipsRow,
    MetadataCodeRow,
    MetadataHostDirectivesRow,
    MetadataSection
} from '../blocks/MetadataRow';
import { isInfoSection } from '../helpers';
import { renderEntityPage } from './EntityPage';

const DirectiveMetadata = (directive: any): string => {
    if (!isInfoSection('metadata')) {
        return '';
    }
    const hasMetadata =
        directive.selector || directive.hostDirectives?.length > 0 || directive.exportAs;
    const hasExtends = directive.extends?.length > 0;
    const hasImplements = directive.implements?.length > 0;
    if (!hasMetadata && !hasExtends && !hasImplements) {
        return '';
    }

    const rows: string[] = [];

    if (directive.selector) {
        rows.push(MetadataCodeRow('selector', directive.selector));
    }
    if (directive.exportAs) {
        rows.push(MetadataCodeRow('exportAs', directive.exportAs));
    }

    if (directive.hostDirectives?.length > 0) {
        rows.push(MetadataHostDirectivesRow(directive.hostDirectives));
    }

    rows.push(MetadataChipsRow('extends', (directive.extends as string[]) ?? []));
    rows.push(MetadataChipsRow('implements', (directive.implements as string[]) ?? []));

    return MetadataSection({ rows }) + ContentSlotsSection(directive.slots);
};

export const DirectivePage = (data: any): string =>
    renderEntityPage({
        entity: data.directive,
        entityKey: 'directive',
        breadcrumbLabel: 'directives',
        depth: data.depth,
        navTabs: data.navTabs,
        disableFilePath: data.disableFilePath,
        metadataHtml: DirectiveMetadata(data.directive),
        showExtends: false,
        showIndex: true,
        showConstructor: true,
        showInputs: true,
        showOutputs: true,
        showHostBindings: true,
        showHostListeners: true,
        showMethods: true,
        showProperties: true,
        showAccessors: true,
        showJsdocBadges: true,
        relationships: data.relationships,
        playgrounds: data.directive?.playgrounds,
        playgroundFiles: data.playgroundFiles,
        playgroundResolver: data.playgroundResolver,
        workspacePackage: data.workspacePackage,
        playgroundDependencies: data.playgroundDependencies,
        playgroundMaterialShell: data.playgroundMaterialShell,
        playgroundDepDepth: data.playgroundDepDepth,
        playgroundFileCountCap: data.playgroundFileCountCap,
        playgroundFileCap: data.playgroundFileCap,
        playgroundHead: data.playgroundHead,
        playgroundGlobalStyles: data.playgroundGlobalStyles,
        playgroundVendorPackages: data.playgroundVendorPackages,
        playgroundVendorCap: data.playgroundVendorCap
    });
