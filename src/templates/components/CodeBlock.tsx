import Html from '@kitajs/html';
import { t } from '../helpers/i18n';
import { IconCopied, IconCopy } from './Icons';

/**
 * Code blocks: one wrapper for every copyable snippet, one copy button.
 *
 * Renderers (markdown fences, theming examples and sources, playground
 * previews, long values) emit only the wrapper `div.cdx-code-snippet` via
 * {@link codeSnippet}; that markup also reaches the JSON and llm-md exports.
 * The page writer adds the toolbar (label + {@link CopyButton}) to HTML pages
 * with {@link withCodeToolbars}, so the exports never carry buttons. The
 * source viewer renders the same button in its own header. The client binds
 * every `[data-cdx-copy]` button; nothing is injected by selector.
 */

/** Display names of fence languages; anything else is shown as written. */
const LANGUAGE_NAMES: Record<string, string> = {
    typescript: 'TypeScript',
    ts: 'TypeScript',
    javascript: 'JavaScript',
    js: 'JavaScript',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    bash: 'Shell',
    sh: 'Shell',
    shell: 'Shell',
    zsh: 'Shell',
    console: 'Shell',
    markdown: 'Markdown',
    md: 'Markdown',
    yaml: 'YAML',
    yml: 'YAML',
    diff: 'Diff'
};

export const languageName = (lang: string): string => LANGUAGE_NAMES[lang.toLowerCase()] ?? lang;

/**
 * Escapes an attribute value including `>`, which `Html.escapeHtml` keeps:
 * {@link withCodeToolbars} reads the opening tag up to the first `>`.
 */
const escapeAttr = (value: string): string =>
    (Html.escapeHtml(value) as string).replaceAll('>', '&gt;');

type SnippetOptions = {
    /** Fence language; shown in the toolbar under its display name. */
    readonly lang?: string;
    /** Toolbar label instead of the language, e.g. a file name. */
    readonly label?: string;
    /** Extra class for the context (`cdx-theming-example`, ...). */
    readonly className?: string;
};

/** The wrapper of a copyable code block around highlighted HTML. */
export const codeSnippet = (html: string, options: SnippetOptions = {}): string => {
    const cls = options.className ? ` ${options.className}` : '';
    const lang = options.lang ? ` data-cdx-lang="${escapeAttr(options.lang)}"` : '';
    const label = options.label ? ` data-cdx-label="${escapeAttr(options.label)}"` : '';
    return `<div class="cdx-code-snippet${cls}"${lang}${label}>${html}</div>`;
};

/**
 * The copy button. Its texts come from the page language; the client swaps
 * in `data-cdx-copied` / `data-cdx-failed` and sets `data-cdx-state`.
 */
export const CopyButton = (): string =>
    (
        <button
            type="button"
            class="cdx-copy"
            data-cdx-copy=""
            data-cdx-copied={t('copied')}
            data-cdx-failed={t('copy-failed')}
        >
            <span class="cdx-copy-icon" aria-hidden="true">
                <span class="cdx-copy-icon-idle">{IconCopy()}</span>
                <span class="cdx-copy-icon-done">{IconCopied()}</span>
            </span>
            <span class="cdx-copy-text">{t('copy')}</span>
        </button>
    ) as string;

const SNIPPET_OPEN = /<div class="cdx-code-snippet([^"]*)"([^>]*)>/g;
const ATTR = /\sdata-cdx-(lang|label)="([^"]*)"/g;

/**
 * Adds the toolbar to every code block wrapper of a rendered HTML page: the
 * label (or the language's name) on the left, the copy button on the right.
 * Wrappers that already carry one are left alone.
 */
export const withCodeToolbars = (html: string): string => {
    if (!html.includes('cdx-code-snippet')) {
        return html;
    }
    const button = CopyButton();
    return html.replace(SNIPPET_OPEN, (open: string, classes: string, attrs: string) => {
        if (classes.split(' ').includes('cdx-code-block')) {
            return open;
        }
        const found = Object.fromEntries(
            [...attrs.matchAll(ATTR)].map(([, key, value]) => [key, value])
        );
        // Attribute values are escaped already, so they go into the text as is.
        const label = found.label ?? (found.lang ? languageName(found.lang) : '');
        return (
            `<div class="cdx-code-snippet cdx-code-block${classes}"${attrs}>` +
            `<div class="cdx-code-bar"><span class="cdx-code-label">${label}</span>${button}</div>`
        );
    });
};
