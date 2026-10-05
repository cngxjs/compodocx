export class RouteStore {
    public scannedFiles: any[] = [];
    public routes: any[] = [];
    public modules: any[] = [];
    public modulesWithRoutes: any[] = [];
    public rootModule: string;
    public modulesTree: any;
    public cleanModulesTree: any;

    public addRoute(route): void {
        this.routes.push(route);
        this.routes = [
            ...this.routes.filter(
                (item, i, self) => i === self.findIndex(other => other.name === item.name)
            )
        ].sort((a, b) => a.name.localeCompare(b.name));
    }

    public addModuleWithRoutes(moduleName, moduleImports, filename): void {
        this.modulesWithRoutes.push({
            name: moduleName,
            importsNode: moduleImports,
            filename: filename
        });
        this.modulesWithRoutes = [
            ...this.modulesWithRoutes.filter(
                (item, i, self) => i === self.findIndex(other => other.name === item.name)
            )
        ].sort((a, b) => a.name.localeCompare(b.name));
    }

    public addModule(moduleName: string, moduleImports): void {
        this.modules.push({
            name: moduleName,
            importsNode: moduleImports
        });
        this.modules = [
            ...this.modules.filter(
                (item, i, self) => i === self.findIndex(other => other.name === item.name)
            )
        ].sort((a, b) => a.name.localeCompare(b.name));
    }

    public setRootModule(module: string): void {
        this.rootModule = module;
    }

    public foundRouteWithModuleName(moduleName: string): any {
        return this.routes.find(r => r.module === moduleName);
    }

    public foundLazyModuleWithPath(modulePath: string): string {
        // path is like app/customers/customers.module#CustomersModule
        const split = modulePath.split('#');
        const lazyModuleName = split[1];
        return lazyModuleName;
    }

    public foundLazyComponentWithPath(componentPath: string): string {
        // path is like app/customers/customers.component#CustomersComponent
        const split = componentPath.split('#');
        const lazyComponentName = split[1];
        return lazyComponentName;
    }

    public routesLength(): number {
        let _n = 0;
        const routesParser = route => {
            if (typeof route.path !== 'undefined') {
                _n += 1;
            }
            if (route.children) {
                for (const j in route.children) {
                    routesParser(route.children[j]);
                }
            }
        };

        for (const i in this.routes) {
            routesParser(this.routes[i]);
        }

        return _n;
    }

    public printRoutes(): void {
        console.log('');
        console.log('printRoutes: ');
        console.log(this.routes);
    }

    public printModulesRoutes(): void {
        console.log('');
        console.log('printModulesRoutes: ');
        console.log(this.modulesWithRoutes);
    }

    public isVariableRoutes(node) {
        let result = false;
        if (node.declarationList?.declarations) {
            let i = 0;
            const len = node.declarationList.declarations.length;
            for (i; i < len; i++) {
                if (node.declarationList.declarations[i].type) {
                    if (
                        node.declarationList.declarations[i].type.typeName &&
                        node.declarationList.declarations[i].type.typeName.text === 'Routes'
                    ) {
                        result = true;
                    }
                }
            }
        }
        return result;
    }
}
