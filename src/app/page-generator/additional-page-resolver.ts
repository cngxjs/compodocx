import * as crypto from 'node:crypto';

import { ok, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import { cleanNameWithoutSpaceAndToLowerCase } from '../../utils/utils';

const MAX_DEPTH = 5;

export interface ResolvedAdditionalPage {
    readonly nodePath: string;
    readonly file: string;
    readonly segments: readonly string[];
    readonly title: string;
    readonly label: string;
    readonly heading: boolean;
    readonly aliases: readonly string[];
    readonly domId: string;
    readonly depth: number;
    readonly childrenLength: number;
}

interface SummaryNode {
    readonly title?: unknown;
    readonly file?: unknown;
    readonly children?: unknown;
}

const isSummaryNode = (value: unknown): value is SummaryNode =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const childrenOf = (node: SummaryNode): readonly unknown[] =>
    Array.isArray(node.children) ? node.children : [];

const domIdOf = (title: string, file: string): string =>
    crypto
        .createHash('sha512')
        .update(title + file)
        .digest('hex');

const resolvePage = (
    nodePath: string,
    title: string,
    file: string,
    segments: readonly string[],
    childrenLength: number
): ResolvedAdditionalPage => ({
    nodePath,
    file,
    segments,
    title,
    label: title,
    heading: false,
    aliases: [],
    domId: domIdOf(title, file),
    depth: segments.length,
    childrenLength
});

const visit = (
    nodes: readonly unknown[],
    parentPath: string,
    parentSegments: readonly string[],
    resolved: ResolvedAdditionalPage[]
): void => {
    for (const [index, node] of nodes.entries()) {
        if (!isSummaryNode(node) || typeof node.title !== 'string') {
            continue;
        }
        const nodePath = `${parentPath}[${index}]`;
        const segments = [...parentSegments, cleanNameWithoutSpaceAndToLowerCase(node.title)];
        const children = childrenOf(node);
        const file = node.file;
        const tooDeep = segments.length > MAX_DEPTH;

        if (typeof file === 'string' && tooDeep) {
            logger.error('Only 5 levels of depth are supported');
        }
        if (typeof file === 'string' && !tooDeep) {
            resolved.push(resolvePage(nodePath, node.title, file, segments, children.length));
        }
        visit(children, `${nodePath}.children`, segments, resolved);
    }
};

/**
 * Resolves the nodes of a parsed summary.json into a flat list of pages in
 * document order (each node before its children). Nodes without a title are
 * skipped together with their children; nodes without a file are not pages
 * but still contribute their segment to their children's path. The summary
 * is either an array of nodes or an object whose `children` array holds them;
 * that root object is not a page itself.
 */
export const resolveAdditionalPages = (
    summary: unknown
): Result<readonly ResolvedAdditionalPage[], string> => {
    const resolved: ResolvedAdditionalPage[] = [];
    if (Array.isArray(summary)) {
        visit(summary, '', [], resolved);
    } else if (isSummaryNode(summary)) {
        visit(childrenOf(summary), '.children', [], resolved);
    }
    return ok(resolved);
};
