import { detectAiGeneratedMarker } from '../../utils/ai-generated.util';
import { logger } from '../../utils/logger';
import MarkdownEngine from '../engines/markdown.engine';

/** Page fields derived from the neighbour README of a symbol. */
export type NeighbourReadmeFields = {
    /**
     * The `<!-- @aiGenerated [value] -->` marker of the README, when it has one.
     * Not `readmeAiGenerated`: page data is laid over the main data, whose
     * `readmeAiGenerated` is the marker of the root README.
     */
    readonly symbolReadmeAiGenerated?: string | true;
};

/**
 * Reads the README next to a symbol's file (`foo.component.md` beside
 * `foo.component.ts`) into `entity.readme` as HTML and returns the page
 * fields of its raw Markdown: the `@aiGenerated` marker is only visible
 * before the Markdown is rendered. Returns `{}` without a README.
 */
export const attachNeighbourReadme = (entity: {
    readonly name?: string;
    readonly file?: string;
    readme?: string;
}): NeighbourReadmeFields => {
    if (!entity.file || !MarkdownEngine.hasNeighbourReadmeFile(entity.file)) {
        return {};
    }
    logger.info(` ${entity.name} has a README file, include it`);
    const markdown = MarkdownEngine.readNeighbourReadmeFile(entity.file);
    entity.readme = MarkdownEngine.render(markdown);
    const marker = detectAiGeneratedMarker(markdown);
    return marker === false ? {} : { symbolReadmeAiGenerated: marker };
};
