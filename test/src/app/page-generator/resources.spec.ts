import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * `copyResources` copies `src/resources/` into every generated site as is,
 * and the folder ships in the npm package. Anything placed there lands in
 * every site, so the bundled scripts and themes are pinned here.
 */
const RESOURCES = path.resolve(__dirname, '../../../../src/resources');

/** Output of `npm run build:client`, regenerated on every build. */
const CLIENT_BUNDLE = new Set(['compodocx.js', 'chunks']);

describe('bundled resources', () => {
    it('ships no scripts besides the client bundle', () => {
        const scripts = fs
            .readdirSync(path.join(RESOURCES, 'js'))
            .filter(name => !name.startsWith('.') && !CLIENT_BUNDLE.has(name));
        expect(scripts).toEqual([]);
    });

    it('keeps the bundled themes in one place', () => {
        const themes = path.resolve(RESOURCES, '../themes');
        expect(fs.readdirSync(themes).filter(name => !name.startsWith('.'))).toEqual([
            'theme-template.css'
        ]);
        expect(fs.existsSync(path.join(RESOURCES, 'styles/theme-template.css'))).toBe(false);
    });
});
