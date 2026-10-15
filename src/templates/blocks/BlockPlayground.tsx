import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import {
    type BuildOptions,
    buildPlaygroundManifest,
    type ConsumerPackageJson,
    type DepGraphNode,
    type DepGraphResolver,
    type FileRefBundle,
    type VendorPackage
} from '../../app/engines/stackblitz';
import { highlightCode } from '../../app/engines/syntax-highlight.engine';
import { logger } from '../../utils/logger';
import type { ComponentPlaygroundBlock } from '../helpers/jsdoc';

const slugifyId = (raw: string): string =>
    raw
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '');

export type BlockPlaygroundProps = {
    readonly componentName: string;
    /** Real on-disk path of the component file. Drives the manifest import. */
    readonly componentFile?: string;
    /** Full source of the component file. Inlined into the StackBlitz project. */
    readonly componentSourceCode?: string;
    readonly block: ComponentPlaygroundBlock;
    readonly index: number;
    readonly resolve?: DepGraphResolver;
    readonly workspacePackage?: ConsumerPackageJson;
    /** Config-file `playgroundDependencies` — wins over consumer-pkg auto-forward. */
    readonly extraDependencies?: Record<string, string>;
    /**
     * Config-file `playgroundMaterialShell` - forces the Material font links and
     * body classes into `index.html` without adding `@angular/material`.
     */
    readonly materialShell?: boolean;
    /** Config caps: `playgroundDepDepth` / `playgroundFileCountCap` / `playgroundFileCap`. */
    readonly depth?: number;
    readonly maxFiles?: number;
    readonly fileCap?: number;
    /** Config-file `playgroundHead` — extra `<head>` entries for `index.html`. */
    readonly head?: string[];
    /** Config-file `playgroundGlobalStyles` — CSS appended to `src/styles.css`. */
    readonly globalStyles?: string;
    /**
     * Vendor packages resolved from `playgroundVendor`, keyed by full package
     * name. When the playground imports a vendored package, the builder
     * embeds its closure as `file:` deps. Empty/undefined → registry-only.
     */
    readonly vendorPackages?: Record<string, VendorPackage>;
    /** Config-file `playgroundVendorCap` — backstop on the vendored closure. */
    readonly vendorCap?: number;
    /**
     * Pre-resolved file-ref bundle for `block.fileRef` blocks. Populated by
     * `application.ts:resolvePlaygroundFiles` and forwarded through
     * `PlaygroundContent`. Inline blocks pass `undefined`.
     */
    readonly fileBundle?: FileRefBundle;
};

const buildFallbackResolver =
    (componentName: string, file?: string, sourceCode?: string): DepGraphResolver =>
    (name: string): DepGraphNode | null =>
        name === componentName
            ? {
                  name,
                  file: file && file.length > 0 ? file : `src/app/${slugifyId(name)}.component.ts`,
                  sourceCode:
                      sourceCode && sourceCode.length > 0
                          ? sourceCode
                          : "// Source not available — open the component's Source tab on the doc page.",
                  imports: []
              }
            : null;

