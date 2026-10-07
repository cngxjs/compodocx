import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { hrefTo, pageOf } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI simple generation - extends app', () => {
    let stdoutString;

    let appComponentFile, myInitialClassFile;

    const distFolder = `${tmp.name}-big-app-extends`;

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
        appComponentFile = read(`${distFolder}/${pageOf('component', 'AppComponent')}`);
        myInitialClassFile = read(`${distFolder}/${pageOf('class', 'MyInitialClass')}`);
    });
    afterAll(() => tmp.clean(distFolder));

    it('AppComponent extends AnotherComponent', () => {
        expect(appComponentFile).to.contain('myprop');
        expect(appComponentFile).to.contain('ngOnInit');
        expect(appComponentFile).to.contain('myoutput');
        expect(appComponentFile).to.contain('itisme');
    });

    it('DoNothingDirective extends ADirective', () => {
        const file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('Extends');
        expect(file).to.contain('cdx-chip cdx-chip--directive');
        expect(file).to.contain(`href="${hrefTo('directive', 'ADirective', 1)}"`);
        expect(file).to.contain('>ADirective</a>');
    });

    it('MyInitialClass extends SubClassA', () => {
        expect(myInitialClassFile).to.contain('meh');
        expect(myInitialClassFile).to.contain('myproperty');
    });

    it('FirstClass extends BSecondClass extends AThirdClass', () => {
        const FirstClassFile = read(`${distFolder}/${pageOf('class', 'FirstClass')}`);
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
        const file = read(`${distFolder}/${pageOf('injectable', 'CharactersService')}`);
        expect(file).to.contain(
            `code><a href="${hrefTo('injectable', 'AbstractService', 1)}" target="_self" >AbstractService`
        );
    });

    it('ClockInterface multiple extends', () => {
        const file = read(`${distFolder}/${pageOf('interface', 'ClockInterface')}`);
        expect(file).to.contain(
            `code><a href="${hrefTo('interface', 'TimeInterface', 1)}" target="_self" >TimeInterface`
        );
        expect(file).to.contain(
            `code><a href="${hrefTo('interface', 'BooInterface', 1)}" target="_self" >BooInterface`
        );
    });
});
