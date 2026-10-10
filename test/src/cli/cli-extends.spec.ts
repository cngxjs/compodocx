import type { PageKind } from '../../../src/app/links/layout';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI simple generation - extends app', () => {
    let stdoutString;

    let appComponentFile, myInitialClassFile;

    const distFolder = `${tmp.name}-big-app-extends`;
    const pages = pagesIn(distFolder);
    /** Depth of the page a link is rendered on. */
    const depthOf = (kind: PageKind, name: string) => pages.depthOf(pages.of(kind, name));

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/standalone-scenarios/extends/tsconfig.json',
            '-d',
            distFolder
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
        appComponentFile = read(`${distFolder}/${pages.of('component', 'AppComponent')}`);
        myInitialClassFile = read(`${distFolder}/${pages.of('class', 'MyInitialClass')}`);
    });
    afterAll(() => tmp.clean(distFolder));

    it('AppComponent extends AnotherComponent', () => {
        expect(appComponentFile).to.contain('myprop');
        expect(appComponentFile).to.contain('ngOnInit');
        expect(appComponentFile).to.contain('myoutput');
        expect(appComponentFile).to.contain('itisme');
    });

    it('DoNothingDirective extends ADirective', () => {
        const file = read(`${distFolder}/${pages.of('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('Extends');
        expect(file).to.contain('cdx-chip cdx-chip--directive');
        expect(file).to.contain(
            `href="${pages.href('directive', 'ADirective', depthOf('directive', 'DoNothingDirective'))}"`
        );
        expect(file).to.contain('>ADirective</a>');
    });

    it('MyInitialClass extends SubClassA', () => {
        expect(myInitialClassFile).to.contain('meh');
        expect(myInitialClassFile).to.contain('myproperty');
    });

    it('FirstClass extends BSecondClass extends AThirdClass', () => {
        const FirstClassFile = read(`${distFolder}/${pages.of('class', 'FirstClass')}`);
        // Direct parent shown in entity hero context line.
        expect(FirstClassFile).to.contain('extends BSecondClass');
        // Inherited members are merged into the FirstClass page:
        //   `name` is declared on FirstClass,
        //   `age`  is inherited from BSecondClass,
        //   `adress` is inherited from AThirdClass (typo in fixture preserved).
        // The current renderer no longer labels each inherited member with its
        // origin class (legacy `BSecondClass:4` / `AThirdClass:2` labels are
        // gone) — assert on member-row ids instead.
        expect(FirstClassFile).to.contain('id="name"');
        expect(FirstClassFile).to.contain('id="age"');
        expect(FirstClassFile).to.contain('id="adress"');
    });

    it('CharactersService extends AbstractService', () => {
        const file = read(`${distFolder}/${pages.of('injectable', 'CharactersService')}`);
        expect(file).to.contain(
            `code><a href="${pages.href('injectable', 'AbstractService', depthOf('injectable', 'CharactersService'))}" target="_self" >AbstractService`
        );
    });

    it('ClockInterface multiple extends', () => {
        const file = read(`${distFolder}/${pages.of('interface', 'ClockInterface')}`);
        expect(file).to.contain(
            `code><a href="${pages.href('interface', 'TimeInterface', depthOf('interface', 'ClockInterface'))}" target="_self" >TimeInterface`
        );
        expect(file).to.contain(
            `code><a href="${pages.href('interface', 'BooInterface', depthOf('interface', 'ClockInterface'))}" target="_self" >BooInterface`
        );
    });
});
