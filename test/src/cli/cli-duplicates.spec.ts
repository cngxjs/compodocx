import * as path from 'node:path';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { pagesIn } from '../helpers/pages';

/** The type layout this suite asserts (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

const tmp = temporaryDir();

describe('CLI duplicates support', () => {
    const distFolder = `${tmp.name}-duplicates`;
    const pages = pagesIn(distFolder);

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
        const file = exists(`${distFolder}/${pages.of('class', 'Todo')}`);
        expect(file).to.be.true;
    });

    it('Todo-2 class generated', () => {
        const file = exists(`${distFolder}/${pages.of('class', 'Todo', { file: 'Todo-2' })}`);
        expect(file).to.be.true;
    });

    it('Todo-3 class generated', () => {
        const file = exists(`${distFolder}/${pages.of('class', 'Todo', { file: 'Todo-3' })}`);
        expect(file).to.be.true;
    });

    // The first copy by source path keeps the bare name, later ones get -2,
    // -3 in path order, so each page documents the same declaration on every build.
    it('Todo documents the miscellaneous todo.model.ts', () => {
        const file = read(`${distFolder}/${pages.of('class', 'Todo')}`);
        expect(file).to.contain('src/app/shared/miscellaneous/todo.model.ts');
    });

    it('Todo-2 documents models/todo.model.1.ts', () => {
        const file = read(`${distFolder}/${pages.of('class', 'Todo', { file: 'Todo-2' })}`);
        expect(file).to.contain('src/app/shared/models/todo.model.1.ts');
    });

    it('Todo-3 documents models/todo.model.ts', () => {
        const file = read(`${distFolder}/${pages.of('class', 'Todo', { file: 'Todo-3' })}`);
        expect(file).to.contain('src/app/shared/models/todo.model.ts');
    });

    it('TimeInterface generated', () => {
        const file = exists(`${distFolder}/${pages.of('interface', 'TimeInterface')}`);
        expect(file).to.be.true;
    });

    it('TimeInterface-2 generated', () => {
        const file = exists(
            `${distFolder}/${pages.of('interface', 'TimeInterface', { file: 'TimeInterface-2' })}`
        );
        expect(file).to.be.true;
    });

    it('EmptyService generated', () => {
        const file = exists(`${distFolder}/${pages.of('injectable', 'EmptyService')}`);
        expect(file).to.be.true;
    });

    it('EmptyService-2 generated', () => {
        const file = exists(
            `${distFolder}/${pages.of('injectable', 'EmptyService', { file: 'EmptyService-2' })}`
        );
        expect(file).to.be.true;
    });

    it('FirstUpperPipe generated', () => {
        const file = exists(`${distFolder}/${pages.of('pipe', 'FirstUpperPipe')}`);
        expect(file).to.be.true;
    });

    it('NoopInterceptor generated', () => {
        const file = exists(`${distFolder}/${pages.of('interceptor', 'NoopInterceptor')}`);
        expect(file).to.be.true;
    });

    it('NoopInterceptor-2 generated', () => {
        const file = exists(
            `${distFolder}/${pages.of('interceptor', 'NoopInterceptor', { file: 'NoopInterceptor-2' })}`
        );
        expect(file).to.be.true;
    });

    it('EmptyComponent generated', () => {
        const file = exists(`${distFolder}/${pages.of('component', 'EmptyComponent')}`);
        expect(file).to.be.true;
    });

    it('EmptyComponent-2 generated', () => {
        const file = exists(
            `${distFolder}/${pages.of('component', 'EmptyComponent', { file: 'EmptyComponent-2' })}`
        );
        expect(file).to.be.true;
    });

    it('DoNothingDirective generated', () => {
        const file = exists(`${distFolder}/${pages.of('directive', 'DoNothingDirective')}`);
        expect(file).to.be.true;
    });

    it('DoNothingDirective-2 generated', () => {
        const file = exists(
            `${distFolder}/${pages.of('directive', 'DoNothingDirective', { file: 'DoNothingDirective-2' })}`
        );
        expect(file).to.be.true;
    });

    it('should list a standalone component in the components chapter', () => {
        const indexFile = menuOf(distFolder);
        expect(indexFile).to.contain(
            `<a href="${pages.of('component', 'ValidationDemo')}" data-type="entity-link" class="" data-cdx-entity-type="component"><span class="cdx-menu-item-name">ValidationDemo`
        );
    });

    it('should list both duplicated standalone components in the components chapter', () => {
        const indexFile = menuOf(distFolder);
        expect(indexFile).to.contain(`<a href="${pages.of('component', 'FooterComponent')}"`);
        expect(indexFile).to.contain(
            `<a href="${pages.of('component', 'FooterComponent', { file: 'FooterComponent-2' })}"`
        );
        expect(indexFile).to.contain('<span class="cdx-menu-item-name">FooterComponent');
    });

    it('Injectable with multiple decorators should not appear twice', () => {
        const file = exists(`${distFolder}/${pages.of('injectable', 'MyService')}`);
        expect(file).to.be.true;
        expect(() => pages.of('injectable', 'MyService', { file: 'MyService-2' })).to.throw(/^0 /);
    });
});
