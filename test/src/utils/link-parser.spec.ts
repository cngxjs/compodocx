import { describe, expect, it } from 'vitest';
import { splitLinkText } from '../../../src/utils/link-parser';

describe('splitLinkText', () => {
    it('splits at the pipe', () => {
        expect(splitLinkText('Foo|the foo')).toEqual({ target: 'Foo', linkText: 'the foo' });
    });

    it('trims the spaces around the pipe', () => {
        expect(splitLinkText('./guide.md#setup | Setup')).toEqual({
            target: './guide.md#setup',
            linkText: 'Setup'
        });
    });

    it('splits at the first space without a pipe', () => {
        expect(splitLinkText('Foo the foo')).toEqual({ target: 'Foo', linkText: 'the foo' });
    });

    it('keeps a bare target without link text', () => {
        expect(splitLinkText('Foo')).toEqual({ target: 'Foo', linkText: undefined });
    });
});
