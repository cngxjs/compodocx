import Html from '@kitajs/html';
import { highlightCode } from '../../app/engines/syntax-highlight.engine';
import { CopyButton } from '../components/CodeBlock';
import { IconFileCss, IconFileHtml, IconFileTs } from '../components/Icons';
import { shortPath } from '../helpers/short-url';

/**
 * Source-code display for the Source / Template / Styles tabs.
 *
 * Renders a VS Code-style editor panel:
 *
 *   ┌─ cdx-source-viewer ──────────────────────────────────────┐
 *   │ 📄 path/to/file.ts  › ScopeSegment      [copy]          │ ← tab header (sticky)
 *   ├───────────────────────────────────────────────────────────┤
 *   │ [sticky-scroll-stack mount, client-injected when needed] │
 *   │                                                            │
 *   │  1  import { Component } from '@angular/core';            │ ← highlighted body
 *   │  2  ...                                                   │
 *   └───────────────────────────────────────────────────────────┘
 *
 * - Internal scroll container: `.cdx-source-viewer` has its own
 *   `max-height` + `overflow-y: auto`, so the sticky header and the
 *   sticky scroll stack pin to the TOP of the viewer panel rather than
 *   to the outer page scroll.
 * - Tab header: file icon chosen per language, file path on the left,
 *   copy button on the right. Scope indicator is populated by the
 *   sticky scroll stack client, not server-rendered.
 * - Body: Shiki-highlighted code with line numbers, member markers,
 *   and fold regions (all handled inside `highlightCode`).
 *
 * The header (and its copy button) is always there; without a `filePath`
 * or `label` (an inline template) its path stays empty.
 */
export type SourceViewerLang = 'typescript' | 'html' | 'scss';

type SourceViewerProps = {
    /** File path shown in the tab header. Use a literal string for
     *  synthetic sources like `Inline Styles`. */
    readonly filePath?: string;
    readonly sourceCode: string;
    readonly lang: SourceViewerLang;
    /** Optional custom label override for the header path span.
     *  Defaults to shortPath(filePath). */
    readonly label?: string;
};

const fileIconFor = (lang: SourceViewerLang): string => {
    if (lang === 'html') {
        return IconFileHtml();
    }
    if (lang === 'scss') {
        return IconFileCss();
    }
    return IconFileTs();
};

const langClass = (lang: SourceViewerLang): string => `cdx-source-viewer--${lang}`;

export const SourceViewer = (props: SourceViewerProps): string => {
    const displayLabel = props.label ?? (props.filePath ? shortPath(props.filePath) : '');

    return (
        <div class={`cdx-source-viewer ${langClass(props.lang)}`} data-cdx-lang={props.lang}>
            <div class="cdx-source-viewer-header">
                <span class="cdx-source-viewer-icon" aria-hidden="true">
                    {fileIconFor(props.lang)}
                </span>
                <span class="cdx-source-viewer-path">{displayLabel}</span>
                <span class="cdx-source-scope" aria-live="polite"></span>
                {CopyButton()}
            </div>
            <div class="cdx-source-viewer-sticky-stack" aria-hidden="true"></div>
            <div class="cdx-source-viewer-body">
                {highlightCode(props.sourceCode, { lang: props.lang, mode: 'source' })}
            </div>
        </div>
    ) as string;
};
