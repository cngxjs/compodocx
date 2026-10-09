import * as path from 'node:path';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

/** The type layout this suite asserts (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

const tmp = temporaryDir();

describe('CLI duplicates support', () => {
    const distFolder = `${tmp.name}-duplicates`;

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '-c',
            TYPE_LAYOUT,
            '--no-multiVersion',
            '-p',
            './test/fixtures/standalone-scenarios/duplicates/tsconfig.json',
            '-d',
            distFolder
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
    });
    afterAll(() => tmp.clean(distFolder));

    it('Todo class generated', () => {
        const file = exists(`${distFolder}/${pageOf('class', 'Todo')}`);
        expect(file).to.be.true;
    });

    it('Todo-1 class generated', () => {
        const file = exists(`${distFolder}/${pageOf('class', 'Todo', { duplicate: 'Todo-1' })}`);
        expect(file).to.be.true;
    });

    it('Todo-2 class generated', () => {
        const file = exists(`${distFolder}/${pageOf('class', 'Todo', { duplicate: 'Todo-2' })}`);
        expect(file).to.be.true;
    });

    // Duplicate suffixes follow the sorted source path order, so each page
    // documents the same declaration on every build.
    it('Todo documents the miscellaneous todo.model.ts', () => {
        const file = read(`${distFolder}/${pageOf('class', 'Todo')}`);
        expect(file).to.contain('src/app/shared/miscellaneous/todo.model.ts');
    });

    it('Todo-1 documents models/todo.model.1.ts', () => {
        const file = read(`${distFolder}/${pageOf('class', 'Todo', { duplicate: 'Todo-1' })}`);
        expect(file).to.contain('src/app/shared/models/todo.model.1.ts');
    });

    it('Todo-2 documents models/todo.model.ts', () => {
        const file = read(`${distFolder}/${pageOf('class', 'Todo', { duplicate: 'Todo-2' })}`);
        expect(file).to.contain('src/app/shared/models/todo.model.ts');
    });

    it('TimeInterface generated', () => {
        const file = exists(`${distFolder}/${pageOf('interface', 'TimeInterface')}`);
        expect(file).to.be.true;
    });

    it('TimeInterface-1 generated', () => {
        const file = exists(
            `${distFolder}/${pageOf('interface', 'TimeInterface', { duplicate: 'TimeInterface-1' })}`
        );
        expect(file).to.be.true;
    });

    it('EmptyService generated', () => {
        const file = exists(`${distFolder}/${pageOf('injectable', 'EmptyService')}`);
        expect(file).to.be.true;
    });

    it('EmptyService-1 generated', () => {
        const file = exists(
            `${distFolder}/${pageOf('injectable', 'EmptyService', { duplicate: 'EmptyService-1' })}`
        );
        expect(file).to.be.true;
    });

    it('FirstUpperPipe generated', () => {
        const file = exists(`${distFolder}/${pageOf('pipe', 'FirstUpperPipe')}`);
        expect(file).to.be.true;
    });

    it('NoopInterceptor generated', () => {
        const file = exists(`${distFolder}/${pageOf('interceptor', 'NoopInterceptor')}`);
        expect(file).to.be.true;
    });

    it('NoopInterceptor-1 generated', () => {
        const file = exists(
            `${distFolder}/${pageOf('interceptor', 'NoopInterceptor', { duplicate: 'NoopInterceptor-1' })}`
        );
        expect(file).to.be.true;
    });

    it('EmptyComponent generated', () => {
        const file = exists(`${distFolder}/${pageOf('component', 'EmptyComponent')}`);
        expect(file).to.be.true;
    });

    it('EmptyComponent-1 generated', () => {
        const file = exists(
            `${distFolder}/${pageOf('component', 'EmptyComponent', { duplicate: 'EmptyComponent-1' })}`
        );
        expect(file).to.be.true;
    });

    it('DoNothingDirective generated', () => {
        const file = exists(`${distFolder}/${pageOf('directive', 'DoNothingDirective')}`);
        expect(file).to.be.true;
    });

    it('DoNothingDirective-1 generated', () => {
        const file = exists(
            `${distFolder}/${pageOf('directive', 'DoNothingDirective', { duplicate: 'DoNothingDirective-1' })}`
        );
        expect(file).to.be.true;
    });

    it('should list a standalone component in the components chapter', () => {
        const indexFile = read(`${distFolder}/index.html`);
        expect(indexFile).to.contain(
            `<a href="${pageOf('component', 'ValidationDemo')}" data-type="entity-link" class="" data-cdx-entity-type="component"><span class="cdx-menu-item-name">ValidationDemo`
        );
    });

    it('should list both duplicated standalone components in the components chapter', () => {
        const indexFile = read(`${distFolder}/index.html`);
        expect(indexFile).to.contain(`<a href="${pageOf('component', 'FooterComponent')}"`);
        expect(indexFile).to.contain(
            `<a href="${pageOf('component', 'FooterComponent', { duplicate: 'FooterComponent-1' })}"`
        );
        expect(indexFile).to.contain('<span class="cdx-menu-item-name">FooterComponent');
    });

    it('Injectable with multiple decorators should not appear twice', () => {
        let file = exists(`${distFolder}/${pageOf('injectable', 'MyService')}`);
        expect(file).to.be.true;
        file = exists(
            `${distFolder}/${pageOf('injectable', 'MyService', { duplicate: 'MyService-1' })}`
        );
        expect(file).to.be.false;
    });
});
