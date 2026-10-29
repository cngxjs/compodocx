import { describe, expect, it } from 'vitest';
import { stripExampleUrlTags } from '../../../src/utils/example-urls';

describe('stripExampleUrlTags', () => {
    it('drops a tag on its own line and the line with it', () => {
        expect(stripExampleUrlTags('Intro.\n\n<example-url>/demo/a</example-url>\n')).toBe(
            'Intro.'
        );
    });

    it('keeps the text around an inline tag', () => {
        expect(stripExampleUrlTags('See <example-url>/demo/a</example-url> here.')).toBe(
            'See  here.'
        );
    });

    it('drops several tags', () => {
        expect(
            stripExampleUrlTags(
                'A\n<example-url>/a</example-url>\n<example-url>/b</example-url>\nB'
            )
        ).toBe('A\nB');
    });

    it('leaves text without tags as it is', () => {
        expect(stripExampleUrlTags('Plain text.\n')).toBe('Plain text.\n');
    });
});
