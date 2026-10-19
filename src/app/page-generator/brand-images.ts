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
