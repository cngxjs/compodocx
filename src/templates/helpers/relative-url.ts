import { relativePrefix } from '../../app/links/layout';

/**
 * Generate a relative URL prefix based on the current page depth.
 * Equivalent to the Handlebars {{relativeURL}} helper.
 */
export const relativeUrl = (depth: number, path: string = ''): string =>
    relativePrefix(depth) + path;
