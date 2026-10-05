import type { SourceFile, ts } from 'ts-morph';

import { ModuleLinker } from './module-linker';
import { RawRouteCleaner } from './raw-route-cleaner';
import { RouteStore } from './route-store';
import { RoutesTreeBuilder } from './routes-tree-builder';
import { SourceFileCleaner } from './source-file-cleaner';

export class RouterParserUtil {
    private routeStore = new RouteStore();
    private rawRouteCleaner = new RawRouteCleaner();
    private moduleLinker = new ModuleLinker(this.routeStore);
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
    private get modules(): any[] {
        return this.routeStore.modules;
    }
    private set modules(value: any[]) {
        this.routeStore.modules = value;
    }
    private get modulesWithRoutes(): any[] {
        return this.routeStore.modulesWithRoutes;
    }
    private set modulesWithRoutes(value: any[]) {
        this.routeStore.modulesWithRoutes = value;
    }
    private get rootModule(): string {
        return this.routeStore.rootModule;
    }
    private set rootModule(value: string) {
        this.routeStore.rootModule = value;
    }
    private get modulesTree(): any {
        return this.routeStore.modulesTree;
    }
    private set modulesTree(value: any) {
        this.routeStore.modulesTree = value;
    }
    private get cleanModulesTree(): any {
        return this.routeStore.cleanModulesTree;
    }
    private set cleanModulesTree(value: any) {
        this.routeStore.cleanModulesTree = value;
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

    public addModuleWithRoutes(moduleName, moduleImports, filename): void {
        this.routeStore.addModuleWithRoutes(moduleName, moduleImports, filename);
    }

    public addModule(moduleName: string, moduleImports): void {
        this.routeStore.addModule(moduleName, moduleImports);
    }

    public cleanRawRouteParsed(route: string): object {
        return this.rawRouteCleaner.cleanRawRouteParsed(route);
    }

    public cleanRawRoute(route: string): string {
        return this.rawRouteCleaner.cleanRawRoute(route);
    }

    public setRootModule(module: string): void {
        this.routeStore.setRootModule(module);
    }

    public hasRouterModuleInImports(imports: Array<any>): boolean {
        return this.moduleLinker.hasRouterModuleInImports(imports);
    }

    public linkModulesAndRoutes(): void {
        this.moduleLinker.linkModulesAndRoutes();
    }

    public foundRouteWithModuleName(moduleName: string): any {
        return this.routeStore.foundRouteWithModuleName(moduleName);
    }

    public foundLazyModuleWithPath(modulePath: string): string {
        return this.routeStore.foundLazyModuleWithPath(modulePath);
    }

    public foundLazyComponentWithPath(componentPath: string): string {
        return this.routeStore.foundLazyComponentWithPath(componentPath);
    }

    public constructRoutesTree() {
        return this.routesTreeBuilder.constructRoutesTree();
    }

    public constructModulesTree(): void {
        this.routesTreeBuilder.constructModulesTree();
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

    public printModulesRoutes(): void {
        this.routeStore.printModulesRoutes();
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
