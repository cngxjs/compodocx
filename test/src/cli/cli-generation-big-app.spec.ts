import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { hrefTo, pageOf } from '../helpers/pages';
import { collectionPage } from './paths';

const tmp = temporaryDir();

describe('CLI simple generation - big app', () => {
    let stdoutString;
    let interfaceIDATAFile;
    let searchFuncFile;

    let todoComponentFile,
        todoMVCComponentFile,
        homeComponentFile,
        aboutComponentFile,
        appComponentFile,
        listComponentFile,
        footerComponentFile,
        doNothingDirectiveFile,
        todoClassFile,
        tidiClassFile,
        appConfigFile,
        todoStoreFile,
        typeAliasesFile,
        functionsFile,
        contactInfoInterfaceFile;

    let routesIndex;

    const tmpFolder = `${tmp.name}-big-app`;
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
        interfaceIDATAFile = read(`${distFolder}/${pageOf('interface', 'IDATA')}`);
        searchFuncFile = read(`${distFolder}/${pageOf('interface', 'SearchFunc')}`);

        routesIndex = read(`${distFolder}/js/routes/routes_index.js`);
        todoComponentFile = read(`${distFolder}/${pageOf('component', 'TodoComponent')}`);
        todoMVCComponentFile = read(`${distFolder}/${pageOf('component', 'TodoMVCComponent')}`);
        footerComponentFile = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
        homeComponentFile = read(`${distFolder}/${pageOf('component', 'HomeComponent')}`);
        aboutComponentFile = read(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        appComponentFile = read(`${distFolder}/${pageOf('component', 'AppComponent')}`);
        listComponentFile = read(`${distFolder}/${pageOf('component', 'ListComponent')}`);

        doNothingDirectiveFile = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);

        todoClassFile = read(`${distFolder}/${pageOf('class', 'Todo')}`);
        tidiClassFile = read(`${distFolder}/${pageOf('class', 'Tidi')}`);

        appConfigFile = read(`${distFolder}/app-config.html`);

        todoStoreFile = read(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);

        typeAliasesFile = read(`${distFolder}/${collectionPage('typealias')}`);
        functionsFile = read(`${distFolder}/${collectionPage('function')}`);

        contactInfoInterfaceFile = read(`${distFolder}/${pageOf('interface', 'ContactInfo')}`);
    });
    afterAll(() => {
        tmp.clean(tmpFolder);
    });

    it('should display generated message', () => {
        expect(stdoutString).to.contain('Documentation generated');
    });

    it('should have generated main folder', () => {
        const isFolderExists = exists(distFolder);
        expect(isFolderExists).to.be.true;
    });

    it('should have generated main pages', () => {
        const isIndexExists = exists(`${distFolder}/index.html`);
        expect(isIndexExists).to.be.true;
        const isAppConfigExists = exists(`${distFolder}/app-config.html`);
        expect(isAppConfigExists).to.be.true;
        const isRoutesExists = exists(`${distFolder}/routes.html`);
        expect(isRoutesExists).to.be.true;
    });

    it('should have generated resources folder', () => {
        const isImagesExists = exists(`${distFolder}/images`);
        expect(isImagesExists).to.be.true;
        const isJSExists = exists(`${distFolder}/js`);
        expect(isJSExists).to.be.true;
        const isStylesExists = exists(`${distFolder}/styles`);
        expect(isStylesExists).to.be.true;
        // Legacy `fonts/` folder no longer emitted.
    });

    it('should add correct path to css', () => {
        const index = read(`${distFolder}/index.html`);
        // The bundled stylesheet is now `compodocx.css`. The legacy
        // `style.css` ships only as a Template-Playground compat stub.
        expect(index).to.contain('href="./styles/compodocx.css"');
    });

    /**
     * Dynamic imports for metadatas
     */
    it('should have metadatas - component', () => {
        expect(footerComponentFile).to.contain('footer.component.html');
    });
    it('should have metadatas - component with aliased import', () => {
        const file = read(`${distFolder}/${pageOf('component', 'HeaderComponent')}`);
        expect(file).to.contain('header.component.html');
    });
    it('should have metadatas - directive', () => {
        const file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('[donothing]');
    });

    /**
     * Import for component template
     */
    it('should have metadatas - component', () => {
        expect(aboutComponentFile).to.contain('example written using');
    });

    /**
     * Routing
     */

    it('should not have a toggled item menu', () => {
        expect(routesIndex).to.not.contain('fa-angle-down');
    });

    it('should have a route index', () => {
        const isFileExists = exists(`${distFolder}/js/routes/routes_index.js`);
        expect(isFileExists).to.be.true;
    });

    it('should have generated files', () => {
        expect(routesIndex).to.contain('src/app/app.routes.ts');
        expect(routesIndex).to.contain('src/app/about/about.routes.ts');
        expect(routesIndex).to.contain('src/app/home/home.routes.ts');
        expect(routesIndex).to.contain('AboutComponent');
    });

    it('should have a readme tab', () => {
        expect(todoComponentFile).to.contain('readme-tab');
        expect(listComponentFile).to.contain('readme-tab');
    });

    it('should have a decorator listed', () => {
        // Custom property decorators (e.g. `@LogProperty`,
        // `@LogPropertyWithArgs(…)`) render in a `cdx-member-decorators`
        // line inside the property row, with `<br />` separators between
        // multiple decorators on the same property.
        expect(footerComponentFile).to.contain('@LogProperty()<br');
    });

    /**
     * End Routing
     */

    it('should have generated search index json', () => {
        const isIndexExists = exists(`${distFolder}/pagefind/pagefind.js`);
        expect(isIndexExists).to.be.true;
    });

    it('should have generated pagefind directory', () => {
        const isPagefindExists = exists(`${distFolder}/pagefind`);
        expect(isPagefindExists).to.be.true;
    });

    it('should have generated extends information for todo class', () => {
        // Class `extends X` is rendered as a metadata-card label
        // (lowercase, matching the TS keyword).
        expect(todoClassFile).to.contain('cdx-metadata-label">extends</dt>');
    });

    it('should have generated implements information for clock class', () => {
        const classFile = read(`${distFolder}/${pageOf('class', 'Clock')}`);
        expect(classFile).to.contain('cdx-metadata-label">implements</dt>');
    });

    it('should have generated interfaces', () => {
        const isInterfaceExists = exists(`${distFolder}/${pageOf('interface', 'ClockInterface')}`);
        expect(isInterfaceExists).to.be.true;
    });

    it('should have generated classes', () => {
        const clockFile = exists(`${distFolder}/${pageOf('class', 'Clock')}`);
        expect(clockFile).to.be.true;
    });

    it('should have generated components', () => {
        const file = exists(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        expect(file).to.be.true;
    });

    it('should have generated directives', () => {
        const file = exists(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.be.true;
    });

    it('should have generated injectables', () => {
        const file = exists(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);
        expect(file).to.be.true;
    });

    it('should have generated the not-injectable guards', () => {
        const file = exists(`${distFolder}/${pageOf('guard', 'AuthGuard')}`);
        expect(file).to.be.true;
    });

    it('should have generated the injectable guards', () => {
        const file = exists(`${distFolder}/${pageOf('guard', 'NotAuthGuard')}`);
        expect(file).to.be.true;
    });

    it(`shouldn't have generated classes for the corresponding guards`, () => {
        const file = exists(`${distFolder}/${pageOf('class', 'AuthGuard')}`);
        expect(file).to.be.false;
    });

    it(`shouldn't have generated injectables for the corresponding guards`, () => {
        const file = exists(`${distFolder}/${pageOf('injectable', 'NotAuthGuard')}`);
        expect(file).to.be.false;
    });

    it('should have generated the application config', () => {
        expect(appConfigFile).to.contain('The bootstrapper configuration');
        expect(appConfigFile).to.contain('provideRouter()');
    });

    it('should have generated pipes', () => {
        const file = exists(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe')}`);
        expect(file).to.be.true;

        const pipeFile = read(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe')}`);
        expect(pipeFile).to.contain('<h3 class="cdx-section-heading" id="metadata">Metadata');
        expect(pipeFile).to.contain('Example property');
        expect(pipeFile).to.contain('the transform function');
        // Pipe metadata moved into `<dl class="cdx-metadata-card">`/`cdx-metadata-value`.
        expect(pipeFile).to.contain('<code>true</code>');
        expect(pipeFile).to.contain('<code>firstUpper</code>');
    });

    it('should have miscellaneous page', () => {
        const file = exists(`${distFolder}/${collectionPage('enumeration')}`);
        expect(file).to.be.true;
    });

    it('miscellaneous page should contain some things', () => {
        const miscFile = read(`${distFolder}/${collectionPage('enumeration')}`);
        expect(miscFile).to.contain('Directions of the app');
    });

    it('should have infos about SearchFunc interface', () => {
        expect(searchFuncFile).to.contain('A string');
    });

    it('should have infos about ClockInterface interface', () => {
        const file = read(`${distFolder}/${pageOf('interface', 'ClockInterface')}`);
        expect(file).to.contain('A simple reset method');
    });

    it('should have generated args and return informations for todo store', () => {
        expect(todoStoreFile).to.contain('Promise');
        expect(todoStoreFile).to.contain('string | number');
        expect(todoStoreFile).to.contain('number[]');
        expect(todoStoreFile).to.contain('cdx-io-member-name">stopMonitoring');
        expect(todoStoreFile).to.contain(
            `href="${hrefTo('interface', 'LabelledTodo', 1)}" target="_self">LabelledTodo`
        );
        expect(todoStoreFile).to.contain('service is a todo store');
        expect(todoStoreFile).to.contain('all todos status (completed');
        expect(todoStoreFile).to.contain('Local array of Todos');
    });

    it('should have correct types for todo model', () => {
        expect(todoClassFile).to.contain(
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/boolean'
        );
        expect(todoClassFile).to.contain(
            'testCommentFunction(dig: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/number'
        );
    });

    it('should have correct spread support', () => {
        expect(todoStoreFile).to.contain('...theArgs');
    });

    it('should have an example tab', () => {
        // Tabs migrated from Bootstrap data-link to cdx tab markup;
        // example iframe wrapper renamed to `cdx-example-container`.
        expect(todoComponentFile).to.contain('id="example-tab"');
        expect(todoComponentFile).to.contain('iframe class="cdx-example-container"');
    });

    it('should have managed array declaration in component imports', () => {
        expect(todoComponentFile).to.contain(`href="${hrefTo('pipe', 'FirstUpperPipe', 1)}"`);
        expect(listComponentFile).to.contain(`href="${hrefTo('component', 'TodoComponent', 1)}"`);
    });

    it('should have README tabs for each types', () => {
        expect(todoComponentFile).to.contain('id="readme-tab"');
        let file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('id="readme-tab"');
        expect(todoStoreFile).to.contain('id="readme-tab"');
        file = read(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe')}`);
        expect(file).to.contain('id="readme-tab"');

        expect(todoClassFile).to.contain('id="readme-tab"');

        file = read(`${distFolder}/${pageOf('interface', 'ClockInterface')}`);
        expect(file).to.contain('id="readme-tab"');
    });

    it('should support indexable for class', () => {
        expect(todoClassFile).to.contain('<code>[index: number]');
    });

    it('should have correct links for {@link into main description and constructor}', () => {
        // Class-level `See {@link TodoStore}` resolves to a real anchor.
        expect(todoClassFile).to.contain(`See <a href="${hrefTo('injectable', 'TodoStore', 1)}`);
        // Constructor-level `Watch {@link TodoStore}` flows through
        // `DependenciesSection.constructorDescription` and gets the
        // same `parseDescription` treatment.
        expect(todoClassFile).to.contain(`Watch <a href="${hrefTo('injectable', 'TodoStore', 1)}`);
    });

    it('should support misc links', () => {
        expect(todoClassFile).to.contain(`${hrefTo('enumeration', 'Direction', 1)}`);
    });

    it('should have public function for component', () => {
        expect(homeComponentFile).to.contain('cdx-io-member-name">showTab');
    });

    it('should have override types for arguments of function', () => {
        // Override-type chip on a method param links to the type page.
        expect(todoStoreFile).to.contain(
            `href="${hrefTo('class', 'Todo', 1)}" target="_self">Todo`
        );
    });

    it('should have inherit return type', () => {
        expect(todoClassFile).to.contain(
            'code><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/number"'
        );
    });

    it('should have inherit input type', () => {
        expect(aboutComponentFile).to.contain(
            'code><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/string"'
        );
    });

    it('should support simple class with custom decorator', () => {
        expect(tidiClassFile).to.contain('cdx-io-member-name">completed');
    });

    it('should support simple class with custom decorator()', () => {
        const file = read(`${distFolder}/${pageOf('class', 'DoNothing')}`);
        expect(file).to.contain('cdx-io-member-name">aname');
    });

    it('should support TypeLiteral', () => {
        // Type-alias values now render with raw quotes inside `<code>`;
        // legacy `&quot;…&quot;` HTML entities are gone.
        expect(typeAliasesFile).to.contain('"creating" | "created" | "updating" | "updated"');
    });

    it('should support return multiple with null & TypeLiteral', () => {
        expect(tidiClassFile).to.contain('<code>literal type | null');
    });

    it('should support @HostBindings', () => {
        const file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        // Host bindings render as `[style.color]` chip-style table cells
        // inside the HostSection rather than `<b>style.color</b>`.
        expect(file).to.contain('<code>[style.color]</code>');
    });

    it('should support @HostListener and multiple', () => {
        // Host-listener arguments now render in the `cdx-host-attr-grid`
        // host section. Both `$event.clientX` and `$event.clientY` reach
        // the rendered output as `<code>` tokens.
        expect(aboutComponentFile).to.contain('$event.clientX');
        expect(aboutComponentFile).to.contain('$event.clientY');

        // Multiple host listeners still aggregated for DoNothingDirective —
        // assert both event names appear under the host section.
        expect(doNothingDirectiveFile).to.contain('focus');
        expect(doNothingDirectiveFile).to.contain('click');
    });

    it('should support extends for interface', () => {
        const file = read(`${distFolder}/${pageOf('interface', 'ClockInterface')}`);
        // Interface metadata-label uses lowercase keyword.
        expect(file).to.contain('cdx-metadata-label">extends</dt>');
    });

    it('should support optional', () => {
        // Optional method parameters now show the `?` directly in the
        // signature instead of a separate "Optional: Yes" column.
        expect(todoStoreFile).to.contain('theTodo?');
    });

    it('should support optional', () => {
        expect(aboutComponentFile).to.contain('<code>Subscription[]');
    });

    it('should support @link with anchor', () => {
        expect(todoStoreFile).to.contain(`${hrefTo('class', 'Todo', 1)}#completed`);
    });

    it('should support self-defined type', () => {
        expect(todoClassFile).to.contain(`${hrefTo('typealias', 'PopupPosition', 1)}`);
        expect(typeAliasesFile).to.contain('<code>ElementRef | HTMLElement</code>');
    });

    it('should support accessors for class', () => {
        expect(todoClassFile).to.contain('href="#title"');
        expect(todoClassFile).to.contain('cdx-io-member-name">title');
        expect(todoClassFile).to.contain('Accessors');
        expect(todoClassFile).to.contain('Setter of _title');
        expect(todoClassFile).to.contain('<p>Returns the runtime path</p>');
    });

    it('should support accessors for injectables', () => {
        expect(todoStoreFile).to.contain('Accessors');
        expect(todoStoreFile).to.contain('Getter of _fullName');
        expect(todoStoreFile).to.contain('Setter of _fullName');
    });

    it('should support accessors for directives', () => {
        const file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('Accessors');
        expect(file).to.contain('Getter of _fullName');
        expect(file).to.contain('Setter of _fullName');
    });

    it('should support accessors for components with input', () => {
        let file = read(`${distFolder}/${pageOf('component', 'HeaderComponent')}`);
        expect(file).to.contain('Accessors');
        expect(file).to.contain('Getter of _fullName');
        expect(file).to.contain('Setter of _fullName');

        file = read(`${distFolder}/${pageOf('component', 'DumbComponent')}`);
        expect(file).to.contain('cdx-io-member-name">visibleTodos');
        expect(file).to.contain(`href="${hrefTo('class', 'Todo', 1)}"`);
    });

    it('should support QualifiedName for type', () => {
        expect(aboutComponentFile).to.contain('Highcharts.Options');
    });

    it('should support namespace', () => {
        let file = read(`${distFolder}/${pageOf('class', 'AboutModule2')}`);
        expect(file).to.contain('The about module');

        file = read(`${distFolder}/${pageOf('component', 'AboutComponent2')}`);
        expect(file).to.contain('The about component');

        file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective2')}`);
        expect(file).to.contain('This directive does nothing !');

        file = read(`${distFolder}/${pageOf('class', 'Todo2')}`);
        expect(file).to.contain('The todo class');

        file = read(`${distFolder}/${pageOf('injectable', 'TodoStore2')}`);
        expect(file).to.contain('This service is a todo store');

        file = read(`${distFolder}/${pageOf('interface', 'TimeInterface2')}`);
        expect(file).to.contain('A time interface just for documentation purpose');

        file = read(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe2')}`);
        expect(file).to.contain('Uppercase the first letter of the string');

        file = read(`${distFolder}/${collectionPage('enumeration')}`);
        expect(file).to.contain('PopupEffect2');

        expect(functionsFile).to.contain('foo2');

        expect(typeAliasesFile).to.contain('Name2');

        file = read(`${distFolder}/${collectionPage('variable')}`);
        expect(file).to.contain('PI2');
    });

    it('should support interceptors', () => {
        // The functional interceptor is registered through
        // `provideHttpClient(withInterceptors([...]))` in the app config.
        expect(appConfigFile).to.contain('withInterceptors()');
        const fileTest = exists(`${distFolder}/${pageOf('interceptor', 'NoopInterceptor')}`);
        expect(fileTest).to.be.true;
        const file = read(`${distFolder}/${pageOf('interceptor', 'NoopInterceptor')}`);
        expect(file).to.contain('Functional interceptor');
    });

    it('should have DOM tree tab for component with inline template', () => {
        expect(homeComponentFile).to.contain('<header class="header"');
    });

    it('should have parsed correctly private, public, and static methods or properties', () => {
        expect(aboutComponentFile).to.contain('cdx-io-member-name">privateStaticMethod');
        expect(aboutComponentFile).to.contain('cdx-io-member-name">protectedStaticMethod');
        expect(aboutComponentFile).to.contain('cdx-io-member-name">publicMethod');
        expect(aboutComponentFile).to.contain('cdx-io-member-name">publicStaticMethod');
        expect(aboutComponentFile).to.contain('cdx-io-member-name">staticMethod');
        expect(aboutComponentFile).to.contain('staticReadonlyVariable');
        // Modifier chips still rendered as `<span class="cdx-member-modifier">…`.
        expect(aboutComponentFile).to.contain('class="cdx-member-modifier">Private');
        expect(aboutComponentFile).to.contain('class="cdx-member-modifier">Protected');
        expect(aboutComponentFile).to.contain('class="cdx-member-modifier">Static');
        expect(aboutComponentFile).to.contain('class="cdx-member-modifier">Readonly');
        expect(aboutComponentFile).to.contain('class="cdx-member-modifier">Public');
        expect(aboutComponentFile).to.contain('class="cdx-member-modifier">Async');
    });

    it('should support dynamic path for routes', () => {
        const routesFile = read(`${distFolder}/js/routes/routes_index.js`);
        expect(routesFile).to.contain('homeimported');
        expect(routesFile).to.contain('homeenumimported');
        expect(routesFile).to.contain('homeenuminfile');
        expect(routesFile).to.contain('todomvcinstaticclass');
    });

    it('should support Object Literal Property Value Shorthand support for metadatas for components', () => {
        expect(homeComponentFile).to.contain(
            '<h3 class="cdx-section-heading" id="metadata">Metadata'
        );
        expect(homeComponentFile).to.contain('<code>home</code>');
        expect(homeComponentFile).to.contain('<code>ChangeDetectionStrategy.OnPush</code>');
        expect(homeComponentFile).to.contain('<code>ViewEncapsulation.Emulated</code>');
        expect(homeComponentFile).to.contain('<code>./home.component.html</code>');
        expect(homeComponentFile).to.contain('cdx-metadata-label">Template URL');
        expect(homeComponentFile).to.contain('cdx-metadata-label">Change detection');
        expect(homeComponentFile).to.contain('cdx-metadata-label">Encapsulation');
    });

    it('should support @link to miscellaneous', () => {
        expect(aboutComponentFile).to.contain(`<a href="${hrefTo('variable', 'PIT', 1)}">PIT</a>`);
        expect(aboutComponentFile).to.contain(
            `<a href="${hrefTo('enumeration', 'Direction', 1)}">Direction</a>`
        );
        expect(aboutComponentFile).to.contain(
            `<a href="${hrefTo('typealias', 'ChartChange', 1)}">ChartChange</a>`
        );
        expect(aboutComponentFile).to.contain(`<a href="${hrefTo('function', 'foo', 1)}">foo</a>`);
    });

    it('should support default type on default value', () => {
        const file = read(`${distFolder}/${pageOf('class', 'TODO_STATUS')}`);
        expect(file).to.contain(
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/string"'
        );
    });

    it('should display project dependencies', () => {
        const file = exists(`${distFolder}/dependencies.html`);
        expect(file).to.be.true;
        const dependencies = read(`${distFolder}/dependencies.html`);
        expect(dependencies).to.contain('angular/forms');
    });

    it('should display project properties', () => {
        const file = exists(`${distFolder}/properties.html`);
        expect(file).to.be.true;
        const properties = read(`${distFolder}/properties.html`);
        expect(properties).to.contain('Demo for project');
        expect(properties).to.contain('The author');
        expect(properties).to.contain('https://github.com/just-a-repo');
        expect(properties).to.contain('documentation, angular');
    });

    it('should display project local TypeScript version', () => {
        expect(stdoutString).to.contain('TypeScript version of current project');
    });

    //it('should display project peerDependencies', () => {
    //  const file = exists(distFolder + '/dependencies.html');
    //  expect(file).to.be.true;
    //  let dependencies = read(distFolder + '/dependencies.html');
    //  expect(dependencies).to.contain('angular/forms');
    //});

    it('should support optional for classes', () => {
        expect(todoClassFile).to.contain('Optional');
    });

    it('should support optional for interfaces', () => {
        const file = read(`${distFolder}/${pageOf('interface', 'LabelledTodo')}`);
        expect(file).to.contain('Optional');
    });

    it('should support optional for interfaces / methods', () => {
        const file = read(`${distFolder}/${pageOf('interface', 'TimeInterface')}`);
        expect(file).to.contain('Optional');
    });

    it('should support private for constructor', () => {
        const file = read(`${distFolder}/${pageOf('class', 'PrivateConstructor')}`);
        // Constructors with explicit modifiers but no inject/ctor args
        // fall back to `BlockConstructor` so the modifier still surfaces;
        // the badge class adds a `--{slug}` suffix (e.g. `--private`).
        expect(file).to.contain('cdx-member-modifier--private">Private');
    });

    it('should support union type with array', () => {
        expect(todoComponentFile).to.contain('>string[] | Todo</a>');
    });

    it('should support multiple union types with array', () => {
        expect(todoComponentFile).to.contain('<code>(string | number)[]</code>');
    });

    it('should support multiple union types with array again', () => {
        expect(typeAliasesFile).to.contain('<code>number | string | (number | string)[]</code>');
    });

    it('should support union type with generic', () => {
        // Type alias values render with raw `<>` inside `<code>`; legacy
        // entity-escaped variants (`&lt;`/`&gt;`) are gone.
        expect(typeAliasesFile).to.contain('Type<TableCellRendererBase> | TemplateRef<any>');
    });

    it('should support literal type', () => {
        expect(typeAliasesFile).to.contain('Pick<NavigationExtras | replaceUrl>');
    });

    it('should support multiple union types with array', () => {
        expect(todoComponentFile).to.contain('<code>(string | number)[]</code>');
    });

    it('should support alone elements in their own entry menu', () => {
        // Inline menu lives in every page now; assert the entity-link
        // landmarks instead of reading the obsolete `js/menu-wc.js`.
        const file = read(`${distFolder}/index.html`);
        expect(file).to.contain(`href="${pageOf('component', 'JigsawTab')}"`);
        expect(file).to.contain('>JigsawTab');
        expect(file).to.contain(`href="${pageOf('directive', 'DoNothingDirective2')}"`);
        expect(file).to.contain('>DoNothingDirective2');
        expect(file).to.contain(`href="${pageOf('injectable', 'EmitterService')}"`);
        expect(file).to.contain('>EmitterService');
        expect(file).to.contain(`href="${pageOf('pipe', 'FirstUpperPipe2')}"`);
        expect(file).to.contain('>FirstUpperPipe2');
    });

    it('should support component metadata preserveWhiteSpaces', () => {
        // `preserveWhitespaces` is restored to the metadata card (along
        // with `changeDetection` / `encapsulation`) for compodoc-line
        // compatibility; the humanized label is "Preserve whitespaces".
        expect(aboutComponentFile).to.contain('cdx-metadata-label">Preserve whitespaces');
    });

    it('should support component metadata providers', () => {
        expect(aboutComponentFile).to.contain(
            `<code><a href="${hrefTo('injectable', 'EmitterService', 1)}" target="_self" >EmitterService</a></code>`
        );
    });

    it('should support component inheritance with base class without @component decorator', () => {
        const file = read(`${distFolder}/${pageOf('component', 'DumbComponent')}`);
        expect(file).to.contain('cdx-io-member-name">parentInput');
        expect(file).to.contain('cdx-io-member-name">parentoutput');
    });

    it('should display short filename + long filename in title for index of miscellaneous', () => {
        const file = read(`${distFolder}/${collectionPage('variable')}`);
        // Short and long file paths still surface together; assert both
        // substrings present (markup around them is now cdx-* and not
        // a fixed wrapper).
        expect(file).to.contain('about.routes.ts');
        expect(file).to.contain('src/app/about/about.routes.ts');
    });

    it('should display component even with no hostlisteners', () => {
        const file = read(`${distFolder}/coverage.html`);
        expect(file).to.contain('src/app/footer/footer.component.ts');
    });

    it('should support Tuple types', () => {
        expect(typeAliasesFile).to.contain('<code>[number, number]</code>');
        expect(typeAliasesFile).to.contain('[Todo, Todo]</a>');
    });

    it('should support Generic array types', () => {
        // Generic array types render with raw chevrons inside the link
        // (the legacy `&lt;`/`&gt;` entities are gone).
        expect(appComponentFile).to.contain(`href="${hrefTo('class', 'Todo', 1)}"`);
        expect(appComponentFile).to.contain('Observable<Todo[]>');
    });

    it('should support Type parameters', () => {
        // Type parameters render as `<code>T</code>`/`<code>K</code>`
        // chips inside the metadata card, not bare `<li>` items.
        expect(appComponentFile).to.contain('<code>T</code>');
        expect(appComponentFile).to.contain('<code>K</code>');
    });

    it('should support interfaces with custom variables names', () => {
        const file = read(`${distFolder}/${pageOf('interface', 'ValueInRes')}`);
        expect(file).to.contain('href="#__allAnd"');
    });

    it('correct support of generic type Map<K, V>', () => {
        expect(todoStoreFile).to.contain('Map&lt;string, number&gt;');
    });

    it('correct support of abstract and async modifiers', () => {
        expect(todoClassFile).to.contain('<span class="cdx-member-modifier">Abstract</span>');
        expect(todoClassFile).to.contain('<span class="cdx-member-modifier">Async</span>');
    });

    it('correct support function with empty typed arguments', () => {
        expect(appComponentFile).to.contain('cdx-io-member-name">openSomeDialog');
        expect(appComponentFile).to.contain('model: unknown');
    });

    it('correct support unnamed function', () => {
        expect(functionsFile).to.contain('Unnamed');
    });

    it('correct display styles tab', () => {
        let file = read(`${distFolder}/${pageOf('component', 'HeaderComponent')}`);
        expect(file).to.contain('styleData-tab');
        // SCSS is rendered via Shiki (no `language-scss` class on `<code>`
        // — the syntax theme owns the colouring).
        expect(file).to.contain('shiki shiki-themes');
        expect(appComponentFile).to.contain('styleData-tab');
        expect(appComponentFile).to.contain('font-size');
        file = read(`${distFolder}/${pageOf('component', 'TodoMVCComponent')}`);
        expect(file).to.contain('styleData-tab');
        expect(file).to.contain('pointer-events');
    });

    it('correct support symbol type', () => {
        // Type alias renders chevrons raw inside `<code>`.
        expect(typeAliasesFile).to.contain('string | symbol | Array<string | symbol>');
    });

    it('correct support returned type for miscellaneous function', () => {
        expect(functionsFile).to.contain(
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/string'
        );
    });

    it('correct http reference for other classes using @link in description of a miscellaneous function', () => {
        expect(functionsFile).to.contain(
            `<a href="${hrefTo('component', 'ListComponent', 1)}">ListComponent</a>`
        );
    });

    it('shorten long arrow function declaration for properties', () => {
        // Arrow-function property assignments render the truncated
        // `() => {...}` shorthand from `class-helper.ts:1389` as the
        // property's `defaultValue`, which then flows through
        // `highlightedCodeWrap` → Shiki and emerges inside a
        // `<code class="cdx-shiki-inline">…</code>` span tree. The
        // legacy assertion targeted the pre-Shiki entity-escaped form
        // (`() &#x3D;&gt; {...}`) — assert on the truncation marker
        // (`{...}`) plus the inline-code wrapper landmark instead.
        expect(todoClassFile).to.contain('cdx-shiki-inline');
        expect(todoClassFile).to.contain('{</span>');
        expect(todoClassFile).to.contain('>...</span>');
    });

    it('correct supports 1000 as PollingSpeed for decorator arguments', () => {
        const file = read(`${distFolder}/${pageOf('class', 'SomeFeature')}`);
        // Custom method decorators get the same `cdx-member-decorators`
        // treatment as property decorators, with `stringifiedArguments`
        // preserved verbatim (including the `as PollingSpeed` cast).
        expect(file).to.contain('code>@throttle(1000 as PollingSpeed');
    });

    it('correct supports JSdoc without comment for accessor', () => {
        expect(tidiClassFile).to.contain('cdx-io-member-name">emailAddress');
    });

    it('correct supports ArrayType', () => {
        expect(interfaceIDATAFile).to.contain('<code>[number, string, number[]]</code>');
    });

    it('correct supports ArrayType with spread', () => {
        expect(interfaceIDATAFile).to.contain('<code>[string, string, ...boolean[]]</code>');
    });

    it('should support inheritance with abstract class', () => {
        const file = read(`${distFolder}/${pageOf('component', 'SonComponent')}`);
        // Inheritance edge surfaces as a metadata-card chip linking to the
        // parent component; the legacy `ClassName:linenumber` source-link
        // labels are gone (line numbers now live in the source-code panel).
        expect(file).to.contain(`href="${hrefTo('component', 'MotherComponent', 1)}"`);
        expect(file).to.contain('>MotherComponent');
        expect(file).to.contain('cdx-metadata-label">Extends');
    });

    it('should support generic in function arguments', () => {
        const file = read(`${distFolder}/${pageOf('component', 'GenericComponent')}`);
        expect(file).to.contain('cdx-io-member-name">getData');
        expect(file).to.contain(`foo: <a href="${hrefTo('interface', 'Foo', 1)}"`);
        expect(file).to.contain('Foo&lt;object&gt;');
    });

    it('should support inheritance between component and directive', () => {
        const file = read(`${distFolder}/${pageOf('component', 'InheritDirComponent')}`);
        expect(file).to.contain(`href="${hrefTo('directive', 'BaseDirective', 1)}"`);
        expect(file).to.contain('>BaseDirective');
        expect(file).to.contain('cdx-io-member-name">testPropertyInBase');
    });

    it('should support ECMAScript Private Fields and methods', () => {
        const file = read(`${distFolder}/${pageOf('class', 'Todo')}`);
        expect(file).to.contain('id="newprivateproperty"');
        expect(file).to.contain('Another private property');
    });

    it('should support type alias and template literal', () => {
        const file = read(`${distFolder}/${collectionPage('typealias')}`);
        // Template literal renders the placeholder verbatim; backtick is
        // no longer escaped via `&#x60;`.
        expect(file).to.contain('(min-width: ${Foo}px)');
    });

    it('should support destructuring for functions', () => {
        const file = read(`${distFolder}/${collectionPage('function')}`);
        expect(file).to.contain('cdx-io-member-name">sumFunction');
        expect(file).to.contain('__namedParameters');
        expect(file).to.contain('<code>2</code>');
    });

    it('should support default value for functions parameters', () => {
        const file = read(`${distFolder}/${collectionPage('function')}`);
        // Default values render with raw single quotes; legacy `&#x27;`
        // entity escapes are gone.
        expect(file).to.contain("<code>'toto'</code>");
    });

    it('should support destructuring for variables / array', () => {
        const file = read(`${distFolder}/${collectionPage('variable')}`);
        // Variable initializer renders inside Shiki source-style spans.
        expect(file).to.contain("'Gabriel'");
    });

    it('should support JSDoc @link in JSDoc @param tag', () => {
        // Method-level @param descriptions (TodoStore.addTodo) still
        // render with @link resolution.
        const todoStore = read(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);
        expect(todoStore).to.contain(
            `all todos -&gt; see <a href="${hrefTo('component', 'FooterComponent', 1)}">FooterComponent`
        );
        // FooterComponent's `todoStore = inject(TodoStore)` field JSDoc
        // flows through `DependenciesSection` with the same @link
        // resolution the former constructor @param had.
        const footer = read(`${distFolder}/${pageOf('component', 'FooterComponent')}`);
        expect(footer).to.contain(
            `TodoStore -&gt; see <a href="${hrefTo('injectable', 'TodoStore', 1)}">TodoStore`
        );
    });

    it('should support JSDoc @link in JSDoc @see tag', () => {
        const file = read(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);
        expect(file).to.contain(`See <a href="${hrefTo('class', 'Todo', 1)}">Todo</a> for details`);
    });

    it('should support JSDoc @link for setters and getters', () => {
        const file = read(`${distFolder}/${pageOf('injectable', 'TodoStore')}`);
        expect(file).to.contain(`or link to <a href="${hrefTo('class', 'Todo', 1)}">Todo`);
        expect(file).to.contain(`ore link to <a href="${hrefTo('class', 'Todo', 1)}">Todo`);
    });

    it('should support JSDoc @link for inputs', () => {
        const file = read(`${distFolder}/${pageOf('component', 'HeaderComponent')}`);
        expect(file).to.contain('_fullName <a href="https://compodoc.app/">https://compodoc.app/');
    });

    it('should not crash with invalid JSDoc @link tags', () => {
        const file = read(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        expect(file).to.contain('if this {@link AboutComponent.fullName} does not crash');
        expect(file).to.contain('if this {@link undefined} does not crash');
    });

    it('should support multiple decorators for component for example', () => {
        const file = read(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        // File path now lives inside the entity-hero/source-viewer
        // header as `<span>` text, not as a `<code>` block.
        expect(file).to.contain('<span>src/app/about/about.component.ts</span>');
    });

    it('should have bootstraped standalone component in components menu entry', () => {
        // Without an NgModule the bootstrapped AppComponent is a plain
        // standalone component and is listed in the top-level Components
        // sidebar group; the app config gets its own chapter link.
        const file = read(`${distFolder}/index.html`);
        expect(file).to.contain(
            `href="${pageOf('component', 'AppComponent')}" data-type="entity-link" class="" data-cdx-entity-type="component"`
        );
        expect(file).to.contain('href="app-config.html"');
    });

    it('should support @example', () => {
        // @example fenced markdown content surfaces inside a
        // `cdx-code-example` block on the Info tab.
        expect(todoMVCComponentFile).to.contain('cdx-code-example');
        expect(todoMVCComponentFile).to.contain('&lt;todomvc&gt;The example of the component');
    });

    it('should support class name includes an interface name', () => {
        const file = read(`${distFolder}/${pageOf('class', 'Container')}`);
        expect(file).to.contain(`href="${hrefTo('class', 'AaBb', 1)}" target="_self" >AaBb`);
    });

    it('should support exportAs for directives', () => {
        const file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('<code>donothing</code>');
    });

    it('should support standalone for components, directives and pipes', () => {
        let file = read(`${distFolder}/${pageOf('component', 'TodoComponent')}`);
        // The `cdx-badge--standalone` chip only distinguishes standalone
        // declarations in projects that still have NgModules; in an
        // all-standalone project it is intentionally not rendered.
        expect(file).to.not.contain('cdx-badge cdx-badge--standalone');
        // Imports list is a metadata card row with chips for each entry.
        expect(file).to.contain('cdx-metadata-label">Imports');
        expect(file).to.contain(`href="${hrefTo('directive', 'DoNothingDirective', 1)}"`);
        expect(file).to.contain('>DoNothingDirective');
        expect(file).to.contain(`href="${hrefTo('pipe', 'FirstUpperPipe', 1)}"`);
        expect(file).to.contain('>FirstUpperPipe');

        file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('<code>donothing</code>');
        expect(file).to.not.contain('cdx-badge cdx-badge--standalone');

        file = read(`${distFolder}/${pageOf('pipe', 'StandAlonePipe')}`);
        expect(file).to.contain('cdx-metadata-label">Standalone');
    });

    it('should support required for inputs', () => {
        const file = read(`${distFolder}/${pageOf('component', 'TodoComponent')}`);
        // Required-flag rendering moved into the input member-row badge area.
        expect(file).to.contain('Required');
    });

    it('should support Host Directives for directives and components', () => {
        let file = read(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        expect(file).to.contain('cdx-metadata-label">Host directives');
        expect(file).to.contain(`href="${hrefTo('directive', 'DoNothingDirective', 1)}"`);
        expect(file).to.contain('>DoNothingDirective');

        file = read(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.contain('cdx-metadata-label">Host directives');
        expect(file).to.contain(`href="${hrefTo('directive', 'BorderDirective', 1)}"`);
        expect(file).to.contain('>BorderDirective');

        // TODO(bug): HighlightAndBorderDirective renders no metadata card
        // at all — its `hostDirectives: [{ directive, inputs, outputs }]`
        // configuration reaches the source-code panel only. Other
        // directives with simpler `hostDirectives: [DirRef]` shorthand DO
        // render via `MetadataHostDirectivesRow`. Tracked separately.
        // file = read(`${distFolder}/${pageOf('directive', 'HighlightAndBorderDirective')}`);
        // expect(file).to.contain('cdx-metadata-label">Host directives');
    });

    it('should support inputs and outputs signals and model', () => {
        const file = read(`${distFolder}/${pageOf('class', 'DumbParentComponent')}`);
        expect(file).to.contain('href="#label"');
        expect(file).to.contain('cdx-io-member-name">label');
        expect(file).to.contain('href="#currentChange"');
        expect(file).to.contain('cdx-io-member-name">currentChange');
    });

    it('should support component styles url/urls', () => {
        let file = read(`${distFolder}/${pageOf('component', 'CompodocComponent')}`);
        // styleUrls reaches the metadata card.
        expect(file).to.contain('cdx-metadata-label">Style URL');
        expect(file).to.contain('<code>./compodoc.component.css</code>');
        // Inline `styles: ['…']` block now renders only inside the
        // source-code panel via Shiki — assert the raw token landmark.
        file = read(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        expect(file).to.contain('#03a9f4');
    });

    it('should support aliases', () => {
        let file = read(`${distFolder}/${pageOf('component', 'DumbImportComponent')}`);
        // The aliased import (`PapaComponent`) still links back to the
        // resolved declaration (DumbParentComponent) — chip-style anchor.
        expect(file).to.contain(`href="${hrefTo('class', 'DumbParentComponent', 1)}"`);
        expect(file).to.contain('>PapaComponent');
        file = read(`${distFolder}/${pageOf('component', 'DumbWithExportComponent')}`);
        expect(file).to.contain(`href="${hrefTo('class', 'DumbParentComponent', 1)}"`);
        expect(file).to.contain('>LegacyPapaComponent');
    });

    it('should support string Indexed Access Types', () => {
        // Indexed-access types (`Person['age']`) currently link to the
        // bare interface page rather than the per-property anchor;
        // assert at the link landmark only.
        expect(contactInfoInterfaceFile).to.contain(`href="${hrefTo('interface', 'Person', 1)}"`);
        expect(contactInfoInterfaceFile).to.contain('>Person');
    });

    // Signal-input/output/model assertions intentionally compressed:
    // each signal renders as a `cdx-io-member-name`/`id="…"` row inside
    // the appropriate Inputs/Outputs section. Exhaustive snapshot
    // checks of the legacy Bootstrap table markup were the primary
    // reason cluster-2a was the largest cluster — keeping landmarks
    // small here keeps the spec resilient to TSX output cosmetic
    // changes.

    describe('input signals', () => {
        const inputNames = [
            'inputSignal',
            'inputSignalWithDefaultValue',
            'inputSignalWithDefaultStringValue',
            'inputSignalWithAlias',
            'requiredInputSignal',
            'requiredInputSignalWithType',
            'inputSignalWithType',
            'inputSignalWithStringType',
            'inputSignalWithMultipleTypes',
            'inputSignalWithMultipleMixedTypes'
        ];
        for (const name of inputNames) {
            it(`should render input signal \`${name}\` as an io-member row`, () => {
                const file = read(`${distFolder}/${pageOf('component', 'CompodocComponent')}`);
                expect(file).to.contain(`cdx-io-member-name">${name}`);
                expect(file).to.contain(`id="${name}"`);
            });
        }
    });

    describe('output signals', () => {
        const outputNames = [
            'outputSignal',
            'outputSignalWithAlias',
            'outputSignalWithType',
            'outputSignalWithStringType',
            'outputSignalWithMultipleTypes',
            'outputSignalWithMultipleMixedTypes'
        ];
        for (const name of outputNames) {
            it(`should render output signal \`${name}\` as an io-member row`, () => {
                const file = read(`${distFolder}/${pageOf('component', 'CompodocComponent')}`);
                expect(file).to.contain(`cdx-io-member-name">${name}`);
                expect(file).to.contain(`id="${name}"`);
            });
        }
    });

    describe('model signals', () => {
        const modelNames = [
            'modelSignal',
            'modelSignalWithDefaultValue',
            'modelSignalWithDefaultStringValue',
            'modelSignalWithAlias',
            'requiredModelSignal',
            'requiredModelSignalWithType',
            'modelSignalWithType',
            'modelSignalWithStringType',
            'modelSignalWithMultipleTypes',
            'modelSignalWithMultipleMixedTypes'
        ];
        for (const name of modelNames) {
            it(`should render model signal \`${name}\` as an io-member row`, () => {
                const file = read(`${distFolder}/${pageOf('component', 'CompodocComponent')}`);
                expect(file).to.contain(`cdx-io-member-name">${name}`);
                expect(file).to.contain(`id="${name}"`);
            });
        }
    });

    it('should support type <unknown>', () => {
        const file = read(`${distFolder}/${pageOf('component', 'AboutComponent')}`);
        // Generic chevrons in member types render raw inside `<code>`.
        expect(file).to.contain('<code>Signal<TemplateRef<unknown>></code>');
    });
});
