import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const BIN = path.resolve('./bin/index-cli.js');
const TSCONFIG_SIMPLE = path.resolve('./test/fixtures/sample-files/tsconfig.simple.json');

const tmp = temporaryDir();

describe('CLI simple generation', () => {
    const distFolder = `${tmp.name}-simple-generation`;

    describe('when generation with d flag - relative folder', () => {
        let stdoutString, fooComponentFile, fooServiceFile, componentFile, appConfigFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            fooComponentFile = read(`${distFolder}/components/FooComponent.html`);
            fooServiceFile = read(`${distFolder}/injectables/FooService.html`);
            appConfigFile = read(`${distFolder}/app-config.html`);
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should have generated main folder', () => {
            const isFolderExists = exists(`${distFolder}`);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isAppConfigExists = exists(`${distFolder}/app-config.html`);
            expect(isAppConfigExists).to.be.true;
        });

        it('should have generated resources folder', () => {
            const isImagesExists = exists(`${distFolder}/images`);
            expect(isImagesExists).to.be.true;
            const isJSExists = exists(`${distFolder}/js`);
            expect(isJSExists).to.be.true;
            const isStylesExists = exists(`${distFolder}/styles`);
            expect(isStylesExists).to.be.true;
            // Legacy Bootstrap-era `fonts/` folder is no longer emitted.
        });

        it('should have generated search index json', () => {
            const isIndexExists = exists(`${distFolder}/pagefind/pagefind.js`);
            expect(isIndexExists).to.be.true;
        });

        it('should have generated sourceCode for files', () => {
            // Shiki wraps tokens in <span> tags, so strip HTML before checking text content
            const strip = (html: string) => html.replace(/<[^>]+>/g, '');
            expect(strip(fooComponentFile)).to.contain('import { FooDirective } from');
            expect(strip(fooComponentFile)).to.contain('export class FooComponent');
            expect(strip(fooServiceFile)).to.contain('export class FooService');
        });

        /**
         *   JSDOC
         */

        it('it should have a link with this syntax {@link BarComponent}', () => {
            expect(appConfigFile).to.contain(
                'See <a href="./components/BarComponent.html">BarComponent'
            );
        });

        it('it should have a link with this syntax [The BarComponent]{@link BarComponent}', () => {
            expect(componentFile).to.contain(
                'Watch <a href="../components/BarComponent.html">The BarComponent'
            );
        });

        it('it should have a link with this syntax {@link BarComponent|BarComponent3}', () => {
            expect(fooComponentFile).to.contain(
                '<a href="../components/BarComponent.html">BarComponent3'
            );
        });

        it('it should have infos about FooService open function param', () => {
            expect(fooServiceFile).to.contain('<p>The entry value');
        });

        it('it should have infos about FooService open function returns', () => {
            expect(fooServiceFile).to.contain('<p>The string</p>');
        });

        it('it should have infos about FooService close function return JSDoc tag', () => {
            expect(fooServiceFile).to.contain('<p>Another string</p>');
        });

        it('it should have infos about FooService open function example', () => {
            // Method-level @example markdown is now rendered through the
            // markdown engine, which wraps fenced code in `cdx-code-snippet`
            // (no `<b>Example :</b>` label — that legacy label was for
            // property-level examples only, see JsdocExamplesBlock.tsx:45).
            expect(fooServiceFile).to.contain('cdx-code-snippet');
            expect(fooServiceFile).to.contain('FooService.open(');
        });

        it('it should have link to TypeScript doc', () => {
            expect(fooServiceFile).to.contain('typescriptlang.org');
        });

        it('it should have a link with this syntax {@link http://www.google.fr|Second link}', () => {
            expect(componentFile).to.contain('<a href="http://www.google.fr">Second link</a>');
        });
        it('it should have a link with this syntax {@link http://www.google.uk Third link}', () => {
            expect(componentFile).to.contain('<a href="http://www.google.uk">Third link</a>');
        });
        it('it should have a link with this syntax [Last link]{@link http://www.google.jp}', () => {
            expect(componentFile).to.contain('<a href="http://www.google.jp">Last link</a>');
        });

        /**
         * internal/private methods
         */
        it('should include by default methods marked as internal', () => {
            expect(componentFile).to.contain('cdx-io-member-name">internalMethod');
        });

        it('should exclude methods marked as hidden', () => {
            // `hiddenMethod` still shows up in the entity search index and
            // the source-code panel — assert it is NOT rendered as a
            // member-row in the API tab (no `cdx-io-member-name` entry).
            expect(componentFile).not.to.contain('cdx-io-member-name">hiddenMethod');
        });

        it('should include by default methods marked as private', () => {
            expect(componentFile).to.contain('cdx-io-member-name">privateMethod');
        });

        /**
         * inputs outputs
         */
        it('should generate inputs', () => {
            // Inputs section heading + the `block-inputs` data-compodoc anchor.
            expect(fooComponentFile).to.contain('data-compodoc="block-inputs"');
            expect(fooComponentFile).to.contain('<h3 id="inputs">Inputs');
            // Each input is a `cdx-io-member--input` row anchored on its name.
            const inputs = [
                'aliasedAndRequired',
                'aliasedInput',
                'exampleInput',
                'objectAliasedInput',
                'requiredInput',
                'aliasedInputSignal',
                'inputSignal',
                'modelInputSignal',
                'requiredInputSignal'
            ];
            for (const name of inputs) {
                expect(fooComponentFile).to.contain(`cdx-io-member-name">${name}`);
                expect(fooComponentFile).to.contain(`id="${name}"`);
            }
            // Type chips, descriptions, and source links should all reach the page.
            expect(fooComponentFile).to.contain(
                'href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/string"'
            );
            expect(fooComponentFile).to.contain(
                'An example aliased required input using the object syntax'
            );
            expect(fooComponentFile).to.contain('data-cdx-line="58"');
            // Required-flag rendering still surfaces somewhere in the row.
            expect(fooComponentFile).to.contain('Required');
        });

        it('should generate outputs', () => {
            expect(fooComponentFile).to.contain('data-compodoc="block-outputs"');
            expect(fooComponentFile).to.contain('<h3 id="outputs">Outputs');
            const outputs = [
                'exampleOutput',
                'aliasedOutputSignal',
                'modelInputSignal',
                'outputSignal',
                'requiredOutputSignal'
            ];
            for (const name of outputs) {
                expect(fooComponentFile).to.contain(`cdx-io-member-name">${name}`);
                expect(fooComponentFile).to.contain(`id="${name}"`);
            }
            // Output kind badge + source-line landmark.
            expect(fooComponentFile).to.contain('cdx-badge--output-signal');
            expect(fooComponentFile).to.contain('data-cdx-line="65"');
        });

        /**
         * Support of function type parameters
         */

        it('it should display function type parameters', () => {
            // Function-type parameters are now rendered as a `function` link
            // to the MDN reference instead of expanding the `(arg: T) => U`
            // shape inline. Assert on the parameter name + the MDN link.
            expect(fooServiceFile).to.contain('<code>close(work: ');
            expect(fooServiceFile).to.contain(
                'href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/function"'
            );
        });

        it('it should display c-style typed arrays', () => {
            expect(fooServiceFile).to.contain('<code>string');
        });

        /**
         * Inline menu (legacy `js/menu-wc.js` web component is gone — every
         * page now renders the menu inline via `Menu.tsx`).
         */
        it('should have inline sidebar menu in generated pages', () => {
            const indexHtml = read(`${distFolder}/index.html`);
            expect(indexHtml).to.contain('cdx-sidebar menu');
            // Sanity check: at least one chapter button is present.
            expect(indexHtml).to.contain('class="chapter"');
        });
    });

    describe('when generation with d flag without / at the end - relative folder', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have generated main folder', () => {
            const isFolderExists = exists(`${distFolder}`);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isAppConfigExists = exists(`${distFolder}/app-config.html`);
            expect(isAppConfigExists).to.be.true;
        });
    });

    describe('when generation with d flag - absolute folder', () => {
        let stdoutString, fooComponentFile, fooServiceFile, componentFile, appConfigFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    '../test/fixtures/sample-files/tsconfig.simple.json',
                    '-d',
                    `/tmp/${distFolder}/`
                ],
                { cwd: distFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            fooComponentFile = read(`/tmp/${distFolder}/components/FooComponent.html`);
            fooServiceFile = read(`/tmp/${distFolder}/injectables/FooService.html`);
            appConfigFile = read(`/tmp/${distFolder}/app-config.html`);
            componentFile = read(`/tmp/${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should have generated main folder', () => {
            const isFolderExists = exists(`/tmp/${distFolder}`);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`/tmp/${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isAppConfigExists = exists(`/tmp/${distFolder}/app-config.html`);
            expect(isAppConfigExists).to.be.true;
        });

        it('should have generated resources folder', () => {
            const isImagesExists = exists(`/tmp/${distFolder}/images`);
            expect(isImagesExists).to.be.true;
            const isJSExists = exists(`/tmp/${distFolder}/js`);
            expect(isJSExists).to.be.true;
            const isStylesExists = exists(`/tmp/${distFolder}/styles`);
            expect(isStylesExists).to.be.true;
            // Legacy `fonts/` folder no longer emitted.
        });

        it('should have generated search index json', () => {
            const isIndexExists = exists(`/tmp/${distFolder}/pagefind/pagefind.js`);
            expect(isIndexExists).to.be.true;
        });
    });

    /*describe('when generation with d flag - absolute folder inside cwd', () => {

        let stdoutString = undefined,
            actualDir,
            fooComponentFile,
            fooServiceFile,
            componentFile,
            moduleFile;
        beforeAll(() => {
            tmp.create(distFolder);

            actualDir = process.cwd();

            actualDir = actualDir.replace(' ', '');
            actualDir = actualDir.replace('\n', '');
            actualDir = actualDir.replace('\r\n', '');

            let ls = shell('node', [
                './bin/index-cli.js', '--no-multiVersion',
                '-p', './test/fixtures/sample-files/tsconfig.simple.json',
                '-d', actualDir + '/' + distFolder], { cwd: distFolder});

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            fooComponentFile = read(`/tmp/${distFolder}/components/FooComponent.html`);
            fooServiceFile = read(`/tmp/${distFolder}/injectables/FooService.html`);
            moduleFile  = read(`/tmp/${distFolder}/modules/AppModule.html`);
            componentFile = read(`/tmp/${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(actualDir + '/' + distFolder));

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should have generated main folder', () => {
            const isFolderExists = exists(`${actualDir}/${distFolder}`);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`${actualDir}/${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isModulesExists = exists(`${actualDir}/${distFolder}/modules.html`);
            expect(isModulesExists).to.be.true;
        });

        it('should have generated resources folder', () => {
            const isImagesExists = exists(`${actualDir}/${distFolder}/images`);
            expect(isImagesExists).to.be.true;
            const isJSExists = exists(`${actualDir}/${distFolder}/js`);
            expect(isJSExists).to.be.true;
            const isStylesExists = exists(`${actualDir}/${distFolder}/styles`);
            expect(isStylesExists).to.be.true;
            const isFontsExists = exists(`${actualDir}/${distFolder}/fonts`);
            expect(isFontsExists).to.be.true;
        });

        it('should have generated search index json', () => {
            const isIndexExists = exists(`${actualDir}/${distFolder}/pagefind/pagefind.js`);
            expect(isIndexExists).to.be.true;
        });
    });*/

    describe('when generation with d and a flags', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                distFolder,
                '-a',
                './screenshots/'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have copying assets folder', () => {
            const isFolderExists = exists(`${distFolder}/screenshots`);
            expect(isFolderExists).to.be.true;
        });
    });

    describe('when passing a deep path on a flag', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                distFolder,
                '-a',
                './test/fixtures/todomvc-ng2/screenshots/actions'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should flatten the path to the deeper dirname', () => {
            const isFolderExists = exists(`${distFolder}/actions`);
            expect(isFolderExists).to.be.true;
        });
    });

    describe('when generation with d flag and src arg', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                './test/fixtures/sample-files/',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                distFolder
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

        it('should have generated main folder', () => {
            const isFolderExists = exists(`${distFolder}`);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isAppConfigExists = exists(`${distFolder}/app-config.html`);
            expect(isAppConfigExists).to.be.true;
        });
    });

    describe('when generation without d flag', () => {
        // The CLI defaults `-d` to `./documentation/` relative to
        // `process.cwd()`. If this test spawned at the repo root it would
        // race against cli-serving.spec.ts which also depends on a
        // `./documentation/` lifecycle. Run inside a fresh tmpdir so the
        // default-folder generation is sandboxed.
        //
        // CLI tsconfig resolution does `path.join(process.cwd(), dirname)`,
        // which mangles absolute paths against the tmpdir cwd. Pass the
        // bin and tsconfig as paths relative to that cwd so the CLI's
        // join math collapses cleanly back to the real location.
        let stdoutString;
        let cwd: string;
        beforeAll(() => {
            // On macOS `os.tmpdir()` returns the symlink path
            // (`/var/folders/...`) but `process.cwd()` inside the spawned
            // child resolves to the real path (`/private/var/folders/...`),
            // so a relative path computed against the symlink would come
            // up one segment short. Realpath the tmpdir to match the
            // depth the CLI will actually see.
            cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-cli-gen-default-')));
            const binRel = path.relative(cwd, BIN);
            const tsconfigRel = path.relative(cwd, TSCONFIG_SIMPLE);
            const ls = shell('node', [binRel, '--no-multiVersion', '-p', tsconfigRel], { cwd });

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => {
            if (cwd && fs.existsSync(cwd)) {
                fs.rmSync(cwd, { recursive: true, force: true });
            }
        });

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should have generated main folder', () => {
            const isFolderExists = exists(path.join(cwd, 'documentation'));
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(path.join(cwd, 'documentation', 'index.html'));
            expect(isIndexExists).to.be.true;
            const isAppConfigExists = exists(path.join(cwd, 'documentation', 'app-config.html'));
            expect(isAppConfigExists).to.be.true;
        });

        it('should have generated resources folder', () => {
            const isImagesExists = exists(path.join(cwd, 'documentation', 'images'));
            expect(isImagesExists).to.be.true;
            const isJSExists = exists(path.join(cwd, 'documentation', 'js'));
            expect(isJSExists).to.be.true;
            const isStylesExists = exists(path.join(cwd, 'documentation', 'styles'));
            expect(isStylesExists).to.be.true;
            // Legacy `fonts/` folder no longer emitted.
        });
    });

    describe('when generation with -t flag', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-t',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not display anything', () => {
            expect(stdoutString).to.not.contain('parsing');
        });
    });

    describe('when generation with --theme flag', () => {
        let stdoutString,
            baseTheme = 'laravel',
            index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--theme',
                baseTheme,
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should add theme css', () => {
            index = read(`${distFolder}/index.html`);
            expect(index).to.contain(`href="./styles/${baseTheme}.css"`);
        });
    });

    describe('when generation with -n flag', () => {
        let stdoutString,
            name = 'TodoMVC-angular2-application',
            index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-n',
                name,
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should edit name', () => {
            // The custom name now lives in the inline sidebar markup of
            // every page (legacy `js/menu-wc.js` is gone).
            index = read(`${distFolder}/index.html`);
            expect(index).to.contain(name);
        });
    });

    describe('when generation with --hideGenerator flag', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--hideGenerator',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain generator footer', () => {
            index = read(`${distFolder}/index.html`);
            expect(index).to.not.contain('class="copyright"');
        });
    });

    describe('when generation with --hideDarkModeToggle flag', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--hideDarkModeToggle',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain dark mode toggle', () => {
            index = read(`${distFolder}/index.html`);
            expect(index).to.not.contain('class="dark-mode-switch"');
        });
    });

    describe('when generation with --disableSourceCode flag', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableSourceCode',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain sourceCode tab', () => {
            index = read(`${distFolder}/components/FooComponent.html`);
            expect(index).to.not.contain('id="source-tab"');
        });
    });

    describe('when generation with --disableDomTree flag', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableDomTree',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain domTree tab', () => {
            index = read(`${distFolder}/components/BarComponent.html`);
            expect(index).to.not.contain('id="tree-tab"');
        });
    });

    describe('when generation of component dependency doc with --navTabConfig option', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--navTabConfig',
                `[
                    {"id": "source","label": "Test Label 1"},
                    {"id": "info","label": "Test Label 2"}
                ]`,
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            index = read(`${distFolder}/components/BarComponent.html`);
            index = index.replace(/\r?\n|\r/g, '');
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain a domTree tab', () => {
            expect(index).to.not.contain('id="tree-tab"');
        });
        it('should not contain a template tab', () => {
            expect(index).to.not.contain('id="templateData-tab"');
        });
        it('should set source as the active tab', () => {
            // Tabs migrated from Bootstrap (`nav-link active`) to the cdx
            // tab bar — assert the stable href + active class + a11y
            // attribute on the source-tab anchor.
            expect(index).to.contain('href="#source" class="active"');
            expect(index).to.contain('id="source-tab"');
            expect(index).to.contain('aria-selected="true"');
        });
        it('should set the source tab label', () => {
            expect(index).to.contain('data-link="source">Test Label 1');
        });
        it('should set the info tab label', () => {
            expect(index).to.contain('data-link="info">Test Label 2');
        });
    });

    describe('when generation of directive doc with --navTabConfig option', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--navTabConfig',
                `[
                    {"id": "tree","label": "DOM Tree"},
                    {"id": "source","label": "Source"},
                    {"id": "info","label": "Info"}
                ]`,
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            index = read(`${distFolder}/directives/BarDirective.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain a domTree tab', () => {
            expect(index).to.not.contain('id="tree-tab"');
        });
    });

    describe('when generation with --disableTemplateTab flag', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableTemplateTab',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain template tab', () => {
            index = read(`${distFolder}/components/BarComponent.html`);
            expect(index).to.not.contain('id="templateData-tab"');
        });
    });

    describe('when generation with --disableStyleTab flag', () => {
        let stdoutString, index;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableStyleTab',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain style tab', () => {
            index = read(`${distFolder}/components/BarComponent.html`);
            expect(index).to.not.contain('id="styleData-tab"');
        });
    });

    describe('when generation with --disableGraph flag', () => {
        let stdoutString, fileContents;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableGraph',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate any graph data', () => {
            expect(stdoutString).to.contain('Graph generation disabled');
            expect(stdoutString).not.to.contain('Process main graph');
        });

        it('should not include the standalone dependency graph on the overview page', () => {
            fileContents = read(`${distFolder}/overview.html`);
            expect(fileContents).to.not.contain('dependency-graph-container');
            expect(fileContents).to.not.contain('svg-pan-zoom');
        });

        it('should not include the graph on the overview page', () => {
            fileContents = read(`${distFolder}/index.html`);
            expect(fileContents).to.not.contain('graph/dependencies.svg');
            expect(fileContents).to.not.contain('svg-pan-zoom');
        });
    });

    describe('when generation with --disableFilePath flag', () => {
        let stdoutString, componentFile, appConfigFile, directiveFile, pipeFile, serviceFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableFilePath',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not contain file path in component documentation', () => {
            componentFile = read(`${distFolder}/components/BarComponent.html`);
            expect(componentFile).to.not.contain('<h3>File</h3>');
            expect(componentFile).to.not.contain('<code>bar.component.ts</code>');
        });

        it('should not contain file path in application config documentation', () => {
            appConfigFile = read(`${distFolder}/app-config.html`);
            expect(appConfigFile).to.not.contain('<h3>File</h3>');
            expect(appConfigFile).to.not.contain('<code>app.config.ts</code>');
        });

        it('should not contain file path in directive documentation', () => {
            directiveFile = read(`${distFolder}/directives/BarDirective.html`);
            expect(directiveFile).to.not.contain('<h3>File</h3>');
            expect(directiveFile).to.not.contain('<code>bar.directive.ts</code>');
        });

        it('should not contain file path in pipe documentation', () => {
            pipeFile = read(`${distFolder}/pipes/BarPipe.html`);
            expect(pipeFile).to.not.contain('<h3>File</h3>');
            expect(pipeFile).to.not.contain('<code>bar.pipe.ts</code>');
        });

        it('should not contain file path in service documentation', () => {
            serviceFile = read(`${distFolder}/injectables/BarService.html`);
            expect(serviceFile).to.not.contain('<h3>File</h3>');
            expect(serviceFile).to.not.contain('<code>bar.service.ts</code>');
        });
    });

    describe('when generation with -r flag', () => {
        let stdoutString = '',
            port = 6666,
            child;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell(
                'node',
                [
                    './bin/index-cli.js',
                    '--no-multiVersion',
                    '-s',
                    '-r',
                    '-r',
                    port,
                    '-d',
                    distFolder
                ],
                { timeout: 10000 }
            );

            if (hasStderrError(ls.stderr.toString())) {
                throw new Error(`shell error: ${ls.stderr.toString()}`);
            }

            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it(`should contain port ${port}`, () => {
            expect(stdoutString).to.contain('Serving documentation');
            expect(stdoutString).to.contain(port);
        });
    });

    describe('when generation with -p flag - absolute folder', () => {
        let stdoutString = '';
        beforeAll(() => {
            tmp.create(distFolder);

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                path.join(`${process.cwd() + path.sep}test/fixtures/todomvc-ng2/src/tsconfig.json`),
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                throw new Error(`shell error: ${ls.stderr.toString()}`);
            }

            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });
    });

    describe('router parser coverage tests', () => {
        const distFolder = `${tmp.name}-router-parser-coverage`;
        let stdoutString;

        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/router-parser-coverage/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('should process router parser test fixture without errors', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should process identifiers in route arrays (cleanFileIdentifiers)', () => {
            expect(stdoutString).to.contain('found          : DYNAMIC_ROUTE_ID');
            expect(stdoutString).to.contain('found          : FALLBACK_COMPONENT');
        });

        it('should analyze routes definitions for spread elements (cleanFileSpreads)', () => {
            expect(stdoutString).to.contain(
                'Analysing routes definitions and clean them if necessary'
            );
        });

        it('should process property access expressions and call expressions', () => {
            expect(stdoutString).to.contain('found          : RouterUtils');
            expect(stdoutString).to.contain('found          : RoutePaths');
        });

        it('should generate documentation for routing module', () => {
            expect(stdoutString).to.contain('found          : AppRoutingModule');
        });
    });
});
