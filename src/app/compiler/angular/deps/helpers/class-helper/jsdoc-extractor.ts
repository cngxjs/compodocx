import type { ts } from 'ts-morph';
import {
    extractJsdocPlaygroundBlocks,
    extractJsdocPlaygroundConfig
} from '../../../../../../templates/helpers/jsdoc';
import { JsdocParserUtil } from '../../../../../../utils/jsdoc-parser.util';
import { warnOnce } from '../../../../../../utils/jsdoc-tag-warn';
import { logger } from '../../../../../../utils/logger';
import { markedAcl } from '../../../../../../utils/marked.acl';
import { markedtags } from '../../../../../../utils/utils';

export class JsdocExtractor {
    private readonly jsdocParserUtil = new JsdocParserUtil();

    public checkForDeprecation(tags: any[], result: { [key in string | number]: any }) {
        tags.forEach(tag => {
            if (tag.tagName?.text) {
                if (tag.tagName.text.indexOf('deprecated') > -1) {
                    result.deprecated = true;
                    // tag.comment becomes a NodeArray (not a string) when the
                    // JSDoc has an inline {@link X}; parseJSDocNode flattens both shapes.
                    result.deprecationMessage = this.jsdocParserUtil.parseJSDocNode(tag) || '';
                }
                if (tag.tagName.text === 'wcag') {
                    const raw = (this.jsdocParserUtil.parseJSDocNode(tag) || '').trim();
                    const value = raw.split('\n')[0].trim().toUpperCase();
                    if (value === 'A' || value === 'AA' || value === 'AAA') {
                        result.wcagLevel = value;
                    } else if (value) {
                        warnOnce(
                            result,
                            'wcag:invalid',
                            `Invalid @wcag level "${value}" — expected one of A, AA, AAA. Ignoring.`
                        );
                    }
                }
                if (tag.tagName.text === 'a11y') {
                    const raw = (this.jsdocParserUtil.parseJSDocNode(tag) || '').trim();
                    if (raw) {
                        result.a11yNote = raw;
                    }
                }
            }
        });
        this.extractCustomTags(tags, result);
    }

    public extractCustomTags(tags: any[], result: { [key in string | number]: any }) {
        for (const tag of tags) {
            if (!tag.tagName?.text) {
                continue;
            }
            const name = tag.tagName.text;
            const rawComment = tag.comment;
            const comment = (
                typeof rawComment === 'string'
                    ? rawComment
                    : Array.isArray(rawComment)
                      ? rawComment.map((c: any) => c.text || '').join('')
                      : ''
            ).trim();

            switch (name) {
                case 'signal':
                    result.signal = true;
                    break;
                case 'zoneless':
                    result.zoneless = true;
                    break;
                case 'beta':
                    result.beta = true;
                    break;
                case 'group':
                    result.group = comment.split('\n')[0].trim();
                    break;
                case 'order':
                    result.order = Number.parseInt(comment, 10) || 0;
                    break;
                case 'since':
                    result.since = comment.split('\n')[0].trim();
                    break;
                case 'breaking':
                    result.breaking = comment.split('\n')[0].trim();
                    break;
                case 'aiGenerated':
                    result.aiGenerated = comment.split('\n')[0].trim() || true;
                    break;
                case 'route':
                    result.route = comment.split('\n')[0].trim();
                    break;
                case 'storybook':
                    result.storybookUrl = comment.split('\n')[0].trim();
                    break;
                case 'figma':
                    result.figmaUrl = comment.split('\n')[0].trim();
                    break;
                case 'stackblitz':
                    result.stackblitzUrl = comment.split('\n')[0].trim();
                    break;
                case 'github': {
                    const url = comment.split('\n')[0].trim();
                    if (url.startsWith('https://github.com/')) {
                        result.githubUrl = url;
                    } else if (url) {
                        warnOnce(
                            result,
                            'github:invalid',
                            `Invalid @github URL "${url}" — must start with https://github.com/. Ignoring.`
                        );
                    }
                    break;
                }
                case 'docs':
                    result.docsUrl = comment.split('\n')[0].trim();
                    break;
                case 'selector':
                    result.taggedSelector = comment.split('\n')[0].trim();
                    break;
                case 'relatedTo': {
                    const symbols = comment
                        .split('\n')[0]
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);
                    if (symbols.length > 0) {
                        result.relatedTo = symbols;
                    }
                    break;
                }
                case 'slot': {
                    if (!result.slots) {
                        result.slots = [];
                    }
                    const parts = comment.match(/^(\S+)\s*-?\s*(.*)$/);
                    const slotName = parts ? parts[1] : comment;
                    const slotDesc = parts ? parts[2] || '' : '';
                    if (slotName && !result.slots.some((s: any) => s.name === slotName)) {
                        result.slots.push({
                            name: slotName,
                            description: slotDesc
                        });
                    }
                    break;
                }
            }
        }
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

        // Component-level `@playgroundConfig <path>` — ships an app.config.ts
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
