import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI Export', () => {
    const distFolder = `${tmp.name}-export`;

    describe('when specified JSON', () => {
        let stdoutString;

        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '-e',
                'json'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('names destructured parameter groups by their source position', () => {
            const file = read(`${distFolder}/documentation.json`, 'utf8');
            const ids = [...file.matchAll(/"destrucuredGroupId":"([^"]*)"/g)].map(m => m[1]);

            expect(ids.length).to.be.greaterThan(0);
            expect(new Set(ids)).to.deep.equal(
                new Set([
                    'test/fixtures/todomvc-ng2/src/app/shared/miscellaneous/miscellaneous.ts:68:23',
                    'test/fixtures/todomvc-ng2/src/app/shared/miscellaneous/miscellaneous.ts:72:31'
                ])
            );
        });

        it('should display descriptions and raw descriptions', () => {
            const file = read(`${distFolder}/documentation.json`, 'utf8');

            // property
            expect(file).to.contain('"rawdescription":"\\n\\nThe current time');
            expect(file).to.contain('"description":"<p>The current time</p>\\n');

            // method
            expect(file).to.contain('"rawdescription":"\\n\\nthe transform function');
            expect(file).to.contain('"description":"<p>the transform function</p>\\n');

            // pipe
            expect(file).to.contain(
                '"rawdescription":"\\n\\nUppercase the first letter of the string\\n\\n__Usage :__\\n  value | firstUpper'
            );
            expect(file).to.contain(
                '"description":"<p>Uppercase the first letter of the string</p>\\n<p><strong>Usage :</strong>\\n  value | firstUpper</p>\\n'
            );

            // interface
            expect(file).to.contain(
                '"rawdescription":"\\n\\nAn interface just for documentation purpose'
            );
            expect(file).to.contain(
                '"description":"<p>An interface just for documentation purpose</p>\\n'
            );

            // service
            expect(file).to.contain(
                '"rawdescription":"\\n\\nThis service is a todo store\\n\\nSee {@link Todo} for details about the main data of this store'
            );
            expect(file).to.contain(
                '"description":"<p>This service is a todo store</p>\\n<p>See {@link Todo} for details about the main data of this store</p>\\n'
            );

            // accessor (setter)
            expect(file).to.contain(
                '"rawdescription":"\\n\\nSetter of _fullName ore link to {@link Todo}\\n'
            );
            expect(file).to.contain(
                '"description":"<p>Setter of _fullName ore link to {@link Todo}</p>\\n'
            );

            // accessor (getter)
            expect(file).to.contain(
                '"rawdescription":"\\n\\nGetter of _fullName or link to {@link Todo}\\n'
            );
            expect(file).to.contain(
                '"description":"<p>Getter of _fullName or link to {@link Todo}</p>\\n'
            );
        });

        it('should display deprecated and deprecation messages', () => {
            const file = read(`${distFolder}/documentation.json`, 'utf8');

            expect(file).to.contain('"deprecated":true');
            expect(file).to.contain('"deprecated":false');

            // property
            expect(file).to.contain(
                '"deprecationMessage":"The current time property is deprecated"'
            );

            // method
            expect(file).to.contain('"deprecationMessage":"the transform function is deprecated"');

            // pipe
            expect(file).to.contain('"deprecationMessage":"This pipe is deprecated"');

            // interface
            expect(file).to.contain('"deprecationMessage":"This interface is deprecated"');

            // service
            expect(file).to.contain('"deprecationMessage":"This service is deprecated"');

            // accessor (setter)
            expect(file).to.contain('"deprecationMessage":"This setter is deprecated"');

            // accessor (getter)
            expect(file).to.contain('"deprecationMessage":"This getter is deprecated"');
        });

        it('should create json file', () => {
            const isFileExists = exists(`${distFolder}/documentation.json`);
            expect(isFileExists).to.be.true;
        });

        it('json file should have some data', () => {
            const file = read(`${distFolder}/documentation.json`);
            expect(file).to.contain('pipe-FirstUpperPipe');
            expect(file).to.contain('interface-ClockInterface');
            expect(file).to.contain('injectable-EmitterService');
            expect(file).to.contain('class-StringIndexedItems');
            expect(file).to.contain('component-AboutComponent');
            expect(file).to.contain('ABOUT_ROUTES');
            expect(file).to.contain('PI');
            expect(file).to.contain('A foo bar function');
            expect(file).to.contain('ChartChange');
            expect(file).to.contain('Direction');
            expect(file).to.contain('HOME_ROUTES');
            expect(file).to.contain('APP_ROUTES');
            expect(file).to.contain('coveragePercent');
        });

        it('should contain numerical enumerations with strict numerical values', () => {
            const file = read(`${distFolder}/documentation.json`);
            const obj = JSON.parse(file);
            const pollingSpeedEnum = obj.miscellaneous.enumerations.find(
                enumeration => enumeration.name === 'PollingSpeed'
            );
            const valHigh = pollingSpeedEnum.childs.find(child => child.name === 'High');
            expect(valHigh.value === 100).to.be.true;
        });

        it('should export custom input decorators for components', () => {
            const file = read(`${distFolder}/documentation.json`);
            const obj = JSON.parse(file);
            const component = obj.components.find(comp => comp.name === 'AboutComponent');
            const input = component.inputsClass.find(inp => inp.name === 'myInput');

            expect(input.decorators.find(dec => dec.name === 'MyCustomInputDecorator')).to.be.ok;
        });

        it('should get jsdoctags in component', () => {
            const file = read(`${distFolder}/documentation.json`);

            // The fixture's @example bodies have no code fence, so they are
            // rendered as code (no highlighter runs for the JSON export).

            // Property
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">component property</div>'
            );

            // Input
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">component input</div>'
            );

            // Accessor
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">component accessor</div>'
            );

            // HostBinding
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">component hostBinding</div>'
            );

            // HostListener
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">component hostListener</div>'
            );

            // Output
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">component output</div>'
            );

            // Method
            expect(file).to.contain('"comment":"<p>component method param</p>');
            expect(file).to.contain('"comment":"<p>component method return</p>');
        });

        it('should get jsdoctags in directive', () => {
            const file = read(`${distFolder}/documentation.json`);

            // Property
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">directive property</div>'
            );

            // Input
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">directive input</div>'
            );

            // Accessor
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">directive accessor</div>'
            );

            // HostBinding
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">directive hostBinding</div>'
            );

            // HostListener
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">directive hostListener</div>'
            );

            // Output
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">directive output</div>'
            );

            // Method
            expect(file).to.contain('"comment":"<p>directive method param</p>');
            expect(file).to.contain('"comment":"<p>directive method return</p>');
        });

        it('should get jsdoctags in pipe', () => {
            const file = read(`${distFolder}/documentation.json`);

            // Property
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">pipe property</div>'
            );

            // Method
            expect(file).to.contain('"comment":"<p>pipe method param</p>');
            expect(file).to.contain('"comment":"<p>pipe method return</p>');
        });

        it('should get jsdoctags in interface', () => {
            const file = read(`${distFolder}/documentation.json`);

            // Property
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">interface property</div>'
            );

            // Method
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">interface method</div>'
            );
        });

        it('should get jsdoctags in class', () => {
            const file = read(`${distFolder}/documentation.json`);

            // Property
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">class property</div>'
            );

            // Input
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">class input</div>'
            );

            // Accessor
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">class accessor</div>'
            );

            // HostBinding
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">class hostBinding</div>'
            );

            // HostListener
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">class hostListener</div>'
            );

            // Output
            expect(file).to.contain(
                '"comment":"<div class=\\"cdx-code-snippet\\">class output</div>'
            );

            // Method
            expect(file).to.contain('"comment":"<p>class method param</p>');
            expect(file).to.contain('"comment":"<p>class method return</p>');
        });

        it('should get standalone component informations', () => {
            const file = read(`${distFolder}/documentation.json`);

            // Description (the former ListModule table now lives on ListComponent)
            expect(file).to.contain('"description":"<p>The list of todos component');

            // Sourcecode
            expect(file).to.contain('"sourceCode":"import { Component, inject } from');
        });
    });

    describe('when specified JSON and disable things', () => {
        let stdoutString;

        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '-e',
                'json',
                '--disableSourceCode',
                '--disableCoverage'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should create json file', () => {
            const isFileExists = exists(`${distFolder}/documentation.json`);
            expect(isFileExists).to.be.true;
        });

        it('json file should have some data', () => {
            const file = read(`${distFolder}/documentation.json`);
            expect(file).to.contain('pipe-FirstUpperPipe');
            expect(file).to.contain('interface-ClockInterface');
            expect(file).to.contain('injectable-EmitterService');
            expect(file).to.contain('class-StringIndexedItems');
            expect(file).to.contain('component-AboutComponent');
            expect(file).to.contain('ABOUT_ROUTES');
            expect(file).to.contain('PI');
            expect(file).to.contain('A foo bar function');
            expect(file).to.contain('ChartChange');
            expect(file).to.contain('Direction');
            expect(file).to.contain('HOME_ROUTES');
            expect(file).to.contain('APP_ROUTES');
            expect(file).not.to.contain('coveragePercent');
            expect(file).not.to.contain('sourceCode');
            expect(file).not.to.contain('templateData');
            expect(file).not.to.contain('styleUrlsData');
            expect(file).not.to.contain('stylesData');
        });
    });

    describe('when specified not supported format', () => {
        let stdoutString;

        beforeAll(() => {
            tmp.create();
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '-e',
                'xml'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should display error message', () => {
            expect(stdoutString).to.contain('Exported format not supported');
        });
    });
});
