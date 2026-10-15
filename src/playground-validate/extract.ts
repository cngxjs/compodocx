import type { PlaygroundManifest } from '../app/engines/stackblitz';

/**
 * Extract the embedded StackBlitz manifests from generated documentation.
 *
 * Every `@playground` block ships its project file map inside a
 * `<script type="application/json" data-cdx-stackblitz-manifest-data="…">`
 * tag (see `BlockPlayground.tsx`). `playground:validate` reads those back out
 * of the produced HTML and compiles each one - validating exactly the
 * artifact that ships, decoupled from the generation pipeline.
 *
 * The JSON body escapes `<`/`>`/`&`/U+2028/U+2029 as `\uXXXX`, so a literal
 * `</script>` can never appear inside it; a non-greedy match to the first
 * `</script>` is therefore safe. `JSON.parse` decodes the `\u` escapes.
 */

export interface ExtractedManifest {
    /** The per-block manifest id (`playground-<slug>-<index>`). */
    id: string;
    /** Documentation file the manifest was read from, for reporting. */
    sourceFile?: string;
    manifest: PlaygroundManifest;
}

const MANIFEST_SCRIPT_RE =
    /<script type="application\/json" data-cdx-stackblitz-manifest-data="([^"]+)">([\s\S]*?)<\/script>/g;

/** Pull every manifest out of one HTML document. Malformed JSON is skipped. */
export function extractManifestsFromHtml(html: string, sourceFile?: string): ExtractedManifest[] {
    if (typeof html !== 'string' || html.length === 0) {
        return [];
    }
    const out: ExtractedManifest[] = [];
    MANIFEST_SCRIPT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MANIFEST_SCRIPT_RE.exec(html)) !== null) {
        const id = match[1];
        try {
            const manifest = JSON.parse(match[2]) as PlaygroundManifest;
            if (manifest && typeof manifest === 'object' && manifest.files) {
                out.push({ id, sourceFile, manifest });
            }
        } catch {
            // A manifest that won't even parse is itself a defect, but it is
            // caught by the existing client-side JSON tests - skip here.
        }
    }
    return out;
}
