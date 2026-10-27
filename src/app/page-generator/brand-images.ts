/** Output folder (from the site root) of the favicon and the logo. */
export const IMAGES_FOLDER = 'images';

/** Bundled favicon, linked when no `customFavicon` is set. */
export const DEFAULT_FAVICON = 'favicon.svg';

const FAVICON_TYPES: Readonly<Record<string, string>> = {
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    png: 'image/png'
};

export interface FaviconImage {
    /** File name below {@link IMAGES_FOLDER}. */
    readonly file: string;
    /** MIME type for the `<link rel="icon">`; undefined for an unknown extension. */
    readonly type: string | undefined;
}

/** Last segment of a `/` or `\` separated path. */
const baseName = (file: string): string => file.split(/[\\/]/).pop() ?? '';

const extensionOf = (file: string): string => {
    const name = baseName(file);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/**
 * Output file of the favicon: the bundled SVG, or the custom file as
 * `favicon.<its extension>`. The copy step and the page `<head>` both read it.
 */
export const faviconImage = (customFavicon: string | undefined): FaviconImage => {
    if (!customFavicon) {
        return { file: DEFAULT_FAVICON, type: FAVICON_TYPES.svg };
    }
    const extension = extensionOf(customFavicon);
    return {
        file: extension ? `favicon.${extension}` : 'favicon',
        type: FAVICON_TYPES[extension]
    };
};

/** Output file of the custom logo: its own file name. */
export const logoImage = (customLogo: string): string => baseName(customLogo);

/** Values of the `logoLayout` option. */
export const LOGO_LAYOUTS = ['auto', 'icon', 'wordmark'] as const;
export type LogoLayoutSetting = (typeof LOGO_LAYOUTS)[number];
export const isLogoLayoutSetting = (value: unknown): value is LogoLayoutSetting =>
    (LOGO_LAYOUTS as readonly unknown[]).includes(value);
/** How the sidebar header shows the custom logo. */
export type LogoLayout = Exclude<LogoLayoutSetting, 'auto'>;

/** Width / height from which `logoLayout: 'auto'` treats a logo as a wordmark. */
export const WORDMARK_MIN_RATIO = 2;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const positive = (value: number): number | undefined =>
    Number.isFinite(value) && value > 0 ? value : undefined;

/** A plain or `px` length attribute of the root `<svg>`; percentages and other units are unknown. */
const svgLength = (tag: string, name: string): number | undefined => {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`));
    return match ? positive(Number(match[1])) : undefined;
};

const svgAspect = (text: string): number | undefined => {
    const tag = text.match(/<svg\b[^>]*>/i)?.[0];
    if (!tag) {
        return undefined;
    }
    const viewBox = tag.match(/\sviewBox\s*=\s*["']([^"']*)["']/)?.[1];
    const box = viewBox
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
    if (box?.length === 4) {
        const width = positive(box[2]);
        const height = positive(box[3]);
        if (width && height) {
            return width / height;
        }
    }
    const width = svgLength(tag, 'width');
    const height = svgLength(tag, 'height');
    return width && height ? width / height : undefined;
};

const pngAspect = (bytes: Uint8Array): number | undefined => {
    if (bytes.length < 24 || PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte)) {
        return undefined;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = positive(view.getUint32(16));
    const height = positive(view.getUint32(20));
    return width && height ? width / height : undefined;
};

/**
 * Width / height of a logo file: the SVG `viewBox` (else its `width` and
 * `height`), the PNG header. Undefined for other formats and unreadable files.
 */
export const logoAspect = (bytes: Uint8Array, file: string): number | undefined => {
    switch (extensionOf(file)) {
        case 'svg':
            return svgAspect(new TextDecoder().decode(bytes));
        case 'png':
            return pngAspect(bytes);
        default:
            return undefined;
    }
};

/**
 * The layout of the sidebar logo: the configured one, or for `auto` the
 * aspect ratio (wordmark from {@link WORDMARK_MIN_RATIO}, wordmark when unknown).
 */
export const logoLayoutFor = (
    setting: LogoLayoutSetting,
    aspect: number | undefined
): LogoLayout => {
    if (setting !== 'auto') {
        return setting;
    }
    return aspect === undefined || aspect >= WORDMARK_MIN_RATIO ? 'wordmark' : 'icon';
};
