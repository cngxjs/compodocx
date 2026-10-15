import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * `copyResources` copies `src/resources/` into every generated site as is,
 * and the folder ships in the npm package. Anything placed there lands in
 * every site, so the bundled scripts are pinned here.
 */
const RESOURCES = path.resolve(__dirname, '../../../../src/resources');

/** Output of `npm run build:client`, regenerated on every build. */
const CLIENT_BUNDLE = new Set(['compodocx.js', 'chunks']);

describe('bundled resources', () => {
    it('ships no scripts besides the client bundle', () => {
        const scripts = fs
            .readdirSync(path.join(RESOURCES, 'js'))
            .filter(name => !CLIENT_BUNDLE.has(name));
        expect(scripts).toEqual([]);
    });
});
