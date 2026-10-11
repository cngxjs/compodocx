import { hasAnyApiSections } from '../../templates/helpers/tab-helpers';
import { hasTheming, themingFor } from '../../templates/helpers/theming';
import { COMPODOC_CONSTANTS } from '../../utils/constants';
import Configuration from '../configuration';

/** Directives keep their own kind; every other symbol is looked up as a component. */
const themingKind = (dependency: { type?: unknown }): 'component' | 'directive' =>
    dependency.type === 'directive' ? 'directive' : 'component';

export class NavTabsResolver {
    public resolve(dependency): Array<any> {
        let navTabConfig = Configuration.mainData.navTabConfig;
        const hasCustomNavTabConfig = navTabConfig.length !== 0;
        navTabConfig =
            navTabConfig.length === 0
                ? structuredClone(COMPODOC_CONSTANTS.navTabDefinitions)
                : navTabConfig;
        const matchDepType = (depType: string) => {
            return depType === 'all' || depType === dependency.type;
        };

        const navTabs = [];
        navTabConfig.forEach(customTab => {
            const navTab = COMPODOC_CONSTANTS.navTabDefinitions.find(t => t.id === customTab.id);
            if (!navTab) {
                throw new Error(`Invalid tab ID '${customTab.id}' specified in tab configuration`);
            }

            navTab.label = customTab.label;

            if (hasCustomNavTabConfig) {
                (navTab as any).custom = true;
            }

            // is tab applicable to target dependency?
            if (-1 === navTab.depTypes.findIndex(matchDepType)) {
                return;
            }

            // global config
            if (customTab.id === 'tree' && Configuration.mainData.disableDomTree) {
                return;
            }
            if (customTab.id === 'source' && Configuration.mainData.disableSourceCode) {
                return;
            }
            if (customTab.id === 'templateData' && Configuration.mainData.disableTemplateTab) {
                return;
            }
            if (customTab.id === 'styleData' && Configuration.mainData.disableStyleTab) {
                return;
            }

            // per dependency config
            if (customTab.id === 'readme' && !dependency.readme) {
                return;
            }
            if (customTab.id === 'example' && !dependency.exampleUrls) {
                return;
            }
            if (
                customTab.id === 'templateData' &&
                (!dependency.templateUrl || dependency.templateUrl.length === 0)
            ) {
                return;
            }
            if (
                customTab.id === 'styleData' &&
                (!dependency.styleUrls || dependency.styleUrls.length === 0) &&
                (!dependency.styles || dependency.styles.length === 0)
            ) {
                return;
            }
            if (
                customTab.id === 'theming' &&
                !hasTheming(themingFor(dependency, themingKind(dependency), Configuration.mainData))
            ) {
                return;
            }
            if (customTab.id === 'playground') {
                if (Configuration.mainData.disablePlaygroundTab) {
                    return;
                }
                if (!dependency.playgrounds || dependency.playgrounds.length === 0) {
                    return;
                }
            }

            // API tab: drop it in legacy single-tab mode, or when the
            // dependency has no member content to populate it.
            if (customTab.id === 'api') {
                if (!hasAnyApiSections()) {
                    return;
                }
                const hasApiMembers = !!(
                    dependency.constructorObj ||
                    dependency.inputsClass?.length ||
                    dependency.outputsClass?.length ||
                    dependency.hostBindings?.length ||
                    dependency.hostListeners?.length ||
                    (dependency.methodsClass ?? dependency.methods)?.length ||
                    (dependency.propertiesClass ?? dependency.properties)?.length ||
                    dependency.indexSignatures?.length ||
                    (dependency.accessors && Object.keys(dependency.accessors).length)
                );
                if (!hasApiMembers) {
                    return;
                }
            }

            navTabs.push(navTab);
        });

        if (navTabs.length === 0) {
            throw new Error(`No valid navigation tabs have been defined for dependency type '${dependency.type}'. Specify \
at least one config for the 'info' or 'source' tab in --navTabConfig.`);
        }

        return navTabs;
    }
}
