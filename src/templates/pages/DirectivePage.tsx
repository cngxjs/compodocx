import Configuration from '../../app/configuration';
import { BlockTheming } from '../blocks/BlockTheming';
import { ContentSlotsSection } from '../blocks/ContentSlots';
import {
    MetadataChipsRow,
    MetadataCodeRow,
    MetadataHostDirectivesRow,
    MetadataSection
} from '../blocks/MetadataRow';
import { isInfoSection } from '../helpers';
import { hasTheming, themingFor } from '../helpers/theming';
import { renderEntityPage } from './EntityPage';

const DirectiveMetadata = (directive: any, depth: number): string => {
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
        rows.push(MetadataHostDirectivesRow(directive.hostDirectives, depth));
    }

    rows.push(MetadataChipsRow('extends', (directive.extends as string[]) ?? [], depth));
    rows.push(MetadataChipsRow('implements', (directive.implements as string[]) ?? [], depth));

    return MetadataSection({ rows }) + ContentSlotsSection(directive.slots);
};

/** The Theming tab of a directive: the style files that theme it (`@themes`). */
const DirectiveTheming = (directive: any, depth: number): string | undefined => {
    const theming = themingFor(directive, 'directive', Configuration.mainData, depth);
    if (!hasTheming(theming)) {
        return undefined;
    }
    return BlockTheming({
        tokens: [...theming.tokens],
        styleSources: [...theming.sources],
        overview: theming.overview,
        mixins: theming.mixins,
        linked: theming.linked,
        depth
    });
};

export const DirectivePage = (data: any): string =>
    renderEntityPage({
        entity: data.directive,
        entityKey: 'directive',
        breadcrumbLabel: 'directives',
        depth: data.depth,
        navTabs: data.navTabs,
        disableFilePath: data.disableFilePath,
        metadataHtml: DirectiveMetadata(data.directive, data.depth),
        themingHtml: DirectiveTheming(data.directive, data.depth),
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
