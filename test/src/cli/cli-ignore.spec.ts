import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';
import { readKindPages } from './paths';

const tmp = temporaryDir();

describe('CLI ignore JSDoc tag support', () => {
    const distFolder = `${tmp.name}-ignore-jsdoc`;

    describe('without --disableLifeCycleHooks', () => {
        const pages = pagesIn(distFolder);
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/ignore/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('AppComponent ignored', () => {
            expect(() => pages.of('component', 'AppComponent')).to.throw(/^0 /);
        });

        it('Component property ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredProperty');
        });

        it('Component function ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredFunction');
        });

        it('Component input ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredInput');
        });

        it('Component output ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredOutput');
        });

        // `host: {}` entries are decorator metadata and stay listed; @ignore
        // hides the bound member and the listener handler.
        it('Component hostbinding ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('cdx-io-member-name">color');
        });

        it('Component hostlistener ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('cdx-io-member-name">onMouseup');
        });

        it('App config ignored', () => {
            const file = exists(`${distFolder}/app-config.html`);
            expect(file).to.be.false;
        });

        it('Directive ignored', () => {
            expect(() => pages.of('directive', 'DoNothingDirective')).to.throw(/^0 /);
        });

        it('Service ignored', () => {
            expect(() => pages.of('injectable', 'TodoStore')).to.throw(/^0 /);
        });

        it('Pipe ignored', () => {
            expect(() => pages.of('pipe', 'FirstUpperPipe')).to.throw(/^0 /);
        });

        it('Interface ignored', () => {
            expect(() => pages.of('interface', 'ClockInterface')).to.throw(/^0 /);
        });

        it('Class ignored', () => {
            expect(() => pages.of('class', 'Todo')).to.throw(/^0 /);
        });

        it('Class constructor ignored', () => {
            const file = read(`${distFolder}/${pages.of('class', 'PrivateConstructor')}`);
            expect(file).to.not.contain('<code>constructor');
        });

        it('Class property ignored', () => {
            const file = read(`${distFolder}/${pages.of('class', 'PrivateConstructor')}`);
            expect(file).to.not.contain('<code>myproperty');
        });

        it('Class function ignored', () => {
            const file = read(`${distFolder}/${pages.of('class', 'PrivateConstructor')}`);
            expect(file).to.not.contain('<code>yo');
        });

        it('Class acessors ignored', () => {
            const file = read(`${distFolder}/${pages.of('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>title(v');
        });

        it('Simple function ignored', () => {
            const file = readKindPages(distFolder, 'function');
            expect(file).to.not.contain('<code>LogMethod');
        });

        it('Simple enum ignored', () => {
            const file = readKindPages(distFolder, 'enumeration');
            expect(file).to.not.contain('<a href="#Direction">');
        });

        it('Simple variable ignored', () => {
            const file = readKindPages(distFolder, 'variable');
            expect(file).to.not.contain('<code>PIT');
        });

        it('Simple type alias ignored', () => {
            const file = readKindPages(distFolder, 'typealias');
            expect(file).to.not.contain('<code>ChartChange');
        });
    });

    describe('with --disableLifeCycleHooks', () => {
        const pages = pagesIn(distFolder);
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/ignore/tsconfig.json',
                '--disableLifeCycleHooks',
                '-d',
                distFolder
            ]);

            if (ls.stdout.toString().indexOf('Sorry') !== -1) {
                console.error(`shell error: ${ls.stdout.toString()}`);
                throw new Error('error');
            }

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('AppComponent ignored', () => {
            expect(() => pages.of('component', 'AppComponent')).to.throw(/^0 /);
        });

        it('Directive ignored', () => {
            expect(() => pages.of('directive', 'DoNothingDirective')).to.throw(/^0 /);
        });
    });
});
