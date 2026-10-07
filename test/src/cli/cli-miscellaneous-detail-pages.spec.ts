import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';
import { collectionPage } from './paths';

const tmp = temporaryDir();

describe('CLI miscellaneous detail-page generation (@category opt-in)', () => {
    const distFolder = `${tmp.name}-misc-detail`;
    const fixtureFolder = `${tmp.name}-misc-detail-fixture`;

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

    let collectionFunctions: string;
    let collectionVariables: string;
    let collectionTypealiases: string;
    let collectionEnumerations: string;

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
                `/** Untagged helper — stays as an anchor on the collection page. */\n` +
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

        collectionFunctions = read(`${distFolder}/${collectionPage('function')}`);
        collectionVariables = read(`${distFolder}/${collectionPage('variable')}`);
        collectionTypealiases = read(`${distFolder}/${collectionPage('typealias')}`);
        collectionEnumerations = read(`${distFolder}/${collectionPage('enumeration')}`);
    });

    afterAll(() => {
        tmp.clean(distFolder);
        tmp.clean(fixtureFolder);
    });

    it('generates a detail page for every @category-tagged miscellaneous symbol', () => {
        expect(exists(`${distFolder}/${pageOf('function', 'provideToaster', { detail: true })}`)).to
            .be.true;
        expect(exists(`${distFolder}/${pageOf('variable', 'TOAST_TOKEN', { detail: true })}`)).to.be
            .true;
        expect(exists(`${distFolder}/${pageOf('typealias', 'ToastConfig', { detail: true })}`)).to
            .be.true;
        expect(exists(`${distFolder}/${pageOf('enumeration', 'ToastPosition', { detail: true })}`))
            .to.be.true;
    });

    it('does NOT generate detail pages for untagged miscellaneous symbols', () => {
        expect(exists(`${distFolder}/${pageOf('function', 'helperFn', { detail: true })}`)).to.be
            .false;
        expect(exists(`${distFolder}/${pageOf('variable', 'VERSION', { detail: true })}`)).to.be
            .false;
        expect(exists(`${distFolder}/${pageOf('typealias', 'Maybe', { detail: true })}`)).to.be
            .false;
        expect(exists(`${distFolder}/${pageOf('enumeration', 'Theme', { detail: true })}`)).to.be
            .false;
    });

    it('keeps untagged entries inline on the shared collection page (anchors still resolve)', () => {
        expect(collectionFunctions).to.match(/id="helperFn"/);
        expect(collectionVariables).to.match(/id="VERSION"/);
        expect(collectionTypealiases).to.match(/id="Maybe"/);
        expect(collectionEnumerations).to.match(/id="Theme"/);
    });

    it('renders a tagged-detail jump-link on the collection page for each tagged entry', () => {
        expect(collectionFunctions).to.contain('cdx-tagged-detail-links');
        expect(collectionFunctions).to.contain('href="functions/provideToaster.html"');
        expect(collectionVariables).to.contain('href="variables/TOAST_TOKEN.html"');
        expect(collectionTypealiases).to.contain('href="typealiases/ToastConfig.html"');
        expect(collectionEnumerations).to.contain('href="enumerations/ToastPosition.html"');
    });

    it('detail pages render the entity name in the hero and surface the description', () => {
        const detail = read(
            `${distFolder}/${pageOf('function', 'provideToaster', { detail: true })}`
        );
        expect(detail).to.match(/<h1[^>]*class="cdx-entity-hero-name">[\s\S]*?provideToaster/);
        expect(detail).to.contain('Provides the toaster feature');
        // Category badge surfaced on the hero
        expect(detail).to.contain('Toast');
        // Breadcrumb chain: Miscellaneous > Functions > provideToaster
        expect(detail).to.contain('class="cdx-breadcrumb"');
    });

    it('detail pages use the singular template context (override hook stable)', () => {
        const detail = read(
            `${distFolder}/${pageOf('function', 'provideToaster', { detail: true })}`
        );
        // The entity hero is shared with EntityPage; assert it's a per-entity
        // shell (single-row), not the collection shell that includes IndexMisc.
        expect(detail).to.not.contain('data-compodoc="block-theming-index"');
        // Per-entity pages live two levels deep — relative resources walk up 2x.
        expect(detail).to.match(/href="\.\.\/\.\.\/styles\/compodocx\.css"/);
    });

    it('the global Miscellaneous chapter still links only the collection pages', () => {
        const index = read(`${distFolder}/index.html`);
        const chapterMatch = index.match(/id="miscellaneous-links"[\s\S]*?<\/ul>/);
        const chapter = chapterMatch?.[0] ?? '';
        expect(chapter).to.contain(`href="${collectionPage('function')}"`);
        expect(chapter).to.not.contain('miscellaneous/functions/');
    });
});
