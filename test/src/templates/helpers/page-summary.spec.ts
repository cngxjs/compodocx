import { describe, expect, it } from 'vitest';
import { pageSummary, sentenceEnd } from '../../../../src/templates/helpers/page-summary';

describe('pageSummary', () => {
    it('keeps inline code', () => {
        expect(pageSummary('<p>Wraps <code>inject()</code> for tests. More.</p>')).toBe(
            'Wraps <code>inject()</code> for tests'
        );
    });

    it('does not end a sentence after e.g., i.e., etc. or vs.', () => {
        expect(
            pageSummary('<p>Any shape, e.g. a card, i.e. a box, etc. and more vs. less. Next.</p>')
        ).toBe('Any shape, e.g. a card, i.e. a box, etc. and more vs. less');
        expect(pageSummary('<p>Some (E.G. big) thing. Next.</p>')).toBe('Some (E.G. big) thing');
    });

    it('cuts at the first real sentence end', () => {
        expect(pageSummary('<p>First one. Second one. Third.</p>')).toBe('First one');
    });

    it('ignores a period inside code', () => {
        expect(pageSummary('<p>Reads <code>a. b</code> safely. Then more.</p>')).toBe(
            'Reads <code>a. b</code> safely'
        );
    });

    it('reads a link as its text', () => {
        expect(pageSummary('<p>See <a href="x.html"><code>Foo</code></a> here.</p>')).toBe(
            'See <code>Foo</code> here'
        );
        expect(pageSummary('<p>Uses {@link Pt} here.</p>')).toBe('Uses Pt here');
    });

    it('inserts no space around removed inline tags', () => {
        expect(pageSummary('<p>Waits (default <span class="x">500</span>) ms.</p>')).toBe(
            'Waits (default 500) ms'
        );
    });

    it('ends a sentence at ? and !, closing tags left open', () => {
        expect(pageSummary('<p>Why not? Because.</p>')).toBe('Why not');
        expect(pageSummary('<p><em>Stop! Now</em> please.</p>')).toBe('<em>Stop</em>');
    });

    it('returns undefined for empty or tag-only input', () => {
        expect(pageSummary(undefined)).toBeUndefined();
        expect(pageSummary('')).toBeUndefined();
        expect(pageSummary('<p> </p><br/>')).toBeUndefined();
    });
});

describe('sentenceEnd', () => {
    it('finds the terminator index or -1', () => {
        expect(sentenceEnd('One. Two.')).toBe(3);
        expect(sentenceEnd('No end here')).toBe(-1);
        expect(sentenceEnd('Version 1.2 ships')).toBe(-1);
    });
});
