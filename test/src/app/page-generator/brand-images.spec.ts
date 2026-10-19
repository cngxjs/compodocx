import {
    DEFAULT_FAVICON,
    faviconImage,
    logoImage
} from '../../../../src/app/page-generator/brand-images';

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
});
