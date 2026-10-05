import { hasStderrError, read, shell, temporaryDir } from '../helpers';

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
        appComponentFile = read(`${distFolder}/components/AppComponent.html`);
        myInitialClassFile = read(`${distFolder}/classes/MyInitialClass.html`);
    });
    afterAll(() => tmp.clean(distFolder));

    it('AppComponent extends AnotherComponent', () => {
        expect(appComponentFile).to.contain('myprop');
        expect(appComponentFile).to.contain('ngOnInit');
        expect(appComponentFile).to.contain('myoutput');
        expect(appComponentFile).to.contain('itisme');
    });

    it('DoNothingDirective extends ADirective', () => {
        const file = read(`${distFolder}/directives/DoNothingDirective.html`);
        expect(file).to.contain('Extends');
        expect(file).to.contain('cdx-chip cdx-chip--directive');
        expect(file).to.contain('href="../directives/ADirective.html"');
        expect(file).to.contain('>ADirective</a>');
    });

    it('MyInitialClass extends SubClassA', () => {
        expect(myInitialClassFile).to.contain('meh');
        expect(myInitialClassFile).to.contain('myproperty');
    });

    it('FirstClass extends BSecondClass extends AThirdClass', () => {
        const FirstClassFile = read(`${distFolder}/classes/FirstClass.html`);
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
        const file = read(`${distFolder}/injectables/CharactersService.html`);
        expect(file).to.contain(
            'code><a href="../injectables/AbstractService.html" target="_self" >AbstractService'
        );
    });

    it('ClockInterface multiple extends', () => {
        const file = read(`${distFolder}/interfaces/ClockInterface.html`);
        expect(file).to.contain(
            'code><a href="../interfaces/TimeInterface.html" target="_self" >TimeInterface'
        );
        expect(file).to.contain(
            'code><a href="../interfaces/BooInterface.html" target="_self" >BooInterface'
        );
    });
});
