import * as fs from 'node:fs';
import * as path from 'node:path';
import { relativePrefix } from '../../../src/app/links/layout';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { featurePage, pagesIn, rootPage } from '../helpers/pages';

/** The type layout this suite asserts (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

const tmp = temporaryDir();

describe('CLI utilities', () => {
    const distFolder = `${tmp.name}-misc-detail`;
    const fixtureFolder = `${tmp.name}-misc-detail-fixture`;
    const pages = pagesIn(distFolder);
    let utilities = '';
    let stdout = '';

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

        stdout = ls.stdout.toString();
        utilities = read(`${distFolder}/${rootPage('utilities')}`);
    });

    afterAll(() => {
        tmp.clean(distFolder);
        tmp.clean(fixtureFolder);
    });

    it('generates a detail page for every miscellaneous symbol', () => {
        // A provider without a feature type gets its page in the providers folder.
        expect(exists(`${distFolder}/${pages.of('provider', 'provideToaster')}`)).to.be.true;
        expect(() => pages.of('function', 'provideToaster')).to.throw(/^0 /);
        expect(exists(`${distFolder}/${pages.of('variable', 'TOAST_TOKEN')}`)).to.be.true;
        expect(exists(`${distFolder}/${pages.of('typealias', 'ToastConfig')}`)).to.be.true;
        expect(exists(`${distFolder}/${pages.of('enumeration', 'ToastPosition')}`)).to.be.true;
    });

    it('generates a page for untagged miscellaneous symbols too', () => {
        expect(exists(`${distFolder}/${pages.of('function', 'helperFn')}`)).to.be.true;
        expect(exists(`${distFolder}/${pages.of('variable', 'VERSION')}`)).to.be.true;
        expect(exists(`${distFolder}/${pages.of('typealias', 'Maybe')}`)).to.be.true;
        expect(exists(`${distFolder}/${pages.of('enumeration', 'Theme')}`)).to.be.true;
    });

    it('lists every symbol on the utilities page, one table per group', () => {
        for (const id of ['functions', 'variables', 'typealiases', 'enumerations']) {
            expect(utilities).to.contain(`id="${id}"`);
        }
        expect(utilities).to.not.contain(`href="${pages.href('provider', 'provideToaster', 0)}"`);
        expect(utilities).to.not.contain('<code>provideToaster</code>');
        expect(utilities).to.contain(`href="${pages.href('function', 'helperFn', 0)}"`);
        expect(utilities).to.contain(`href="${pages.href('variable', 'TOAST_TOKEN', 0)}"`);
        expect(utilities).to.contain(`href="${pages.href('typealias', 'Maybe', 0)}"`);
        expect(utilities).to.contain(`href="${pages.href('enumeration', 'Theme', 0)}"`);
    });

    it('detail pages render the entity name in the hero and surface the description', () => {
        const detailFile = pages.of('function', 'helperFn');
        const detail = read(`${distFolder}/${detailFile}`);
        expect(detail).to.match(/<h1[^>]*class="cdx-entity-hero-name">[\s\S]*?helperFn/);
        expect(detail).to.contain('Untagged helper.');
        // Breadcrumb: the feature (the app's root feature here) > helperFn
        expect(detail).to.contain('class="cdx-breadcrumb"');
        expect(detail).to.contain(
            `href="${relativePrefix(pages.depthOf(detailFile))}${featurePage(['app'])}"`
        );

        const provider = read(`${distFolder}/${pages.of('provider', 'provideToaster')}`);
        expect(provider).to.match(/<h1[^>]*class="cdx-entity-hero-name">[\s\S]*?provideToaster/);
        expect(provider).to.contain('Provides the toaster feature');
        // @category is no longer read: no category badge, a build notice instead.
        expect(provider).not.to.contain('cdx-badge--outline">Toast');
        expect(stdout).to.contain('@category / @docsKind tags are ignored');
    });

    it('detail pages use the singular template context (override hook stable)', () => {
        const detailFile = pages.of('function', 'helperFn');
        const detail = read(`${distFolder}/${detailFile}`);
        // A per-entity shell, not a list page.
        expect(detail).to.not.contain('data-compodoc="block-theming-index"');
        // Per-entity pages climb as many levels as their folder is deep.
        expect(detail).to.contain(
            `href="${relativePrefix(pages.depthOf(detailFile))}styles/compodocx.css"`
        );
    });

    it('the Utilities chapter links the landing page and every symbol page', () => {
        const index = menuOf(distFolder);
        const chapter =
            index.match(/id="utilities-links"[\s\S]*?<\/ul>\s*<\/li>\s*<\/ul>/)?.[0] ?? '';
        expect(chapter).to.contain(`href="${rootPage('utilities')}"`);
        expect(chapter).to.contain(`href="${pages.of('function', 'helperFn')}"`);
        expect(index).to.not.contain('id="miscellaneous-links"');
    });
});
