import * as path from 'node:path';
import { hasStderrError, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

/** The type layout this suite asserts (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

const tmp = temporaryDir();

describe('CLI toggle menu items', () => {
    describe('with a list', () => {
        const distFolder = `${tmp.name}-toggle`;
        let indexFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '-c',
                TYPE_LAYOUT,
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '--toggleMenuItems',
                'components'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            // The menu is shared by every page in `js/menu.js`.
            indexFile = menuOf(distFolder);
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should leave the listed type expanded and the rest collapsed', () => {
            // `--toggleMenuItems components` keeps the components section open
            // (aria-expanded="true") while every other section starts
            // collapsed (aria-expanded="false"). The `data-cdx-target`
            // pairs each toggler button with the `<ul id="…-links">`
            // it controls.
            expect(indexFile).to.contain(
                'data-cdx-target="#components-links" aria-expanded="true"'
            );
            expect(indexFile).to.contain('data-cdx-target="#pipes-links" aria-expanded="false"');
            expect(indexFile).to.contain(
                'data-cdx-target="#directives-links" aria-expanded="false"'
            );
            expect(indexFile).to.contain(
                'data-cdx-target="#injectables-links" aria-expanded="false"'
            );
        });
    });
});
