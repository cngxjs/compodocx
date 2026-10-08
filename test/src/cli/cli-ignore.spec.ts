import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';
import { readKindPages } from './paths';

const tmp = temporaryDir();

describe('CLI ignore JSDoc tag support', () => {
    const distFolder = `${tmp.name}-ignore-jsdoc`;

    describe('without --disableLifeCycleHooks', () => {
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
            const file = exists(`${distFolder}/${pageOf('component', 'AppComponent')}`);
            expect(file).to.be.false;
        });

        it('Component property ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredProperty');
        });

        it('Component function ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredFunction');
        });

        it('Component input ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredInput');
        });

        it('Component output ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
            expect(file).to.not.contain('<code>ignoredOutput');
        });

        // `host: {}` entries are decorator metadata and stay listed; @ignore
        // hides the bound member and the listener handler.
        it('Component hostbinding ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
            expect(file).to.not.contain('cdx-io-member-name">color');
        });

        it('Component hostlistener ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
            expect(file).to.not.contain('cdx-io-member-name">onMouseup');
        });

        it('App config ignored', () => {
            const file = exists(`${distFolder}/app-config.html`);
            expect(file).to.be.false;
        });

        it('Directive ignored', () => {
            const file = exists(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
            expect(file).to.be.false;
        });

        it('Service ignored', () => {
            const file = exists(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);
            expect(file).to.be.false;
        });

        it('Pipe ignored', () => {
            const file = exists(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe')}`);
            expect(file).to.be.false;
        });

        it('Interface ignored', () => {
            const file = exists(`${distFolder}/${pageOf('interface', 'ClockInterface')}`);
            expect(file).to.be.false;
        });

        it('Class ignored', () => {
            const file = exists(`${distFolder}/${pageOf('class', 'Todo')}`);
            expect(file).to.be.false;
        });

        it('Class constructor ignored', () => {
            const file = read(`${distFolder}/${pageOf('class', 'PrivateConstructor')}`);
            expect(file).to.not.contain('<code>constructor');
        });

        it('Class property ignored', () => {
            const file = read(`${distFolder}/${pageOf('class', 'PrivateConstructor')}`);
            expect(file).to.not.contain('<code>myproperty');
        });

        it('Class function ignored', () => {
            const file = read(`${distFolder}/${pageOf('class', 'PrivateConstructor')}`);
            expect(file).to.not.contain('<code>yo');
        });

        it('Class acessors ignored', () => {
            const file = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
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
            const file = exists(`${distFolder}/${pageOf('component', 'AppComponent')}`);
            expect(file).to.be.false;
        });

        it('Directive ignored', () => {
            const file = exists(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
            expect(file).to.be.false;
        });
    });
});
