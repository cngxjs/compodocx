import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';
import { collectionPage } from './paths';

const tmp = temporaryDir();

describe('CLI Deprecated', () => {
    const tmpFolder = `${tmp.name}-deprecated`;
    const distFolder = `${tmpFolder}/documentation`;

    let menuFile;

    describe('Angular app', () => {
        beforeAll(() => {
            tmp.create(tmpFolder);
            tmp.copy('./test/fixtures/standalone-scenarios/deprecated/', tmpFolder);
            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    './tsconfig.json',
                    '-d',
                    'documentation'
                ],
                { cwd: tmpFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }

            // Inline TSX menu lives in every page; the legacy
            // `js/menu-wc.js` is gone.
            menuFile = read(`${distFolder}/index.html`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('it should contain injectable deprecated and one API inside', () => {
            const file = read(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);
            expect(file).to.contain('class="cdx-deprecation-banner"');
            expect(file).to.contain('<strong>Deprecated</strong>');
            expect(file).to.contain('cdx-member-name--deprecated">getThemAll');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="injectable"'
            );
        });

        it('it should contain component deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('component', 'DumbComponent')}`);
            expect(file).to.contain('class="cdx-deprecation-banner"');
            expect(file).to.contain('cdx-member-name--deprecated">emptyOutput');
            expect(file).to.contain('cdx-member-name--deprecated">emptyInput');
            expect(file).to.contain('cdx-member-name--deprecated">emptyHostBinding');
            expect(file).to.contain('cdx-member-name--deprecated">onMouseup');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="component" data-cdx-selector="cp-dumb" data-cdx-io="2/2" data-cdx-desc="empty component"><span class="cdx-menu-item-name">DumbComponent'
            );
        });

        it('it should contain directive deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective2')}`);
            expect(file).to.contain('class="cdx-deprecation-banner"');
            expect(file).to.contain('cdx-member-name--deprecated">popover');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="directive" data-cdx-selector="[donothing]" data-cdx-desc="This directive does nothing !"><span class="cdx-menu-item-name">DoNothingDirective2'
            );
        });

        it('it should contain class deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('class', 'Tidi')}`);
            expect(file).to.contain('class="cdx-deprecation-banner"');
            expect(file).to.contain('cdx-member-name--deprecated">completed');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="class" data-cdx-desc="The tidi class"><span class="cdx-menu-item-name">Tidi'
            );
        });

        // Functional interceptor and guard pages mark the title as deprecated
        // but render no deprecation banner (class-based pages do).
        it('it should contain interceptor deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('interceptor', 'NoopInterceptor')}`);
            expect(file).to.contain('cdx-member-name--deprecated">NoopInterceptor');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="interceptor"><span class="cdx-menu-item-name">NoopInterceptor'
            );
        });

        it('it should contain guard deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('guard', 'NotAuthGuard')}`);
            expect(file).to.contain('cdx-member-name--deprecated">NotAuthGuard');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="guard"><span class="cdx-menu-item-name">NotAuthGuard'
            );
        });

        it('it should contain interface deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('interface', 'IDATA')}`);
            expect(file).to.contain('class="cdx-deprecation-banner"');
            expect(file).to.contain('cdx-member-name--deprecated">value');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="interface"><span class="cdx-menu-item-name">IDATA'
            );
        });

        it('it should contain pipe deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe2')}`);
            expect(file).to.contain('class="cdx-deprecation-banner"');
            expect(file).to.contain('cdx-member-name--deprecated">transform');
            expect(menuFile).to.contain(
                'cdx-member-name--deprecated" data-cdx-entity-type="pipe" data-cdx-desc="Uppercase the first letter of the string"><span class="cdx-menu-item-name">FirstUpperPipe2'
            );
        });

        it('it should contain enum deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${collectionPage('enumeration')}`);
            expect(file).to.contain('cdx-member-name--deprecated">Direction');
        });

        it('it should contain function deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${collectionPage('function')}`);
            expect(file).to.contain('cdx-member-name--deprecated">foo2');
        });

        it('it should contain type deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${collectionPage('typealias')}`);
            expect(file).to.contain('cdx-member-name--deprecated">LinearDomain');
        });

        it('it should contain variable deprecated and APIs inside', () => {
            const file = read(`${distFolder}/${collectionPage('variable')}`);
            expect(file).to.contain('cdx-member-name--deprecated">PIT');
        });

        // Inline {@link X} inside `@deprecated` parses as a NodeArray, not a
        // string. The `[object Object]` check rules out a template-literal
        // coerce that would still pass the other assertions.
        it('renders @deprecated JSDoc that contains an inline {@link} reference', () => {
            const file = read(`${distFolder}/${pageOf('interface', 'TabsI18n')}`);
            expect(file).to.contain('cdx-member-name--deprecated">commitFailedRetry');
            expect(file).to.contain('class="cdx-member-deprecated"');
            expect(file).to.contain('superseded by');
            expect(file).to.contain('{@link commitRolledBackTo}');
            expect(file).to.not.contain('[object Object]');
        });
    });
});
