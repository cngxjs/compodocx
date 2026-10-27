import {
    DEFAULT_FAVICON,
    faviconImage,
    isLogoLayoutSetting,
    logoAspect,
    logoImage,
    logoLayoutFor
} from '../../../../src/app/page-generator/brand-images';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** A PNG signature plus an IHDR chunk header with the given size. */
const png = (width: number, height: number): Uint8Array => {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set(text('IHDR'), 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
};

describe('brand images', () => {
    it('links the bundled SVG favicon without a custom one', () => {
        expect(faviconImage('')).toEqual({ file: DEFAULT_FAVICON, type: 'image/svg+xml' });
        expect(faviconImage(undefined)).toEqual({ file: DEFAULT_FAVICON, type: 'image/svg+xml' });
    });

    it.each([
        ['./brand/favicon.svg', 'favicon.svg', 'image/svg+xml'],
        ['./brand/icon.ico', 'favicon.ico', 'image/x-icon'],
        ['brand\\Icon.PNG', 'favicon.png', 'image/png']
    ])('keeps the extension of %s', (source, file, type) => {
        expect(faviconImage(source)).toEqual({ file, type });
    });

    it('omits the type of an unknown extension', () => {
        expect(faviconImage('./brand/icon.gif')).toEqual({ file: 'favicon.gif', type: undefined });
        expect(faviconImage('./brand/.hidden/icon')).toEqual({ file: 'favicon', type: undefined });
    });

    it('names the logo by its file name', () => {
        expect(logoImage('./brand/logo.svg')).toBe('logo.svg');
        expect(logoImage('brand\\logo.png')).toBe('logo.png');
        expect(logoImage('logo.png')).toBe('logo.png');
    });

    describe('logo aspect ratio', () => {
        it('reads the SVG viewBox, also with commas and a non-zero origin', () => {
            expect(logoAspect(text('<svg viewBox="0 0 400 100"></svg>'), 'a.svg')).toBe(4);
            expect(logoAspect(text("<svg viewBox='8,8, 330,84'/>"), 'a.SVG')).toBeCloseTo(330 / 84);
        });

        it('falls back to the plain or px width and height of the root svg', () => {
            const svg = '<?xml version="1.0"?>\n<svg width="120px" height="40">';
            expect(logoAspect(text(svg), 'logo.svg')).toBe(3);
        });

        it('is unknown for percentages, other units, missing sizes and non-svg text', () => {
            for (const svg of [
                '<svg width="100%" height="40">',
                '<svg width="10em" height="4em">',
                '<svg viewBox="0 0 0 10">',
                '<svg>',
                'not an svg'
            ]) {
                expect(logoAspect(text(svg), 'logo.svg')).toBeUndefined();
            }
        });

        it('reads the PNG header', () => {
            expect(logoAspect(png(64, 64), 'icon.png')).toBe(1);
            expect(logoAspect(png(300, 76), 'brand\\Logo.PNG')).toBeCloseTo(300 / 76);
        });

        it('is unknown for a broken PNG and other formats', () => {
            expect(logoAspect(png(64, 64).slice(0, 20), 'icon.png')).toBeUndefined();
            expect(logoAspect(text('GIF89a'), 'icon.png')).toBeUndefined();
            expect(logoAspect(png(64, 64), 'icon.jpg')).toBeUndefined();
        });
    });

    describe('logo layout', () => {
        it('keeps an explicit layout whatever the aspect ratio', () => {
            expect(logoLayoutFor('icon', 4)).toBe('icon');
            expect(logoLayoutFor('wordmark', 1)).toBe('wordmark');
        });

        it('treats 2:1 and wider as a wordmark, narrower as an icon', () => {
            expect(logoLayoutFor('auto', 2)).toBe('wordmark');
            expect(logoLayoutFor('auto', 3.9)).toBe('wordmark');
            expect(logoLayoutFor('auto', 1.99)).toBe('icon');
            expect(logoLayoutFor('auto', 1)).toBe('icon');
        });

        it('keeps the logo-only layout when the ratio is unknown', () => {
            expect(logoLayoutFor('auto', undefined)).toBe('wordmark');
        });

        it('recognises the setting values', () => {
            expect(['auto', 'icon', 'wordmark'].every(isLogoLayoutSetting)).toBe(true);
            expect(isLogoLayoutSetting('square')).toBe(false);
            expect(isLogoLayoutSetting(undefined)).toBe(false);
        });
    });
});
