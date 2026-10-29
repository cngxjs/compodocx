import { describe, expect, it } from 'vitest';
import { isSameOriginFrame } from '../../../src/client/examples';

describe('isSameOriginFrame', () => {
    it('is true for a frame next to the page', () => {
        expect(isSameOriginFrame('/demo/#/x', 'https://docs.dev/v1/Foo.html')).toBe(true);
    });

    it('is false on file://, where every file is an origin of its own', () => {
        expect(isSameOriginFrame('../assets/demo.html', 'file:///site/forms/Foo.html')).toBe(false);
    });

    it('is false for a frame on another protocol or host', () => {
        expect(isSameOriginFrame('https://demo.dev/#/x', 'file:///site/forms/Foo.html')).toBe(
            false
        );
        expect(isSameOriginFrame('https://demo.dev/#/x', 'https://docs.dev/Foo.html')).toBe(false);
        expect(isSameOriginFrame('//demo.dev/x', 'https://docs.dev/Foo.html')).toBe(false);
    });
});
