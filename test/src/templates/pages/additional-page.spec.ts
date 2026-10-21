import { describe, expect, it } from 'vitest';

import { AdditionalPage } from '../../../../src/templates/pages/AdditionalPage';

// The test transform adds JSX debug attributes to every element.
const plain = (html: string): string => html.replace(/ __(?:self|source)="[^"]*"/g, '');

describe('additional page', () => {
    it('escapes the heading and renders it before the markdown', () => {
        const html = plain(
            AdditionalPage({ additionalPage: '<p>Body</p>', pageHeading: 'A & <b>' })
        );
        expect(html).toBe('<div class="cdx-readme"><h1>A &amp; &lt;b></h1><p>Body</p></div>');
    });

    it('renders the plain markup without a heading', () => {
        const html = plain(AdditionalPage({ additionalPage: '<p>Body</p>' }));
        expect(html).toBe('<div class="cdx-readme"><p>Body</p></div>');
    });
});
