import * as path from 'node:path';
import { ts } from 'ts-morph';
import ImportsUtil from '../imports.util';
import type { RouteStore } from './route-store';

export class ModuleLinker {
    constructor(private readonly routeStore: RouteStore) {}

    public hasRouterModuleInImports(imports: Array<any>): boolean {
        for (let i = 0; i < imports.length; i++) {
            if (
                imports[i].name.indexOf('RouterModule.forChild') !== -1 ||
                imports[i].name.indexOf('RouterModule.forRoot') !== -1 ||
                imports[i].name.indexOf('RouterModule') !== -1
            ) {
                return true;
            }
        }

        return false;
    }

    public linkModulesAndRoutes(): void {
        const modulesWithRoutes = this.routeStore.modulesWithRoutes;
        const routes = this.routeStore.routes;
        let i = 0;
        const len = modulesWithRoutes.length;
        for (i; i < len; i++) {
            modulesWithRoutes[i].importsNode.forEach((node: ts.Node) => {
                if (ts.isPropertyDeclaration(node)) {
                    const initializer = node.initializer as ts.ArrayLiteralExpression;
                    if (initializer) {
                        if (initializer.elements) {
                            (initializer.elements as unknown as ts.CallExpression[]).forEach(
                                (element: ts.CallExpression) => {
                                    // find element with arguments
                                    if (element.arguments) {
                                        (element.arguments as unknown as ts.Identifier[]).forEach(
                                            (argument: ts.Identifier) => {
                                                routes.forEach(route => {
                                                    if (
                                                        argument.text &&
                                                        route.name === argument.text &&
                                                        route.filename ===
                                                            modulesWithRoutes[i].filename
                                                    ) {
                                                        route.module = modulesWithRoutes[i].name;
                                                    } else if (
                                                        argument.text &&
                                                        route.name === argument.text &&
                                                        route.filename !==
                                                            modulesWithRoutes[i].filename
                                                    ) {
                                                        let argumentImportPath =
                                                            ImportsUtil.findFilePathOfImportedVariable(
                                                                argument.text,
                                                                modulesWithRoutes[i].filename
                                                            );

                                                        argumentImportPath = argumentImportPath
                                                            .replace(process.cwd() + path.sep, '')
                                                            .replace(/\\/g, '/');

                                                        if (
                                                            argument.text &&
                                                            route.name === argument.text &&
                                                            route.filename === argumentImportPath
                                                        ) {
                                                            route.module =
                                                                modulesWithRoutes[i].name;
                                                        }
                                                    }
                                                });
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    }
                }
                /**
                 * direct support of for example
                 * export const HomeRoutingModule: ModuleWithProviders = RouterModule.forChild(HOME_ROUTES);
                 */
                if (ts.isCallExpression(node)) {
                    if (node.arguments) {
                        (node.arguments as unknown as ts.Identifier[]).forEach(
                            (argument: ts.Identifier) => {
                                routes.forEach(route => {
                                    if (
                                        argument.text &&
                                        route.name === argument.text &&
                                        route.filename === modulesWithRoutes[i].filename
                                    ) {
                                        route.module = modulesWithRoutes[i].name;
                                    }
                                });
                            }
                        );
                    }
                }
            });
        }
    }
}
