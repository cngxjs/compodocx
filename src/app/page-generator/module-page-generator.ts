import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import type { IComponentDep } from '../compiler/angular/deps/component-dep.factory';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import type { NavTabsResolver } from './nav-tabs';

export class ModulePageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someModules?): Promise<any> {
        logger.info('Prepare modules');
        let i = 0;
        const _modules = someModules ? someModules : DependenciesEngine.getModules();
        // A component some NgModule declares is not standalone, whatever its decorator says
        const declaredNames = new Set<string>(
            DependenciesEngine.getModules().flatMap((m: any) =>
                (m.declarations ?? []).map((d: any) => d.name)
            )
        );

        return new Promise((resolve, _reject) => {
            Configuration.mainData.modules = _modules.map(ngModule => {
                ngModule.compodocxLinks = {
                    components: [],
                    directives: [],
                    injectables: [],
                    pipes: []
                };
                ['declarations', 'bootstrap', 'imports', 'exports'].forEach(metadataType => {
                    ngModule[metadataType] = ngModule[metadataType].filter(metaDataItem => {
                        switch (metaDataItem.type) {
                            case 'directive':
                                return DependenciesEngine.getDirectives().some(directive => {
                                    let selectedDirective;
                                    if (typeof metaDataItem.id !== 'undefined') {
                                        selectedDirective =
                                            (directive as any).id === metaDataItem.id;
                                    } else {
                                        selectedDirective =
                                            (directive as any).name === metaDataItem.name;
                                    }
                                    if (
                                        selectedDirective &&
                                        !ngModule.compodocxLinks.directives.includes(directive)
                                    ) {
                                        ngModule.compodocxLinks.directives.push(directive);
                                    }
                                    return selectedDirective;
                                });

                            case 'component':
                                return DependenciesEngine.getComponents().some(
                                    (component: IComponentDep) => {
                                        let selectedComponent;
                                        if (typeof metaDataItem.id !== 'undefined') {
                                            selectedComponent =
                                                (component as any).id === metaDataItem.id;
                                        } else {
                                            selectedComponent =
                                                (component as any).name === metaDataItem.name;
                                        }
                                        if (
                                            selectedComponent &&
                                            !ngModule.compodocxLinks.components.includes(component)
                                        ) {
                                            if (declaredNames.has((component as any).name)) {
                                                ngModule.compodocxLinks.components.push(component);
                                            }
                                        }
                                        return selectedComponent;
                                    }
                                );

                            case 'module':
                                return DependenciesEngine.getModules().some(
                                    module => (module as any).name === metaDataItem.name
                                );

                            case 'pipe':
                                return DependenciesEngine.getPipes().some(pipe => {
                                    let selectedPipe;
                                    if (typeof metaDataItem.id !== 'undefined') {
                                        selectedPipe = (pipe as any).id === metaDataItem.id;
                                    } else {
                                        selectedPipe = (pipe as any).name === metaDataItem.name;
                                    }
                                    if (
                                        selectedPipe &&
                                        !ngModule.compodocxLinks.pipes.includes(pipe)
                                    ) {
                                        ngModule.compodocxLinks.pipes.push(pipe);
                                    }
                                    return selectedPipe;
                                });

                            default:
                                return true;
                        }
                    });
                });
                ngModule.providers = ngModule.providers.filter(provider => {
                    return (
                        DependenciesEngine.getInjectables().some(injectable => {
                            const selectedInjectable = (injectable as any).name === provider.name;
                            if (
                                selectedInjectable &&
                                !ngModule.compodocxLinks.injectables.includes(injectable)
                            ) {
                                ngModule.compodocxLinks.injectables.push(injectable);
                            }
                            return selectedInjectable;
                        }) ||
                        DependenciesEngine.getInterceptors().some(
                            interceptor => (interceptor as any).name === provider.name
                        )
                    );
                });
                // Try fixing type undefined for each providers
                ngModule.providers.forEach(provider => {
                    if (
                        DependenciesEngine.getInjectables().find(
                            injectable => (injectable as any).name === provider.name
                        )
                    ) {
                        provider.type = 'injectable';
                    }
                    if (
                        DependenciesEngine.getInterceptors().find(
                            interceptor => (interceptor as any).name === provider.name
                        )
                    ) {
                        provider.type = 'interceptor';
                    }
                });
                // Order things
                ngModule.compodocxLinks.components = [...ngModule.compodocxLinks.components].sort(
                    (a, b) => a.name.localeCompare(b.name)
                );
                ngModule.compodocxLinks.directives = [...ngModule.compodocxLinks.directives].sort(
                    (a, b) => a.name.localeCompare(b.name)
                );
                ngModule.compodocxLinks.injectables = [...ngModule.compodocxLinks.injectables].sort(
                    (a, b) => a.name.localeCompare(b.name)
                );
                ngModule.compodocxLinks.pipes = [...ngModule.compodocxLinks.pipes].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );

                ngModule.declarations = [...ngModule.declarations].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                ngModule.entryComponents = [...ngModule.entryComponents].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                ngModule.providers = [...ngModule.providers].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                ngModule.imports = [...ngModule.imports].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                ngModule.exports = [...ngModule.exports].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );

                return ngModule;
            });

            Configuration.addPage({
                name: 'modules',
                id: 'modules',
                context: 'modules',
                depth: 0,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });

            const len = Configuration.mainData.modules.length;
            const loop = () => {
                if (i < len) {
                    if (
                        MarkdownEngine.hasNeighbourReadmeFile(
                            Configuration.mainData.modules[i].file
                        )
                    ) {
                        logger.info(
                            ` ${Configuration.mainData.modules[i].name} has a README file, include it`
                        );
                        const readme = MarkdownEngine.readNeighbourReadmeFile(
                            Configuration.mainData.modules[i].file
                        );
                        Configuration.mainData.modules[i].readme = markedAcl(readme);
                    }
                    Configuration.addPage({
                        path: 'modules',
                        name: Configuration.mainData.modules[i].name,
                        id: Configuration.mainData.modules[i].id,
                        navTabs: this.navTabs.resolve(Configuration.mainData.modules[i]),
                        context: 'module',
                        module: Configuration.mainData.modules[i],
                        depth: 1,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    });
                    i++;
                    loop();
                } else {
                    resolve(true);
                }
            };
            loop();
        });
    }
}
