import { createHash } from 'node:crypto';

/** Output path (from the site root) of the shared sidebar script. */
export const MENU_SCRIPT = 'js/menu.js';

/** First 8 hex chars of the sha256 of a file's content, the `?v=` cache key of its script tag. */
export const contentVersion = (content: string): string =>
    createHash('sha256').update(content).digest('hex').slice(0, 8);

/**
 * The shared sidebar script: a classic script loaded right after the sidebar
 * `<nav>`, so the menu is in the DOM before the client binds its handlers.
 */
export const menuScript = (menuHtml: string): string =>
    `document.getElementById('sidebar').insertAdjacentHTML('beforeend', ${JSON.stringify(menuHtml)});\n`;
