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
        expect(legacy.stdout).to.match(
            /Angular 21\+ only: \d+ legacy constructs are not documented/
        );
    });

    it('prints one location line per kind group', () => {
        expect(legacy.stdout).to.contain(
            '  ng-module (9): test/fixtures/kitchen-sink-module/src/app/about/about.module.ts:15 AboutModule'
        );
        expect(legacy.stdout).to.match(/ {2}input-decorator \(\d+\): .*, \.\.\. and \d+ more/);
        expect(legacy.stdout).to.match(
            / {2}class-interceptor \(3\): test\/fixtures\/kitchen-sink-module\/src\/app\/core\/interceptors\/auth\.interceptor\.ts:\d+ AuthInterceptor/
        );
    });

    it('prints no notice for standalone code', () => {
        expect(modern.status).to.equal(0);
        expect(modern.stdout).not.to.contain('Angular 21+ only');
    });
});
