export class RouteStore {
    public scannedFiles: any[] = [];
    public routes: any[] = [];

    public addRoute(route): void {
        this.routes.push(route);
        this.routes = [
            ...this.routes.filter(
                (item, i, self) => i === self.findIndex(other => other.name === item.name)
            )
        ].sort((a, b) => a.name.localeCompare(b.name));
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
