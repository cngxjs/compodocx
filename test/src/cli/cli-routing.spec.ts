import type {
    ExportData,
    ExportRoute,
    ExportRouteRoot
} from '../../../src/app/interfaces/export-data.interface';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();
const RT = './test/fixtures/routing-app';

const run = (args: string[]): void => {
    const ls = shell('node', ['./bin/index-cli.js', ...args]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

const fullPaths = (routes: readonly ExportRoute[]): string[] =>
    routes.flatMap(route => [route.fullPath, ...fullPaths(route.children ?? [])]);

describe('CLI routes', () => {
    describe('JSON export of the routing app', () => {
        const out = `${tmp.name}-routing-json`;
        let roots: ExportRouteRoot[];

        beforeAll(() => {
            tmp.create(out);
            run([
                '-c',
                `${RT}/.compodocxrc.json`,
                '-p',
                `${RT}/tsconfig.json`,
                '-e',
                'json',
                '-d',
                out
            ]);
            roots = (JSON.parse(read(`${out}/documentation.json`)) as ExportData).routes ?? [];
        });
        afterAll(() => tmp.clean(out));

        it('writes one router root and one unmounted root', () => {
            expect(roots.map(root => [root.kind, root.config ?? root.array])).toEqual([
                ['router', 'baseConfig'],
                ['unmounted', 'PARTNER_ROUTES']
            ]);
            expect(roots[0].bootstraps).toEqual([
                { file: 'test/fixtures/routing-app/src/main.ts', line: 7, component: 'RtaShell' }
            ]);
            expect(roots[0].features?.map(f => f.source)).toEqual([
                'withComponentInputBinding()',
                'withHashLocation()'
            ]);
        });

        it('nests inline, spread and lazy children', () => {
            expect(fullPaths(roots[0].routes)).toEqual([
                '/',
                '/home',
                '/start',
                '/settings',
                '/account',
                '/account/profile',
                '/account/profile/edit',
                '/help',
                '/help/faq',
                '/preview',
                '/{rtaLegacyMatcher}',
                "/{rtaPathFor('reports')}",
                "/{rtaPathFor('reports')}/{rtaReportRoutes('reports')}",
                '/admin',
                '/admin',
                '/admin/users',
                '/admin/audit',
                '/admin/audit',
                '/admin/audit/:entry',
                '/admin/audit/:entry',
                '/remote',
                '/**'
            ]);
        });

        it('keeps every route field and links documented references by file', () => {
            const account = roots[0].routes.find(r => r.fullPath === '/account');
            expect(account).toMatchObject({
                component: { kind: 'symbol', name: 'RtaAccount' },
                canActivate: [{ name: 'rtaAuthGuard', source: 'rtaAuthGuard' }],
                canActivateChild: [{ name: 'rtaChildGuard' }],
                providers: [{ name: 'provideRtaAccountScope', call: true }],
                runGuardsAndResolvers: "'always'"
            });
            expect(account?.canActivate?.[0].file).toBe(
                'test/fixtures/routing-app/src/app/guards.ts'
            );
            expect(account?.children?.[0].resolve).toMatchObject({
                user: { name: 'rtaUserResolver' }
            });
            const remote = roots[0].routes.find(r => r.fullPath === '/remote');
            expect(remote?.loadChildren).toMatchObject({
                kind: 'external',
                specifier: '@rta/remote',
                name: 'REMOTE_ROUTES',
                lazy: true
            });
        });
    });

    describe('llm-md export of the routing app', () => {
        const out = `${tmp.name}-routing-llm`;
        let text: string;

        beforeAll(() => {
            tmp.create(out);
            run([
                '-c',
                `${RT}/.compodocxrc.json`,
                '-p',
                `${RT}/tsconfig.json`,
                '-e',
                'llm-md',
                '-d',
                out
            ]);
            text = read(`${out}/llm-context.md`);
        });
        afterAll(() => tmp.clean(out));

        it('renders a Routes section per root', () => {
            expect(text).toContain('## Routes');
            expect(text).toContain(
                '### Router (test/fixtures/routing-app/src/main.ts, baseConfig)'
            );
            expect(text).toContain('### Unmounted routes (PARTNER_ROUTES)');
            expect(text).toContain(
                "- `/account/profile/edit` -> RtaProfile canActivate: `rtaRoleGuard('owner', 'admin')`"
            );
        });
    });

    describe('a project without routes', () => {
        const out = `${tmp.name}-routing-none`;

        beforeAll(() => {
            tmp.create(out);
            run(['-p', './test/fixtures/semantic-library/tsconfig.json', '-e', 'json', '-d', out]);
        });
        afterAll(() => tmp.clean(out));

        it('writes no routes key', () => {
            const data = JSON.parse(read(`${out}/documentation.json`)) as ExportData;
            expect(data.routes).toBeUndefined();
            expect(data.schemaVersion).toBe(5);
        });
    });

    describe('disableRoutes and the removed disableRoutesGraph', () => {
        const off = `${tmp.name}-routing-off`;
        const old = `${tmp.name}-routing-old-flag`;
        let oldStdout: string;

        beforeAll(() => {
            tmp.create(off);
            tmp.create(old);
            const args = ['-c', `${RT}/.compodocxrc.json`, '-p', `${RT}/tsconfig.json`];
            run([...args, '-e', 'json', '--disableRoutes', '-d', off]);
            const ls = shell('node', [
                './bin/index-cli.js',
                ...args,
                '-e',
                'json',
                '--disableRoutesGraph',
                '-d',
                old
            ]);
            oldStdout = ls.stdout.toString();
        });
        afterAll(() => {
            tmp.clean(off);
            tmp.clean(old);
        });

        it('writes no routes and no route facts with disableRoutes', () => {
            const text = read(`${off}/documentation.json`);
            const data = JSON.parse(text) as ExportData;
            expect(data.routes).toBeUndefined();
            expect(text).not.toContain('"routedAt"');
            expect(text).not.toContain('"mountedAt"');
        });

        it('ignores disableRoutesGraph with a warning and keeps the routes', () => {
            expect(oldStdout).toContain(
                '--disableRoutesGraph is ignored: the routes graph is gone; use --disableRoutes'
            );
            const data = JSON.parse(read(`${old}/documentation.json`)) as ExportData;
            expect(data.routes?.length).toBe(2);
        });
    });
});
