import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/styles/compodocx.css', 'utf8');

/** The declarations of the first block that starts with `selector {`. */
const block = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf('\n}', start));
};

describe('sidebar tokens', () => {
    for (const token of [
        '--color-cdx-accent',
        '--color-cdx-accent-subtle',
        '--color-cdx-focus-ring'
    ]) {
        it(`defines ${token} for light and dark`, () => {
            expect(block('@theme')).toMatch(new RegExp(`${token}:`));
            expect(block('.dark')).toMatch(new RegExp(`${token}:`));
        });
    }
});
