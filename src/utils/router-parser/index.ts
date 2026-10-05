import type { SourceFile, ts } from 'ts-morph';

import { RawRouteCleaner } from './raw-route-cleaner';
import { RouteStore } from './route-store';
import { type RoutesTree, RoutesTreeBuilder } from './routes-tree-builder';
import { SourceFileCleaner } from './source-file-cleaner';

export class RouterParserUtil {
    private routeStore = new RouteStore();
    private rawRouteCleaner = new RawRouteCleaner();
    private routesTreeBuilder = new RoutesTreeBuilder(this.routeStore);
    private sourceFileCleaner = new SourceFileCleaner(this.routeStore);

    public get scannedFiles(): any[] {
        return this.routeStore.scannedFiles;
    }
    public set scannedFiles(value: any[]) {
        this.routeStore.scannedFiles = value;
    }

    private get routes(): any[] {
        return this.routeStore.routes;
    }
    private set routes(value: any[]) {
        this.routeStore.routes = value;
    }

    private static instance: RouterParserUtil;
    private constructor() {}
    public static getInstance() {
        if (!RouterParserUtil.instance) {
            RouterParserUtil.instance = new RouterParserUtil();
        }
        return RouterParserUtil.instance;
    }

    public addRoute(route): void {
        this.routeStore.addRoute(route);
    }

    public cleanRawRouteParsed(route: string): object {
        return this.rawRouteCleaner.cleanRawRouteParsed(route);
    }

    public cleanRawRoute(route: string): string {
        return this.rawRouteCleaner.cleanRawRoute(route);
    }

    public constructRoutesTree(): RoutesTree {
        return this.routesTreeBuilder.constructRoutesTree();
    }

    public generateRoutesIndex(outputFolder: string, routes: Array<any>): Promise<void> {
        return this.routesTreeBuilder.generateRoutesIndex(outputFolder, routes);
    }

    public routesLength(): number {
        return this.routeStore.routesLength();
    }

    public printRoutes(): void {
        this.routeStore.printRoutes();
    }

    public isVariableRoutes(node) {
        return this.routeStore.isVariableRoutes(node);
    }

    public cleanFileIdentifiers(sourceFile: SourceFile): SourceFile {
        return this.sourceFileCleaner.cleanFileIdentifiers(sourceFile);
    }

    public cleanFileSpreads(sourceFile: SourceFile): SourceFile {
        return this.sourceFileCleaner.cleanFileSpreads(sourceFile);
    }

    public cleanFileDynamics(sourceFile: SourceFile): SourceFile {
        return this.sourceFileCleaner.cleanFileDynamics(sourceFile);
    }

    /**
     * replace callexpressions with string : utils.doWork() -> 'utils.doWork()' doWork() -> 'doWork()'
     * @param sourceFile ts.SourceFile
     */
    public cleanCallExpressions(sourceFile: SourceFile): SourceFile {
        return this.sourceFileCleaner.cleanCallExpressions(sourceFile);
    }

    /**
     * Clean routes definition with imported data, for example path, children, or dynamic stuff inside data
     *
     * const MY_ROUTES: Routes = [
     *     {
     *         path: 'home',
     *         component: HomeComponent
     *     },
     *     {
     *         path: PATHS.home,
     *         component: HomeComponent
     *     }
     * ];
     *
     * The initializer is an array (ArrayLiteralExpression - 177 ), it has elements, objects (ObjectLiteralExpression - 178)
     * with properties (PropertyAssignment - 261)
     *
     * For each know property (https://angular.io/api/router/Routes#description), we try to see if we have what we want
     *
     * Ex: path and pathMatch want a string, component a component reference.
     *
     * It is an imperative approach, not a generic way, parsing all the tree
     * and find something like this which willl break JSON.stringify : MYIMPORT.path
     *
     * @param  {ts.Node} initializer The node of routes definition
     * @return {ts.Node}             The edited node
     */
    public cleanRoutesDefinitionWithImport(
        initializer: ts.ArrayLiteralExpression,
        _node: ts.Node,
        sourceFile: ts.SourceFile
    ): ts.Node {
        return this.sourceFileCleaner.cleanRoutesDefinitionWithImport(
            initializer,
            _node,
            sourceFile
        );
    }
}

export default RouterParserUtil.getInstance();
