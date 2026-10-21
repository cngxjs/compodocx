import * as crypto from 'node:crypto';

import { err, isErr, ok, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import { cleanNameWithoutSpaceAndToLowerCase } from '../../utils/utils';

const MAX_DEPTH = 5;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

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
    readonly slug?: unknown;
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

interface ParentNode {
    readonly nodePath: string;
    readonly hasSlug: boolean;
}

interface Claim {
    readonly nodePath: string;
    readonly file: string;
}

const resolvePage = (
    nodePath: string,
    title: string,
    file: string,
    segments: readonly string[],
    explicitSlug: boolean,
    childrenLength: number
): ResolvedAdditionalPage => ({
    nodePath,
    file,
    segments,
    title,
    label: title,
    heading: false,
    aliases: [],
    domId: explicitSlug ? segments.join('/') : domIdOf(title, file),
    depth: segments.length,
    childrenLength
});

const claimKey = (segments: readonly string[]): string =>
    segments.join('/').normalize('NFC').toLowerCase();

const invalidSlugMessage = (slug: unknown, nodePath: string, file: unknown): string =>
    `Additional pages: invalid slug "${String(slug)}" at summary.json${nodePath} (${String(file)}); expected one segment matching ${SLUG_PATTERN.source}`;

const collisionMessage = (segments: readonly string[], first: Claim, second: Claim): string =>
    `Additional pages: "${segments.join('/')}.html" is claimed by summary.json${first.nodePath} (${first.file}) and summary.json${second.nodePath} (${second.file})`;

const warnParentWithoutSlug = (nodePath: string, parent: ParentNode | undefined): void => {
    if (parent === undefined || parent.hasSlug) {
        return;
    }
    logger.warn(
        `Additional pages: summary.json${nodePath} has a slug but its parent summary.json${parent.nodePath} has none; renaming the parent moves this page`
    );
};

const visit = (
    nodes: readonly unknown[],
    parentPath: string,
    parentSegments: readonly string[],
    parent: ParentNode | undefined,
    resolved: ResolvedAdditionalPage[],
    claims: Map<string, Claim>
): Result<void, string> => {
    for (const [index, node] of nodes.entries()) {
        if (!isSummaryNode(node) || typeof node.title !== 'string') {
            continue;
        }
        const nodePath = `${parentPath}[${index}]`;
        const explicitSlug = node.slug !== undefined;
        if (explicitSlug && !(typeof node.slug === 'string' && SLUG_PATTERN.test(node.slug))) {
            return err(invalidSlugMessage(node.slug, nodePath, node.file));
        }
        if (explicitSlug) {
            warnParentWithoutSlug(nodePath, parent);
        }
        const slug =
            typeof node.slug === 'string'
                ? node.slug
                : cleanNameWithoutSpaceAndToLowerCase(node.title);
        const segments = [...parentSegments, slug];
        const children = childrenOf(node);
        const file = node.file;
        const tooDeep = segments.length > MAX_DEPTH;

        if (typeof file === 'string' && tooDeep) {
            logger.error('Only 5 levels of depth are supported');
        }
        if (typeof file === 'string' && !tooDeep) {
            const key = claimKey(segments);
            const claimed = claims.get(key);
            if (claimed !== undefined) {
                return err(collisionMessage(segments, claimed, { nodePath, file }));
            }
            claims.set(key, { nodePath, file });
            resolved.push(
                resolvePage(nodePath, node.title, file, segments, explicitSlug, children.length)
            );
        }
        const nested = visit(
            children,
            `${nodePath}.children`,
            segments,
            { nodePath, hasSlug: explicitSlug },
            resolved,
            claims
        );
        if (isErr(nested)) {
            return nested;
        }
    }
    return ok(undefined);
};

/**
 * Resolves the nodes of a parsed summary.json into a flat list of pages in
 * document order (each node before its children). Nodes without a title are
 * skipped together with their children; an explicit `slug` replaces the
 * node's own segment and must match the slug pattern; two pages whose paths
 * are equal after NFC normalization and lower-casing abort the resolution;
 * nodes without a file are not pages but still contribute their segment to
 * their children's path. The summary
 * is either an array of nodes or an object whose `children` array holds them;
 * that root object is not a page itself.
 */
export const resolveAdditionalPages = (
    summary: unknown
): Result<readonly ResolvedAdditionalPage[], string> => {
    const resolved: ResolvedAdditionalPage[] = [];
    const claims = new Map<string, Claim>();
    if (Array.isArray(summary)) {
        const visited = visit(summary, '', [], undefined, resolved, claims);
        return isErr(visited) ? visited : ok(resolved);
    }
    if (isSummaryNode(summary)) {
        const visited = visit(childrenOf(summary), '.children', [], undefined, resolved, claims);
        return isErr(visited) ? visited : ok(resolved);
    }
    return ok(resolved);
};
