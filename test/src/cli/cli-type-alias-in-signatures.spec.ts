import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { hrefTo, pageOf } from '../helpers/pages';
import { hasKindPages, readKindPages } from './paths';

const tmp = temporaryDir();

describe('CLI generation with type aliases in method signatures', () => {
    let stdoutString;
    let typeAliasExampleClassFile;
    let typeAliasesFile;

    const tmpFolder = `${tmp.name}-type-alias-signatures`;
    const distFolder = `${tmpFolder}/documentation`;

    beforeAll(() => {
        tmp.create(tmpFolder);
        tmp.copy('./test/fixtures/todomvc-ng2/', tmpFolder);
        const ls = shell(
            'node',
            [
                '../bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './src/tsconfig.json',
                '-d',
                'documentation'
            ],
            { cwd: tmpFolder }
        );

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
        typeAliasExampleClassFile = read(`${distFolder}/${pageOf('class', 'TypeAliasExample')}`);
        typeAliasesFile = readKindPages(distFolder, 'typealias');
    });
    afterAll(() => {
        tmp.clean(tmpFolder);
    });

    it('should display generated message', () => {
        expect(stdoutString).to.contain('Documentation generated');
    });

    it('should have generated type aliases file', () => {
        const isTypeAliasesExists = hasKindPages(distFolder, 'typealias');
        expect(isTypeAliasesExists).to.be.true;
    });

    it('should have generated TypeAliasExample class file', () => {
        const isClassExists = exists(`${distFolder}/${pageOf('class', 'TypeAliasExample')}`);
        expect(isClassExists).to.be.true;
    });

    it('should have type aliases in miscellaneous page', () => {
        expect(typeAliasesFile).to.contain('StatusType');
        expect(typeAliasesFile).to.contain('CallbackFunction');
    });

    it('should generate correct type alias links in method signatures', () => {
        // This test verifies that type aliases in method parameters generate correct links
        // Instead of ../undefineds/StatusType.html, it should be ../miscellaneous/typealiases.html#StatusType
        expect(typeAliasExampleClassFile).to.contain(
            `<a href="${hrefTo('typealias', 'StatusType', 1)}" target="_self">StatusType</a>`
        );
    });

    it('should generate correct type alias links in method return types', () => {
        // Verify that return types with type aliases also get correct links
        expect(typeAliasExampleClassFile).to.contain(
            `<a href="${hrefTo('typealias', 'StatusType', 1)}" target="_self" >StatusType</a>`
        );
    });

    it('should not generate undefined links for type aliases in signatures', () => {
        // This verifies the fix - no undefined links should be generated
        expect(typeAliasExampleClassFile).not.to.contain('undefineds/StatusType');
        expect(typeAliasExampleClassFile).not.to.contain('undefineds/CallbackFunction');
    });

    it('should generate correct links for complex type aliases', () => {
        // CallbackFunction is a type alias for a function
        expect(typeAliasExampleClassFile).to.contain(
            `<a href="${hrefTo('typealias', 'CallbackFunction', 1)}" target="_self">CallbackFunction</a>`
        );
    });

    it('should display type alias details in parameters table', () => {
        // The parameter details table should also have correct links
        expect(typeAliasExampleClassFile).to.contain(`${hrefTo('typealias', 'StatusType', 1)}`);
    });
});
