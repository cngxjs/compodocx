import type {
    ExportData,
    ExportRoute,
    ExportRouteRoot
} from '../../../src/app/interfaces/export-data.interface';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

/** `fullPath -> target` per route, children indented, from the JSON export. */
const routeLines = (routes: readonly ExportRoute[], depth = 0): string[] =>
    routes.flatMap(route => [
        `${'  '.repeat(depth)}${route.fullPath} -> ${
            route.component?.name ??
            route.loadChildren?.name ??
            (typeof route.redirectTo === 'string' ? `redirect ${route.redirectTo}` : '')
        }`,
        ...routeLines(route.children ?? [], depth + 1)
    ]);

const exportedRoutes = (folder: string): ExportRouteRoot[] =>
    (JSON.parse(read(`${folder}/documentation.json`)) as ExportData).routes ?? [];

describe('CLI Routes graph', () => {
    const distFolder = `${tmp.name}-routes-graph`;

    describe('disable it', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/simple/tsconfig.json',
                '--disableRoutes',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should write neither a routes page nor a routes script', () => {
            expect(exists(`${distFolder}/routes.html`)).to.be.false;
            expect(exists(`${distFolder}/js/routes/routes_index.js`)).to.be.false;
        });
    });

    describe('should support provideRouter', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/simple/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should list provideRouter in the app config providers', () => {
            const file = read(`${distFolder}/app-config.html`);
            expect(file).to.contain(
                '<a href="https://angular.dev/api/router/provideRouter" target="_blank">provideRouter()</a>'
            );
        });
    });

    describe('should support lazy-loaded routes with loadChildren syntax (containing possible trailing commas)', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/lazy-trailing-comma/tsconfig.json',
                '-e',
                'json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should expand the lazy routes', () => {
            expect(routeLines(exportedRoutes(distFolder)[0].routes)).toEqual([
                '/home -> HomeComponent',
                '/about -> ABOUT_ROUTES',
                '  /about -> AboutComponent',
                '/ -> redirect home',
                '/** -> redirect home'
            ]);
        });
    });

    describe('should support lazy-loaded routes with loadChildren syntax / async', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/lazy-async/tsconfig.json',
                '-e',
                'json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should expand the awaited lazy routes and keep a missing one unresolved', () => {
            const [root] = exportedRoutes(distFolder);
            expect(routeLines(root.routes)).toEqual([
                '/home -> HomeComponent',
                '/about -> ABOUT_ROUTES',
                '  /about -> AboutComponent',
                '/toto -> TOTO_ROUTES',
                '/ -> redirect home',
                '/** -> redirect home'
            ]);
            expect(root.routes[2].loadChildren?.kind).toBe('unresolved');
        });
    });

    describe('should support if statement for bootstrapApplication', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/bootstrap-if/tsconfig.json',
                '-e',
                'json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should find the router of a bootstrap inside an if', () => {
            const [root] = exportedRoutes(distFolder);
            expect(root.kind).toBe('router');
            expect(root.bootstraps?.[0].file).toContain('routing/bootstrap-if/src/main.ts');
            expect(routeLines(root.routes)).toEqual([
                '/home -> HomeComponent',
                '/about -> AboutComponent',
                '/ -> redirect home',
                '/** -> redirect home'
            ]);
        });
    });

    describe('should support route in external file', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/simple/tsconfig.json',
                '-e',
                'json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should follow spreads of route arrays in other files', () => {
            expect(routeLines(exportedRoutes(distFolder)[0].routes)).toEqual([
                '/home -> HomeComponent',
                '/login -> ',
                '/about -> ABOUT_ROUTES',
                '  /about -> AboutComponent',
                '/ -> redirect home',
                '/** -> redirect home'
            ]);
        });
    });
});
