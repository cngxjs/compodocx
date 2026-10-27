import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/styles/components/sidebar.css', 'utf8');

/** The declarations of the first block that starts with `selector {`. */
const block = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf('\n}', start));
};

const fontSize = (selector: string): string | undefined =>
    block(selector).match(/font-size:\s*([^;]+);/)?.[1];

describe('sidebar bucket row', () => {
    // A bucket without a landing page renders its label as a <span>, which no
    // menu anchor rule reaches; the label inherits the row's size.
    it('sets the font size of a chapter row on the row itself', () => {
        expect(fontSize('.cdx-bucket-row')).toBeDefined();
        expect(fontSize('.cdx-bucket-row')).toBe(fontSize('.menu ul.list li.chapter .simple'));
    });
});
