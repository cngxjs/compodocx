import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI disable flags', () => {
    const distFolder = `${tmp.name}-disable-options`;

    describe('disabling excluding methods with --disablePrivate', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disablePrivate',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude methods marked as private', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">privateMethod');
        });

        it('should include methods marked as internal', () => {
            expect(componentFile).to.contain('cdx-io-member-name">internalMethod');
        });

        it('should include stuff marked as protected', () => {
            expect(componentFile).to.contain('cdx-io-member-name">varprotected');
        });

        it('should display lifecyle hooks', () => {
            expect(componentFile).to.contain('cdx-io-member-name">ngOnInit');
        });

        it('should exclude miscellaneous function marked as @private', () => {
            const file = read(`${distFolder}/miscellaneous/functions.html`);
            expect(file).not.to.contain('private function');
        });
    });

    describe('disabling excluding methods with --disableProtected', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableProtected',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude methods marked as protected', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">varprotected');
        });

        it('should include methods marked as private', () => {
            expect(componentFile).to.contain('cdx-io-member-name">privateMethod');
        });

        it('should include methods marked as internal', () => {
            expect(componentFile).to.contain('cdx-io-member-name">internalMethod');
        });

        it('should display lifecyle hooks', () => {
            expect(componentFile).to.contain('cdx-io-member-name">ngOnInit');
        });
    });

    describe('disabling excluding methods with --disableInternal', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableInternal',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude methods marked as @internal', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">internalMethod');
        });

        it('Component input @internal ignored', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">internalInput');
        });

        it('Component internal constructor property ignored', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">internalConstructorProp');
        });

        it('should include methods marked as private', () => {
            expect(componentFile).to.contain('cdx-io-member-name">privateMethod');
        });

        it('should include stuff marked as protected', () => {
            expect(componentFile).to.contain('cdx-io-member-name">varprotected');
        });

        it('should display lifecyle hooks', () => {
            expect(componentFile).to.contain('cdx-io-member-name">ngOnInit');
        });

        it('correct supports @internal + link', () => {
            const file = read(`${distFolder}/directives/QueryParamNameDirective.html`);
            // Dependencies are rendered by the `DependenciesSection` block.
            // The groupService `inject()` field survives --disableInternal
            // even though QueryParamGroupService itself is @internal (its
            // page is skipped, so the type renders unlinked).
            expect(file).to.contain('cdx-deps-name"><code>QueryParamGroupService');
            expect(file).to.contain('cdx-badge--inject');
        });
    });

    describe('disabling excluding methods with --disableLifeCycleHooks', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableLifeCycleHooks',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude lifecyle hooks', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">ngOnInit');
            const directiveFile = read(`${distFolder}/directives/BarDirective.html`);
            expect(directiveFile).not.to.contain('cdx-io-member-name">ngOnInit');
            const pipeFile = read(`${distFolder}/pipes/BarPipe.html`);
            expect(pipeFile).not.to.contain('cdx-io-member-name">ngOnDestroy');
            const serviceFile = read(`${distFolder}/injectables/BarService.html`);
            expect(serviceFile).not.to.contain('cdx-io-member-name">ngOnDestroy');
        });

        it('should include methods marked as private', () => {
            expect(componentFile).to.contain('cdx-io-member-name">privateMethod');
        });

        it('should include stuff marked as protected', () => {
            expect(componentFile).to.contain('cdx-io-member-name">varprotected');
        });

        it('should include methods marked as internal', () => {
            expect(componentFile).to.contain('cdx-io-member-name">internalMethod');
        });
    });

    describe('disabling excluding methods with --disableLifeCycleHooks for component inheritance', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files-extends/src/tsconfig.json',
                '--disableLifeCycleHooks',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/AppComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude lifecyle hooks', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">ngOnInit');
        });
    });

    describe('disabling excluding methods with --disableLifeCycleHooks --disableInternal --disableProtected --disablePrivate', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disablePrivate',
                '--disableProtected',
                '--disableInternal',
                '--disableLifeCycleHooks',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude lifecyle hooks', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">ngOnInit');
        });

        it('should exclude methods marked as private', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">privateMethod');
        });

        it('should exclude stuff marked as protected', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">varprotected');
        });

        it('should exclude methods marked as internal', () => {
            expect(componentFile).not.to.contain('cdx-io-member-name">internalMethod');
        });
    });

    describe('disabling excluding methods with --disableConstructors', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableConstructors',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/BarComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude constructors', () => {
            expect(componentFile).not.to.contain('cdx-badge--constructor');
            const directiveFile = read(`${distFolder}/directives/BarDirective.html`);
            expect(directiveFile).not.to.contain('cdx-badge--constructor');
            const pipeFile = read(`${distFolder}/pipes/BarPipe.html`);
            expect(pipeFile).not.to.contain('cdx-badge--constructor');
            const serviceFile = read(`${distFolder}/injectables/BarService.html`);
            expect(serviceFile).not.to.contain('cdx-badge--constructor');
        });
    });

    describe('disabling excluding methods with --disableConstructors for component inheritance', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files-extends/src/tsconfig.json',
                '--disableConstructors',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(`${distFolder}/components/AppComponent.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should exclude constructors', () => {
            expect(componentFile).not.to.contain('cdx-badge--constructor');
        });
    });

    describe('disabling search with --disableSearch', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableSearch',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate search JS files', () => {
            const file = read(`${distFolder}/index.html`);
            expect(file).not.to.contain('lunr.min.js');
            const index = exists(`${distFolder}/pagefind/pagefind.js`);
            expect(index).to.be.false;
        });

        it('should not generate search input', () => {
            const file = read(`${distFolder}/index.html`);
            expect(file).not.to.contain('book-search-input');
        });
    });

    describe('disabling dependencies with --disableDependencies', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableDependencies',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate the dependencies list', () => {
            const file = read(`${distFolder}/index.html`);
            expect(file).not.to.contain('href="dependencies.html"');
        });
    });

    describe('disabling properties with --disableProperties', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableProperties',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate the properties list', () => {
            const file = read(`${distFolder}/index.html`);
            expect(file).not.to.contain('href="properties.html"');
        });
    });

    describe('minimal with --minimal', () => {
        let fileContents;

        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--minimal',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate search JS files', () => {
            const file = read(`${distFolder}/index.html`);
            expect(file).not.to.contain('lunr.min.js');
            const index = exists(`${distFolder}/pagefind/pagefind.js`);
            expect(index).to.be.false;
        });

        it('should not generate search input', () => {
            const file = read(`${distFolder}/index.html`);
            expect(file).not.to.contain('book-search-input');
        });

        it('should not include the standalone dependency graph on the overview page', () => {
            fileContents = read(`${distFolder}/overview.html`);
            expect(fileContents).to.not.contain('dependency-graph-container');
            expect(fileContents).to.not.contain('svg-pan-zoom');
        });

        it('it should not exist routes_index.js file', () => {
            const isFileExists = exists(`${distFolder}/js/routes/routes_index.js`);
            expect(isFileExists).to.be.false;
        });

        it('it should not have coverage page', () => {
            const isFileExists = exists(`${distFolder}/coverage.html`);
            expect(isFileExists).to.be.false;
        });
    });

    describe('disabling file path with --disableFilePath', () => {
        let componentFile,
            appConfigFile,
            directiveFile,
            pipeFile,
            serviceFile,
            classFile,
            interfaceFile,
            entityFile,
            interceptorFile,
            guardFile;

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
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not display file path in component documentation', () => {
            componentFile = read(`${distFolder}/components/BarComponent.html`);
            expect(componentFile).not.to.contain('<h3>File</h3>');
            expect(componentFile).not.to.contain('<code>bar.component.ts</code>');
        });

        it('should not display file path in application config documentation', () => {
            appConfigFile = read(`${distFolder}/app-config.html`);
            expect(appConfigFile).not.to.contain('<h3>File</h3>');
            expect(appConfigFile).not.to.contain('<code>app.config.ts</code>');
        });

        it('should not display file path in directive documentation', () => {
            directiveFile = read(`${distFolder}/directives/BarDirective.html`);
            expect(directiveFile).not.to.contain('<h3>File</h3>');
            expect(directiveFile).not.to.contain('<code>bar.directive.ts</code>');
        });

        it('should not display file path in pipe documentation', () => {
            pipeFile = read(`${distFolder}/pipes/BarPipe.html`);
            expect(pipeFile).not.to.contain('<h3>File</h3>');
            expect(pipeFile).not.to.contain('<code>bar.pipe.ts</code>');
        });

        it('should not display file path in service documentation', () => {
            serviceFile = read(`${distFolder}/injectables/BarService.html`);
            expect(serviceFile).not.to.contain('<h3>File</h3>');
            expect(serviceFile).not.to.contain('<code>bar.service.ts</code>');
        });

        it('should not display file path in class documentation', () => {
            classFile = read(`${distFolder}/classes/NavigationData.html`);
            expect(classFile).not.to.contain('<h3>File</h3>');
            expect(classFile).not.to.contain('<code>query-param-group.service.ts</code>');
        });

        it('should still display other content sections', () => {
            componentFile = read(`${distFolder}/components/BarComponent.html`);
            // Metadata is a section heading; Implements moved into the
            // metadata card as a `<dt class="cdx-metadata-label">`.
            expect(componentFile).to.contain(
                '<h3 class="cdx-section-heading" id="metadata">Metadata'
            );
            expect(componentFile).to.contain('cdx-metadata-label">Implements');
        });

        it('should work with file paths that have dependencies', () => {
            // Test that the file path is disabled but other file references in "defined-in" remain
            componentFile = read(`${distFolder}/components/BarComponent.html`);
            expect(componentFile).not.to.contain('<h3>File</h3>');
            // But should still contain source code references if --disableSourceCode is not used
            expect(componentFile).to.contain('bar.component.ts');
        });
    });

    describe('disabling overview with --disableOverview', () => {
        let menuFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableOverview',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate overview.html when README exists', () => {
            const overviewExists = exists(`${distFolder}/overview.html`);
            expect(overviewExists).to.be.false;
        });

        it('should not display overview link in menu', () => {
            menuFile = read(`${distFolder}/index.html`);
            expect(menuFile).not.to.contain('href="overview.html"');
            expect(menuFile).not.to.contain('ion-ios-keypad');
        });

        it('should still generate other main pages', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isAppConfigExists = exists(`${distFolder}/app-config.html`);
            expect(isAppConfigExists).to.be.true;
        });

        it('should still display other menu items', () => {
            menuFile = read(`${distFolder}/index.html`);
            expect(menuFile).to.contain('href="app-config.html"');
            // Ionicons (`ion-ios-archive`) replaced by Lucide SVGs — assert
            // on the cdx-icon class on the inline `<svg>` next to the link.
            expect(menuFile).to.contain('cdx-icon');
        });

        it('should properly handle menu structure without overview', () => {
            menuFile = read(`${distFolder}/index.html`);
            // Should not contain the overview section in the getting-started chapter
            expect(menuFile).not.to.contain(
                '<span class="icon ion-ios-keypad"></span>{{t "overview"}}'
            );
        });
    });

    describe('disabling overview with --disableOverview without README', () => {
        let menuFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2-ignore/src/tsconfig.json',
                '--disableOverview',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not generate additional overview page when no README', () => {
            const overviewExists = exists(`${distFolder}/overview.html`);
            expect(overviewExists).to.be.false;
        });

        it('should still generate index.html as main page', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
        });

        it('should not display overview link in menu without README', () => {
            menuFile = read(`${distFolder}/index.html`);
            expect(menuFile).not.to.contain(
                '<span class="icon ion-ios-keypad"></span>{{t "overview"}}'
            );
        });
    });

    describe('disabling overview with --disableOverview and additional documentation', () => {
        let menuFile;
        const additionalTestFolder = `${tmp.name}-disable-overview-additional`;

        beforeAll(() => {
            tmp.create(additionalTestFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                additionalTestFolder,
                '--disableOverview',
                '--includes',
                './test/fixtures/todomvc-ng2/additional-doc',
                '--includesName',
                'Additional Documentation'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(additionalTestFolder));

        it('should not generate overview.html when using additional documentation', () => {
            const overviewExists = exists(`${additionalTestFolder}/overview.html`);
            expect(overviewExists).to.be.false;
        });

        it('should still generate additional documentation pages', () => {
            const bigIntroExists = exists(
                `${additionalTestFolder}/additional-documentation/big-introduction.html`
            );
            expect(bigIntroExists).to.be.true;

            const editionExists = exists(
                `${additionalTestFolder}/additional-documentation/edition.html`
            );
            expect(editionExists).to.be.true;

            const nestedEditionExists = exists(
                `${additionalTestFolder}/additional-documentation/edition/edition-of-a-todo.html`
            );
            expect(nestedEditionExists).to.be.true;
        });

        it('should not display overview link in menu but show additional documentation', () => {
            menuFile = read(`${additionalTestFolder}/index.html`);
            expect(menuFile).to.not.contain('href="overview.html"');
            expect(menuFile).to.contain('Additional Documentation');
            expect(menuFile).to.contain('href="additional-documentation/big-introduction.html"');
        });

        it('should render additional documentation content correctly', () => {
            const bigIntroFile = read(
                `${additionalTestFolder}/additional-documentation/big-introduction.html`
            );
            expect(bigIntroFile).to.contain('<h1 id="introduction">Introduction');
            expect(bigIntroFile).to.contain("COMPODOC_CURRENT_PAGE_CONTEXT = 'additional-page'");
        });

        it('should maintain nested additional documentation structure', () => {
            menuFile = read(`${additionalTestFolder}/index.html`);
            expect(menuFile).to.contain(
                'href="additional-documentation/edition/edition-of-a-todo.html"'
            );
            expect(menuFile).to.contain('Edition of a todo');

            const nestedFile = read(
                `${additionalTestFolder}/additional-documentation/edition/edition-of-a-todo.html`
            );
            expect(nestedFile).to.contain('screenshots/actions/edition.png');
        });

        it('should handle deep nesting levels correctly without overview', () => {
            menuFile = read(`${additionalTestFolder}/index.html`);
            // Should contain up to level 5 but not level 6
            expect(menuFile).to.contain('for-chapter2');
            expect(menuFile).to.contain('for-chapter3');
            expect(menuFile).to.contain('for-chapter4');
            expect(menuFile).to.contain('for-chapter5');
            expect(menuFile).to.not.contain('for-chapter6');
        });

        it('should generate correct additional documentation links without overview interference', () => {
            menuFile = read(`${additionalTestFolder}/index.html`);
            [
                'href="additional-documentation/edition/edition-of-a-todo/edit-level3.html',
                'href="additional-documentation/edition/edition-of-a-todo/edit-level3/edit-level4.html',
                'href="additional-documentation/edition/edition-of-a-todo/edit-level3/edit-level4/edit-level5.html'
            ].forEach(linkRef => {
                expect(menuFile).to.contain(linkRef);
            });
        });

        it('should still generate other standard pages alongside additional documentation', () => {
            const modulesExists = exists(`${additionalTestFolder}/modules.html`);
            expect(modulesExists).to.be.true;

            const indexExists = exists(`${additionalTestFolder}/index.html`);
            expect(indexExists).to.be.true;

            // Verify the standard pages don't contain overview links
            const indexFile = read(`${additionalTestFolder}/index.html`);
            expect(indexFile).to.not.contain('href="overview.html"');
        });
    });

    describe('comparing overview vs no-overview with additional documentation', () => {
        let withOverviewMenuFile;
        let withoutOverviewMenuFile;
        const withOverviewFolder = `${tmp.name}-with-overview-additional`;
        const withoutOverviewFolder = `${tmp.name}-without-overview-additional`;

        beforeAll(() => {
            // Generate with overview
            tmp.create(withOverviewFolder);
            const ls1 = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                withOverviewFolder,
                '--includes',
                './test/fixtures/todomvc-ng2/additional-doc',
                '--includesName',
                'Additional Documentation'
            ]);

            if (hasStderrError(ls1.stderr.toString())) {
                console.error(`shell error with overview: ${ls1.stderr.toString()}`);
                throw new Error('error');
            }

            // Generate without overview
            tmp.create(withoutOverviewFolder);
            const ls2 = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                withoutOverviewFolder,
                '--disableOverview',
                '--includes',
                './test/fixtures/todomvc-ng2/additional-doc',
                '--includesName',
                'Additional Documentation'
            ]);

            if (hasStderrError(ls2.stderr.toString())) {
                console.error(`shell error without overview: ${ls2.stderr.toString()}`);
                throw new Error('error');
            }

            withOverviewMenuFile = read(`${withOverviewFolder}/index.html`);
            withoutOverviewMenuFile = read(`${withoutOverviewFolder}/index.html`);
        });

        afterAll(() => {
            tmp.clean(withOverviewFolder);
            tmp.clean(withoutOverviewFolder);
        });

        it('should have identical additional documentation in both modes', () => {
            // Both should have the same additional documentation structure
            expect(withOverviewMenuFile).to.contain('Additional Documentation');
            expect(withoutOverviewMenuFile).to.contain('Additional Documentation');

            expect(withOverviewMenuFile).to.contain(
                'href="additional-documentation/big-introduction.html"'
            );
            expect(withoutOverviewMenuFile).to.contain(
                'href="additional-documentation/big-introduction.html"'
            );
        });

        it('should only differ in overview link presence', () => {
            // With overview should have overview link
            expect(withOverviewMenuFile).to.contain('href="overview.html"');

            // Without overview should not have overview link
            expect(withoutOverviewMenuFile).to.not.contain('href="overview.html"');
        });

        it('should generate identical additional documentation files', () => {
            const withOverviewIntroFile = read(
                `${withOverviewFolder}/additional-documentation/big-introduction.html`
            );
            const withoutOverviewIntroFile = read(
                `${withoutOverviewFolder}/additional-documentation/big-introduction.html`
            );

            // Content should be identical (excluding any timestamps or generation metadata)
            expect(withOverviewIntroFile).to.contain('<h1 id="introduction">Introduction');
            expect(withoutOverviewIntroFile).to.contain('<h1 id="introduction">Introduction');

            // Both should have correct context
            expect(withOverviewIntroFile).to.contain(
                "COMPODOC_CURRENT_PAGE_CONTEXT = 'additional-page'"
            );
            expect(withoutOverviewIntroFile).to.contain(
                "COMPODOC_CURRENT_PAGE_CONTEXT = 'additional-page'"
            );
        });

        it('should have overview.html only in with-overview mode', () => {
            const withOverviewExists = exists(`${withOverviewFolder}/overview.html`);
            const withoutOverviewExists = exists(`${withoutOverviewFolder}/overview.html`);

            expect(withOverviewExists).to.be.true;
            expect(withoutOverviewExists).to.be.false;
        });
    });
});
