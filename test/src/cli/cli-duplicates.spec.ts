import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI duplicates support', () => {
    const distFolder = `${tmp.name}-duplicates`;

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/todomvc-ng2-duplicates/src/tsconfig.json',
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
        const file = exists(`${distFolder}/classes/Todo.html`);
        expect(file).to.be.true;
    });

    it('Todo-1 class generated', () => {
        const file = exists(`${distFolder}/classes/Todo-1.html`);
        expect(file).to.be.true;
    });

    it('Todo-2 class generated', () => {
        const file = exists(`${distFolder}/classes/Todo-2.html`);
        expect(file).to.be.true;
    });

    // Duplicate suffixes follow the sorted source path order, so each page
    // documents the same declaration on every build.
    it('Todo documents the miscellaneous todo.model.ts', () => {
        const file = read(`${distFolder}/classes/Todo.html`);
        expect(file).to.contain('src/app/shared/miscellaneous/todo.model.ts');
    });

    it('Todo-1 documents models/todo.model.1.ts', () => {
        const file = read(`${distFolder}/classes/Todo-1.html`);
        expect(file).to.contain('src/app/shared/models/todo.model.1.ts');
    });

    it('Todo-2 documents models/todo.model.ts', () => {
        const file = read(`${distFolder}/classes/Todo-2.html`);
        expect(file).to.contain('src/app/shared/models/todo.model.ts');
    });

    it('TimeInterface generated', () => {
        const file = exists(`${distFolder}/interfaces/TimeInterface.html`);
        expect(file).to.be.true;
    });

    it('TimeInterface-1 generated', () => {
        const file = exists(`${distFolder}/interfaces/TimeInterface-1.html`);
        expect(file).to.be.true;
    });

    it('EmptyService generated', () => {
        const file = exists(`${distFolder}/injectables/EmptyService.html`);
        expect(file).to.be.true;
    });

    it('EmptyService-1 generated', () => {
        const file = exists(`${distFolder}/injectables/EmptyService-1.html`);
        expect(file).to.be.true;
    });

    it('FirstUpperPipe generated', () => {
        const file = exists(`${distFolder}/pipes/FirstUpperPipe.html`);
        expect(file).to.be.true;
    });

    it('NoopInterceptor generated', () => {
        const file = exists(`${distFolder}/interceptors/NoopInterceptor.html`);
        expect(file).to.be.true;
    });

    it('NoopInterceptor-1 generated', () => {
        const file = exists(`${distFolder}/interceptors/NoopInterceptor-1.html`);
        expect(file).to.be.true;
    });

    it('EmptyComponent generated', () => {
        const file = exists(`${distFolder}/components/EmptyComponent.html`);
        expect(file).to.be.true;
    });

    it('EmptyComponent-1 generated', () => {
        const file = exists(`${distFolder}/components/EmptyComponent-1.html`);
        expect(file).to.be.true;
    });

    it('DoNothingDirective generated', () => {
        const file = exists(`${distFolder}/directives/DoNothingDirective.html`);
        expect(file).to.be.true;
    });

    it('DoNothingDirective-1 generated', () => {
        const file = exists(`${distFolder}/directives/DoNothingDirective-1.html`);
        expect(file).to.be.true;
    });

    it('should support component inside module', () => {
        // The inline TSX menu (`Menu.tsx`) DOES emit a sub-entity anchor
        // for nested-in-module components — the link sits inside the
        // module's `<ul id="components-links-module-…">` group with
        // `data-context="sub-entity" data-context-id="modules"`.
        const indexFile = read(`${distFolder}/index.html`);
        expect(indexFile).to.contain('data-context="sub-entity" data-context-id="modules"');
        expect(indexFile).to.contain('>ValidationDemo');
    });

    it('should support component inside module with duplicate', () => {
        const indexFile = read(`${distFolder}/index.html`);
        // The duplicates fixture mounts FooterComponent under its
        // owning module via the same sub-entity link shape.
        expect(indexFile).to.contain(
            'data-context="sub-entity" data-context-id="modules" class="" data-cdx-entity-type="component"'
        );
        expect(indexFile).to.contain('>FooterComponent');
    });

    it('Injectable with multiple decorators should not appear twice', () => {
        let file = exists(`${distFolder}/injectables/MyService.html`);
        expect(file).to.be.true;
        file = exists(`${distFolder}/injectables/MyService-1.html`);
        expect(file).to.be.false;
    });
});