export function BlockPlayground(props: BlockPlaygroundProps): string {
    const overrideArgs = {
        componentName: props.componentName,
        block: props.block,
        index: props.index
    };
    const custom = renderCustomTemplate('block-playground', overrideArgs);
    if (custom !== null) {
        return custom;
    }

    const resolve =
        props.resolve ??
        buildFallbackResolver(props.componentName, props.componentFile, props.componentSourceCode);
    const options: BuildOptions = {};
    if (props.extraDependencies) {
        options.extraDependencies = props.extraDependencies;
    }
    if (props.materialShell) {
        options.materialShell = true;
    }
    if (typeof props.depth === 'number') {
        options.depth = props.depth;
    }
    if (typeof props.maxFiles === 'number') {
        options.maxFiles = props.maxFiles;
    }
    if (typeof props.fileCap === 'number') {
        options.fileCap = props.fileCap;
    }
    if (props.head && props.head.length > 0) {
        options.head = props.head;
    }
    if (props.globalStyles && props.globalStyles.length > 0) {
        options.globalStyles = props.globalStyles;
    }
    if (props.vendorPackages && Object.keys(props.vendorPackages).length > 0) {
        options.vendor = { packages: props.vendorPackages };
        if (typeof props.vendorCap === 'number') {
            options.vendor.totalCap = props.vendorCap;
        }
    }
    const built = buildPlaygroundManifest(
        props.componentName,
        props.block,
        resolve,
        props.workspacePackage,
        Object.keys(options).length > 0 ? options : undefined,
        props.fileBundle
    );

    const blockId = `playground-${slugifyId(props.componentName)}-${props.index}`;
    const titleId = `${blockId}-title`;

    if (!built.ok) {
        logger.warn(
            `Playground "${props.block.title}" on ${props.componentName} could not be assembled: ${built.message}`
        );
        return (
            <section
                class="cdx-content-section"
                data-compodoc="block-playground"
                data-cdx-playground-status="failed"
            >
                <h3 class="cdx-section-heading" id={titleId}>
                    {props.block.title}
                </h3>
                <p class="cdx-playground-fallback">
                    {`Project assembly failed for "${props.block.title}". Open the component's Source tab to view the snippet directly.`}
                </p>
            </section>
        ) as string;
    }

    const manifest = built.value;
    // Pick a snippet to render in the page preview:
    //  - inline mode → block.snippet/language
    //  - html-mode fileBundle → fileBundle.htmlSnippet (rendered as html)
    //  - ts-mode fileBundle → the entry source itself (rendered as typescript)
    const previewSnippet =
        props.block.snippet ??
        props.fileBundle?.htmlSnippet ??
        props.fileBundle?.files['src/app/app.component.ts'] ??
        '';
    const previewLang =
        props.block.language ??
        (props.fileBundle?.htmlSnippet !== undefined ? 'html' : 'typescript');
    const highlighted = highlightCode(previewSnippet, {
        lang: previewLang,
        mode: 'snippet'
    });
    // Robust JSON encoding for inline `<script type="application/json">` payloads.
    // We can't trust naive `replaceAll('</', '<\\/')` — under specific
    // HTML-parser conditions (notably with very long script bodies that contain
    // angle brackets or unicode line separators) the body is mis-tokenised and
    // JSON.parse on the client trips over an "unterminated string". The
    // canonical hardening (used by React/Next.js for hydration) escapes every
    // potentially-disruptive char as `\uXXXX` — JSON.parse decodes them back.
    const manifestJson = JSON.stringify(manifest).replace(
        /[<>&\u2028\u2029]/g,
        c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
    );

    // Raw <script> tag bypasses kitajs/html child-escaping. Entities inside
    // <script> are not decoded by the HTML5 parser, so escaping the JSON would
    // break JSON.parse on the client side.
    const manifestScript =
        `<script type="application/json" data-cdx-stackblitz-manifest-data="${blockId}">` +
        `${manifestJson}</script>`;
    const escapedTitle = Html.escapeHtml(props.block.title) as string;

    // StackBlitz brand glyph (lightning bolt). Inline SVG so it inherits the
    // button's `currentColor` and ships zero extra requests.
    const stackblitzIcon =
        '<svg viewBox="0 0 28 28" fill="currentColor" aria-hidden="true">' +
        '<path d="M11.65 16.85H5.62l11.13-13.4-2.4 10.7h6.03L9.25 27.55l2.4-10.7Z" />' +
        '</svg>';

    return (
        `<section class="cdx-content-section" data-compodoc="block-playground" id="${blockId}">` +
        `<h3 class="cdx-section-heading" id="${titleId}">${escapedTitle}</h3>` +
        `<div class="cdx-playground-snippet">${highlighted}</div>` +
        `<button type="button" class="cdx-playground-launch" data-cdx-stackblitz-manifest="${blockId}" aria-describedby="${titleId}">` +
        `${stackblitzIcon}<span>Open in StackBlitz</span>` +
        `</button>` +
        manifestScript +
        `</section>`
    );
}
