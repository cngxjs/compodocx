import { shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const stripAnsi = (text: string): string => text.replaceAll(/\x1b\[[0-9;]*m/g, '');

const run = (fixture: string, distFolder: string) => {
    const ls = shell('node', [
        './bin/index-cli.js',
        '-p',
        `./test/fixtures/${fixture}/tsconfig.json`,
        '-e',
        'json',
        '-d',
        distFolder
    ]);
    return { status: ls.status, stdout: stripAnsi(ls.stdout.toString()) };
};

describe('CLI legacy notice', () => {
    const moduleFolder = `${tmp.name}-legacy-notice-module`;
    const standaloneFolder = `${tmp.name}-legacy-notice-standalone`;
    let legacy: ReturnType<typeof run>;
    let modern: ReturnType<typeof run>;

    beforeAll(() => {
        tmp.create(moduleFolder);
        tmp.create(standaloneFolder);
        legacy = run('kitchen-sink-module', moduleFolder);
        modern = run('kitchen-sink-standalone', standaloneFolder);
    });
    afterAll(() => {
        tmp.clean(moduleFolder);
        tmp.clean(standaloneFolder);
    });

    it('warns with the count of legacy constructs and exits 0', () => {
        expect(legacy.status).to.equal(0);
        expect(legacy.stdout).to.contain(
            'Angular 21+ only: 21 legacy constructs are not documented'
        );
    });

    it('prints one location line per kind group', () => {
        expect(legacy.stdout).to.contain(
            '  ng-module (2): test/fixtures/kitchen-sink-module/src/app/about/about.module.ts:14 AboutModule, test/fixtures/kitchen-sink-module/src/app/app-routing.module.ts:33 AppRoutingModule'
        );
        expect(legacy.stdout).to.match(
            / {2}input-decorator \(2\): .*todo-item\.component\.ts:\d+ TodoItemComponent\.todo/
        );
        expect(legacy.stdout).to.match(
            / {2}constructor-injection \(2\): .*auth\.guard\.ts:\d+ AuthGuard/
        );
        expect(legacy.stdout).to.match(
            / {2}class-guard \(3\): test\/fixtures\/kitchen-sink-module\/src\/app\/core\/guards\/auth\.guard\.ts:\d+ AuthGuard/
        );
        expect(legacy.stdout).to.match(
            / {2}class-interceptor \(1\): test\/fixtures\/kitchen-sink-module\/src\/app\/core\/interceptors\/auth\.interceptor\.ts:\d+ AuthInterceptor/
        );
    });

    it('prints no notice for standalone code', () => {
        expect(modern.status).to.equal(0);
        expect(modern.stdout).not.to.contain('Angular 21+ only');
    });
});
