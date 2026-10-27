import { createHash } from 'node:crypto';

/** Output path (from the site root) of the shared sidebar script. */
export const MENU_SCRIPT = 'js/menu.js';

/** Output path (from the site root) of the shared entity index script. */
export const ENTITIES_SCRIPT = 'js/entities.js';

/** First 8 hex chars of the sha256 of a file's content, the `?v=` cache key of its script tag. */
export const contentVersion = (content: string): string =>
    createHash('sha256').update(content).digest('hex').slice(0, 8);

/**
 * The shared sidebar script: a classic script loaded right after the sidebar
 * `<nav>`, so the menu is in the DOM before the client binds its handlers.
 */
export const menuScript = (menuHtml: string): string =>
    `document.getElementById('sidebar').insertAdjacentHTML('beforeend', ${JSON.stringify(menuHtml)});\n`;

/** The shared entity index script the command palette reads (`window.__CDX_ENTITIES__`). */
export const entitiesScript = (index: unknown): string =>
    `window.__CDX_ENTITIES__=${JSON.stringify(index)};`;

/** Output path (from the site root) of the dependency graph data, loaded when the graph shows. */
export const GRAPH_SCRIPT = 'js/graph.js';

/** The dependency graph data script (`window.__CDX_GRAPH__`). */
export const graphScript = (graph: unknown): string =>
    `window.__CDX_GRAPH__=${JSON.stringify(graph)};\n`;
