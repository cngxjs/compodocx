import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { featurePage, hrefTo, pageOf, rootPage } from '../helpers/pages';

/** The type layout this suite asserts (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

const tmp = temporaryDir();

describe('CLI utilities', () => {
    const distFolder = `${tmp.name}-misc-detail`;
    const fixtureFolder = `${tmp.name}-misc-detail-fixture`;
    let utilities = '';

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

    beforeAll(() => {
        tmp.create(fixtureFolder);
        tmp.create(distFolder);

        const srcFolder = path.join(fixtureFolder, 'src');
        fs.mkdirSync(srcFolder, { recursive: true });

        fs.writeFileSync(
            path.join(srcFolder, 'providers.ts'),
            `import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';\n` +
                `/**\n` +
                ` * Provides the toaster feature with all required services.\n` +
                ` * @category Toast\n` +
                ` */\n` +
                `export function provideToaster(): EnvironmentProviders {\n` +
                `    return makeEnvironmentProviders([]);\n` +
                `}\n` +
                `/** Untagged helper. */\n` +
                `export function helperFn(): void {}\n`
        );

        fs.writeFileSync(
            path.join(srcFolder, 'tokens.ts'),
            `/**\n` +
                ` * Toaster injection token.\n` +
                ` * @category Toast\n` +
                ` */\n` +
                `export const TOAST_TOKEN = 'toast';\n` +
                `/** Plain workspace version — untagged. */\n` +
                `export const VERSION = '1.0.0';\n`
        );

        fs.writeFileSync(
            path.join(srcFolder, 'types.ts'),
            `/**\n` +
                ` * Configuration shape for the toaster.\n` +
                ` * @category Toast\n` +
                ` */\n` +
                `export type ToastConfig = { duration: number };\n` +
                `/** Untagged alias. */\n` +
                `export type Maybe<T> = T | null;\n`
        );

        fs.writeFileSync(
            path.join(srcFolder, 'enums.ts'),
            `/**\n` +
                ` * Possible toast positions.\n` +
                ` * @category Toast\n` +
                ` */\n` +
                `export enum ToastPosition { Top, Bottom }\n` +
                `/** Untagged theme palette. */\n` +
                `export enum Theme { Light, Dark }\n`
        );

        fs.writeFileSync(
            path.join(srcFolder, 'app.module.ts'),
            `import { NgModule } from '@angular/core';\n` +
                `@NgModule({})\n` +
                `export class AppModule {}\n`
        );

        fs.writeFileSync(
            path.join(fixtureFolder, 'tsconfig.json'),
            JSON.stringify(tsconfigContent, null, 2)
        );

        const ls = shell('node', [
            './bin/index-cli.js',
            '-c',
            TYPE_LAYOUT,
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

        utilities = read(`${distFolder}/${rootPage('utilities')}`);
    });

    afterAll(() => {
        tmp.clean(distFolder);
        tmp.clean(fixtureFolder);
    });

    it('generates a detail page for every @category-tagged miscellaneous symbol', () => {
        // A provider without a feature type gets its page in the providers folder.
        expect(exists(`${distFolder}/${pageOf('provider', 'provideToaster')}`)).to.be.true;
        expect(exists(`${distFolder}/${pageOf('function', 'provideToaster')}`)).to.be.false;
        expect(exists(`${distFolder}/${pageOf('variable', 'TOAST_TOKEN')}`)).to.be.true;
        expect(exists(`${distFolder}/${pageOf('typealias', 'ToastConfig')}`)).to.be.true;
        expect(exists(`${distFolder}/${pageOf('enumeration', 'ToastPosition')}`)).to.be.true;
    });

    it('generates a page for untagged miscellaneous symbols too', () => {
        expect(exists(`${distFolder}/${pageOf('function', 'helperFn')}`)).to.be.true;
        expect(exists(`${distFolder}/${pageOf('variable', 'VERSION')}`)).to.be.true;
        expect(exists(`${distFolder}/${pageOf('typealias', 'Maybe')}`)).to.be.true;
        expect(exists(`${distFolder}/${pageOf('enumeration', 'Theme')}`)).to.be.true;
    });

    it('lists every symbol on the utilities page, one table per group', () => {
        for (const id of ['functions', 'variables', 'typealiases', 'enumerations']) {
            expect(utilities).to.contain(`id="${id}"`);
        }
        expect(utilities).to.not.contain(`href="${hrefTo('function', 'provideToaster', 0)}"`);
        expect(utilities).to.not.contain('<code>provideToaster</code>');
        expect(utilities).to.contain(`href="${hrefTo('function', 'helperFn', 0)}"`);
        expect(utilities).to.contain(`href="${hrefTo('variable', 'TOAST_TOKEN', 0)}"`);
        expect(utilities).to.contain(`href="${hrefTo('typealias', 'Maybe', 0)}"`);
        expect(utilities).to.contain(`href="${hrefTo('enumeration', 'Theme', 0)}"`);
    });

    it('detail pages render the entity name in the hero and surface the description', () => {
        const detail = read(`${distFolder}/${pageOf('function', 'helperFn')}`);
        expect(detail).to.match(/<h1[^>]*class="cdx-entity-hero-name">[\s\S]*?helperFn/);
        expect(detail).to.contain('Untagged helper.');
        // Breadcrumb: the feature (the app's root feature here) > helperFn
        expect(detail).to.contain('class="cdx-breadcrumb"');
        expect(detail).to.contain(`href="../${featurePage(['app'])}"`);

        const provider = read(`${distFolder}/${pageOf('provider', 'provideToaster')}`);
        expect(provider).to.match(/<h1[^>]*class="cdx-entity-hero-name">[\s\S]*?provideToaster/);
        expect(provider).to.contain('Provides the toaster feature');
        // Category badge surfaced on the hero
        expect(provider).to.contain('Toast');
    });

    it('detail pages use the singular template context (override hook stable)', () => {
        const detail = read(`${distFolder}/${pageOf('function', 'helperFn')}`);
        // A per-entity shell, not a list page.
        expect(detail).to.not.contain('data-compodoc="block-theming-index"');
        // Per-entity pages live one level deep.
        expect(detail).to.match(/href="\.\.\/styles\/compodocx\.css"/);
    });

    it('the Utilities chapter links the landing page and every symbol page', () => {
        const index = read(`${distFolder}/index.html`);
        const chapter =
            index.match(/id="utilities-links"[\s\S]*?<\/ul>\s*<\/li>\s*<\/ul>/)?.[0] ?? '';
        expect(chapter).to.contain(`href="${rootPage('utilities')}"`);
        expect(chapter).to.contain(`href="${pageOf('function', 'helperFn')}"`);
        expect(index).to.not.contain('id="miscellaneous-links"');
    });
});
