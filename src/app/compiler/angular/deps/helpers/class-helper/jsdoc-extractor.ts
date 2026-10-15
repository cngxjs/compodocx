import type { ts } from 'ts-morph';
import {
    extractJsdocPlaygroundBlocks,
    extractJsdocPlaygroundConfig
} from '../../../../../../templates/helpers/jsdoc';
import { JsdocParserUtil } from '../../../../../../utils/jsdoc-parser.util';
import { logger } from '../../../../../../utils/logger';
import { markedAcl } from '../../../../../../utils/marked.acl';
import { markedtags } from '../../../../../../utils/utils';
import { JsdocTags } from '../../../../angular-dependencies/jsdoc-tags';

export class JsdocExtractor {
    private readonly jsdocParserUtil = new JsdocParserUtil();
    private readonly jsdocTags = new JsdocTags(this.jsdocParserUtil);

    public checkForDeprecation(tags: any[], result: { [key in string | number]: any }) {
        this.jsdocTags.checkForDeprecation(tags, result);
    }

    /**
     * Process JSDoc tags and apply them to a result object
     */
    public processJSDocTags(jsdoctags: any, result: any, includeTagsArray: boolean = true): void {
        if (jsdoctags && jsdoctags.length >= 1) {
            const jsdoc = jsdoctags[0];
            if (jsdoc?.tags) {
                const tags = jsdoc.tags as unknown as any[];
                this.checkForDeprecation(tags, result);
                this.collectPlaygroundBlocks(tags, result);
                if (includeTagsArray) {
                    result.jsdoctags = markedtags(tags);
                }
            }
        }
    }

    public collectPlaygroundBlocks(tags: any[], result: { [key: string]: any }): void {
        const { blocks, warnings } = extractJsdocPlaygroundBlocks(tags);
        if (blocks.length > 0) {
            result.playgrounds = blocks;
        }
        for (const w of warnings) {
            logger.warn(w);
        }

        // Component-level `@playgroundConfig <path>` - ships an app.config.ts
        // into every playground project. Only meaningful alongside blocks.
        const { configRef, warnings: configWarnings } = extractJsdocPlaygroundConfig(tags);
        for (const w of configWarnings) {
            logger.warn(w);
        }
        if (configRef) {
            if (blocks.length > 0) {
                result.playgroundConfig = configRef;
            } else {
                logger.warn(
                    `@playgroundConfig "${configRef}" ignored: no @playground blocks on this entity`
                );
            }
        }
    }

    /**
     * Extract and process JSDoc comment for a node
     */
    public extractAndProcessJSDocComment(node: any, sourceFile: ts.SourceFile, result: any): void {
        if (node.jsDoc) {
            const comment = this.jsdocParserUtil.getMainCommentOfNode(node, sourceFile);
            if (typeof comment !== 'undefined') {
                const cleanedDescription = this.jsdocParserUtil.parseComment(comment);
                result.rawdescription = cleanedDescription;
                result.description = markedAcl(cleanedDescription);
            }
        }
    }
}
