import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI Theming tab generation', () => {
    const distFolder = `${tmp.name}-theming-tab`;
    const fixtureFolder = `${tmp.name}-theming-tab-fixture`;

    const tsconfigContent = {
        compilerOptions: {
            target: 'es5',
            module: 'commonjs',
            moduleResolution: 'node',
            emitDecoratorMetadata: true,
            experimentalDecorators: true,
            lib: ['es2015', 'dom']
        },
        include: ['src/**/*.ts'],
        exclude: ['node_modules']
    };

    describe('when a component has documented theme tokens in its style file', () => {
        let stdoutString: string;
        let componentHtml: string;
        let plainComponentHtml: string;

        beforeAll(() => {
            tmp.create(fixtureFolder);
            tmp.create(distFolder);

            const srcFolder = path.join(fixtureFolder, 'src');
            fs.mkdirSync(srcFolder, { recursive: true });

            const themedFolder = path.join(srcFolder, 'themed');
            fs.mkdirSync(themedFolder, { recursive: true });

            // Component with both an SCSS styleUrl (SassDoc) and an inline CSS
            // block (JSDoc + @property merge) so we cover both parser paths.
            fs.writeFileSync(
                path.join(themedFolder, 'button.component.ts'),
                `import { Component } from '@angular/core';\n` +
                    `@Component({\n` +
                    `    selector: 'app-button',\n` +
                    `    template: '<button></button>',\n` +
                    `    styleUrls: ['./button.component.scss'],\n` +
                    `    styles: [\n` +
                    `        '/**\\n * Background fill of the button.\\n * @type <color>\\n * @default #ffffff\\n * @group container\\n */\\n@property --btn-bg {\\n    syntax: "<color>";\\n    inherits: true;\\n    initial-value: #ffffff;\\n}'\n` +
                    `    ]\n` +
                    `})\n` +
                    `export class ButtonComponent {}\n`
            );
            fs.writeFileSync(
                path.join(themedFolder, 'button.component.scss'),
                `/// @overview\n` +
                    `/// Theme tokens for the **button** component. Override these in\n` +
                    `/// your global stylesheet to retheme the control.\n` +
                    `\n` +
                    `/// Padding inside the button.\n` +
                    `/// @type Length\n` +
                    `/// @default 8px 12px\n` +
                    `/// @group container\n` +
                    `$btn-padding: 8px 12px !default;\n`
            );

            const plainFolder = path.join(srcFolder, 'plain');
            fs.mkdirSync(plainFolder, { recursive: true });
            fs.writeFileSync(
                path.join(plainFolder, 'plain.component.ts'),
                `import { Component } from '@angular/core';\n` +
                    `@Component({ selector: 'app-plain', template: '<div></div>' })\n` +
                    `export class PlainComponent {}\n`
            );

            fs.writeFileSync(
                path.join(srcFolder, 'app.module.ts'),
                `import { NgModule } from '@angular/core';\n` +
                    `import { ButtonComponent } from './themed/button.component';\n` +
                    `import { PlainComponent } from './plain/plain.component';\n` +
                    `@NgModule({ declarations: [ButtonComponent, PlainComponent] })\n` +
                    `export class AppModule {}\n`
            );

            fs.writeFileSync(
                path.join(fixtureFolder, 'tsconfig.json'),
                JSON.stringify(tsconfigContent, null, 2)
            );

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                path.join(fixtureFolder, 'tsconfig.json'),
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            componentHtml = read(`${distFolder}/${pageOf('component', 'ButtonComponent')}`);
            plainComponentHtml = read(`${distFolder}/${pageOf('component', 'PlainComponent')}`);
        });

        afterAll(() => {
            tmp.clean(distFolder);
            tmp.clean(fixtureFolder);
        });

        it('documentation generated successfully', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('renders the theming panel for components with documented tokens', () => {
            expect(componentHtml).to.contain('id="theming"');
            expect(componentHtml).to.contain('data-compodoc="block-theming"');
        });

        it('includes the theming tab in the header for that component', () => {
            expect(componentHtml).to.contain('theming-tab');
            expect(componentHtml).to.contain('#theming');
        });

        it('renders one cdx-io-member row per documented token, grouped by @group', () => {
            expect(componentHtml).to.contain('cdx-io-member--theming');
            expect(componentHtml).to.contain('data-compodoc="block-theming-token"');
            expect(componentHtml).to.contain('$btn-padding');
            expect(componentHtml).to.contain('--btn-bg');
            expect(componentHtml).to.contain('container');
        });

        it('surfaces the resolved type and default value inline on each row', () => {
            expect(componentHtml).to.contain('cdx-io-member-type');
            expect(componentHtml).to.contain('cdx-io-member-default');
            expect(componentHtml).to.contain('Length');
            expect(componentHtml).to.contain('8px 12px');
            // The @property merge contributes <color> + #ffffff
            expect(componentHtml).to.contain('&lt;color>');
            expect(componentHtml).to.contain('#ffffff');
        });

        it('emits a navigable index of all tokens above the rows', () => {
            expect(componentHtml).to.contain('data-compodoc="block-theming-index"');
            expect(componentHtml).to.contain('cdx-index-indicator--theming');
            // Index appears before the first token row in the panel
            const panelMatch = componentHtml.match(/id="theming"[\s\S]*$/);
            const panel = panelMatch?.[0] ?? '';
            const indexIdx = panel.indexOf('block-theming-index');
            const memberIdx = panel.indexOf('block-theming-token');
            expect(indexIdx).to.be.greaterThan(-1);
            expect(memberIdx).to.be.greaterThan(-1);
            expect(indexIdx).to.be.lessThan(memberIdx);
        });

        it('renders the description for each documented token', () => {
            expect(componentHtml).to.contain('Padding inside the button');
            expect(componentHtml).to.contain('Background fill of the button');
        });

        it('renders the @overview block as the first paragraph above the rows', () => {
            expect(componentHtml).to.contain('cdx-theming-overview');
            expect(componentHtml).to.contain('Theme tokens for the');
            // Markdown was rendered (bold tag from **button**)
            expect(componentHtml).to.match(/cdx-theming-overview[\s\S]*?<strong>button<\/strong>/);
        });

        it('does not render a redundant <h3>Theming</h3> heading inside the panel', () => {
            // The tab header already says "Theming" — no duplicate inside the panel.
            const overviewMatch = componentHtml.match(/id="theming"[^>]*>([\s\S]*?)<\/div>/);
            const panelInner = overviewMatch?.[1] ?? '';
            expect(panelInner).to.not.match(/<h3[^>]*>\s*Theming\s*<a/);
        });

        it('exposes the original style file in the collapsible source panel', () => {
            expect(componentHtml).to.contain('cdx-theming-source');
            expect(componentHtml).to.contain('button.component.scss');
        });

        it('does NOT render the theming tab on components without theme tokens', () => {
            expect(exists(`${distFolder}/${pageOf('component', 'PlainComponent')}`)).to.be.true;
            expect(plainComponentHtml).to.not.contain('id="theming"');
            expect(plainComponentHtml).to.not.contain('data-compodoc="block-theming"');
        });
    });

    describe('when a component uses Angular 21 singular `styleUrl`', () => {
        const singularDistFolder = `${tmp.name}-theming-tab-singular`;
        const singularFixtureFolder = `${tmp.name}-theming-tab-singular-fixture`;
        let componentHtml: string;

        beforeAll(() => {
            tmp.create(singularFixtureFolder);
            tmp.create(singularDistFolder);

            const srcFolder = path.join(singularFixtureFolder, 'src');
            const themedFolder = path.join(srcFolder, 'themed');
            fs.mkdirSync(themedFolder, { recursive: true });

            // Singular `styleUrl: './foo.css'` is the Angular 21 default and
            // must produce the same theming tab as the plural form. Issue #85.
            fs.writeFileSync(
                path.join(themedFolder, 'card.component.ts'),
                `import { Component } from '@angular/core';\n` +
                    `@Component({\n` +
                    `    selector: 'app-card',\n` +
                    `    template: '<div></div>',\n` +
                    `    styleUrl: './card.component.css'\n` +
                    `})\n` +
                    `export class CardComponent {}\n`
            );
            fs.writeFileSync(
                path.join(themedFolder, 'card.component.css'),
                `/**\n` +
                    ` * Background fill of the card.\n` +
                    ` * @type <color>\n` +
                    ` * @default #ffffff\n` +
                    ` * @group container\n` +
                    ` */\n` +
                    `@property --card-bg {\n` +
                    `    syntax: "<color>";\n` +
                    `    inherits: true;\n` +
                    `    initial-value: #ffffff;\n` +
                    `}\n`
            );

            fs.writeFileSync(
                path.join(srcFolder, 'app.module.ts'),
                `import { NgModule } from '@angular/core';\n` +
                    `import { CardComponent } from './themed/card.component';\n` +
                    `@NgModule({ declarations: [CardComponent] })\n` +
                    `export class AppModule {}\n`
            );

            fs.writeFileSync(
                path.join(singularFixtureFolder, 'tsconfig.json'),
                JSON.stringify(tsconfigContent, null, 2)
            );

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                path.join(singularFixtureFolder, 'tsconfig.json'),
                '-d',
                singularDistFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentHtml = read(`${singularDistFolder}/${pageOf('component', 'CardComponent')}`);
        });

        afterAll(() => {
            tmp.clean(singularDistFolder);
            tmp.clean(singularFixtureFolder);
        });

        it('renders the theming panel for the singular-styleUrl component', () => {
            expect(componentHtml).to.contain('id="theming"');
            expect(componentHtml).to.contain('data-compodoc="block-theming"');
        });

        it('surfaces the @property token and its annotated metadata', () => {
            expect(componentHtml).to.contain('--card-bg');
            expect(componentHtml).to.contain('Background fill of the card');
            expect(componentHtml).to.contain('&lt;color>');
            expect(componentHtml).to.contain('#ffffff');
        });

        it('exposes the singular-styleUrl source file in the collapsible source panel', () => {
            expect(componentHtml).to.contain('cdx-theming-source');
            expect(componentHtml).to.contain('card.component.css');
        });
    });
});
