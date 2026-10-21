import * as crypto from 'node:crypto';

import { err, isErr, ok, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import { cleanNameWithoutSpaceAndToLowerCase } from '../../utils/utils';

const MAX_DEPTH = 5;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export interface LabelEntry {
    readonly label?: string;
    readonly title?: string;
}

export type LabelMap = Readonly<Record<string, LabelEntry>>;

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
    readonly label?: unknown;
    readonly heading?: unknown;
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
    label: string,
    heading: boolean,
    file: string,
    segments: readonly string[],
    explicitSlug: boolean,
    childrenLength: number
): ResolvedAdditionalPage => ({
    nodePath,
    file,
    segments,
    title,
    label,
    heading,
    aliases: [],
    domId: explicitSlug ? segments.join('/') : domIdOf(title, file),
    depth: segments.length,
    childrenLength
});

interface LabelContext {
    readonly labels: LabelMap;
    readonly matches: Map<string, Claim[]>;
    /** Keys that gave a node without a file its title. */
    readonly used: Set<string>;
}

const labelEntryOf = (context: LabelContext, slug: string): LabelEntry | undefined =>
    Object.hasOwn(context.labels, slug) ? context.labels[slug] : undefined;

const claimKey = (segments: readonly string[]): string =>
    segments.join('/').normalize('NFC').toLowerCase();

const invalidSlugMessage = (slug: unknown, nodePath: string, file: unknown): string =>
    `Additional pages: invalid slug "${String(slug)}" at summary.json${nodePath} (${String(file)}); expected one segment matching ${SLUG_PATTERN.source}`;

const noTitleMessage = (nodePath: string, file: unknown): string =>
    `Additional pages: no title for summary.json${nodePath} (${String(file)}); set "title" on the node or in the labels file`;

const collisionMessage = (segments: readonly string[], first: Claim, second: Claim): string =>
    `Additional pages: "${segments.join('/')}.html" is claimed by summary.json${first.nodePath} (${first.file}) and summary.json${second.nodePath} (${second.file})`;

export const labelsFileMessage = (source: string, reason: string): string =>
    `Additional pages: labels file ${source}: ${reason}`;

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
    claims: Map<string, Claim>,
    context: LabelContext
): Result<void, string> => {
    for (const [index, node] of nodes.entries()) {
        if (!isSummaryNode(node)) {
            continue;
        }
        const nodePath = `${parentPath}[${index}]`;
        const explicitSlug = node.slug !== undefined;
        const hasTitle = typeof node.title === 'string';
        if (!hasTitle && !explicitSlug) {
            continue;
        }
        if (explicitSlug && !(typeof node.slug === 'string' && SLUG_PATTERN.test(node.slug))) {
            return err(invalidSlugMessage(node.slug, nodePath, node.file));
        }
        const entry = typeof node.slug === 'string' ? labelEntryOf(context, node.slug) : undefined;
        const title = hasTitle ? node.title : entry?.title;
        if (typeof title !== 'string') {
            return err(noTitleMessage(nodePath, node.file));
        }
        if (!hasTitle && typeof node.slug === 'string') {
            context.used.add(node.slug);
        }
        if (explicitSlug) {
            warnParentWithoutSlug(nodePath, parent);
        }
        const slug =
            typeof node.slug === 'string'
                ? node.slug
                : cleanNameWithoutSpaceAndToLowerCase(String(node.title));
        const derivedEntry = explicitSlug ? entry : labelEntryOf(context, slug);
        const labelFromFile = derivedEntry?.label;
        const label = typeof node.label === 'string' ? node.label : (labelFromFile ?? title);
        const heading = node.heading === true;
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
            const matched = context.matches.get(slug) ?? [];
            matched.push({ nodePath, file });
            context.matches.set(slug, matched);
            resolved.push(
                resolvePage(
                    nodePath,
                    title,
                    label,
                    heading,
                    file,
                    segments,
                    explicitSlug,
                    children.length
                )
            );
        }
        const nested = visit(
            children,
            `${nodePath}.children`,
            segments,
            { nodePath, hasSlug: explicitSlug },
            resolved,
            claims,
            context
        );
        if (isErr(nested)) {
            return nested;
        }
    }
    return ok(undefined);
};

const checkLabelKeys = (context: LabelContext, source: string): Result<void, string> => {
    for (const [key, matched] of context.matches) {
        if (matched.length > 1 && Object.hasOwn(context.labels, key)) {
            const list = matched.map(m => `summary.json${m.nodePath} (${m.file})`).join(', ');
            return err(labelsFileMessage(source, `key "${key}" matches several pages: ${list}`));
        }
    }
    for (const key of Object.keys(context.labels)) {
        if (!context.matches.has(key) && !context.used.has(key)) {
            logger.warn(`Additional pages: labels file ${source}: key "${key}" matches no page`);
        }
    }
    return ok(undefined);
};

/**
 * Resolves the nodes of a parsed summary.json into a flat list of pages in
 * document order (each node before its children). Nodes with neither title
 * nor slug are skipped together with their children, a node with a slug but
 * no title (on the node or in the labels file) aborts the resolution; the
 * title is the node's `title`, else the labels file title of its slug, and
 * the label is the node's `label`, else the labels file label, else the
 * title; the derived slug always comes from the node's own `title`. A labels
 * file key is the effective slug (last segment): a key matching several
 * pages aborts the resolution, a key matching no page logs a warning.
 * `heading` is true only for the boolean `true`; an explicit `slug` replaces the
 * node's own segment and must match the slug pattern; two pages whose paths
 * are equal after NFC normalization and lower-casing abort the resolution;
 * nodes without a file are not pages but still contribute their segment to
 * their children's path. The summary is either an array of nodes or an
 * object whose `children` array holds them; that root object is not a page
 * itself. `labelsSource` names the labels file in messages.
 */
export const resolveAdditionalPages = (
    summary: unknown,
    labels: LabelMap = {},
    labelsSource = ''
): Result<readonly ResolvedAdditionalPage[], string> => {
    const resolved: ResolvedAdditionalPage[] = [];
    const claims = new Map<string, Claim>();
    const context: LabelContext = { labels, matches: new Map(), used: new Set() };
    let visited: Result<void, string> = ok(undefined);
    if (Array.isArray(summary)) {
        visited = visit(summary, '', [], undefined, resolved, claims, context);
    } else if (isSummaryNode(summary)) {
        visited = visit(childrenOf(summary), '.children', [], undefined, resolved, claims, context);
    }
    if (isErr(visited)) {
        return visited;
    }
    const checked = checkLabelKeys(context, labelsSource);
    return isErr(checked) ? checked : ok(resolved);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === 'string';

/**
 * Parses the content of a labels file: an object whose values are objects
 * with an optional string `label` and an optional string `title`. Other
 * properties of an entry are ignored.
 */
export const parseLabelMap = (raw: string, source: string): Result<LabelMap, string> => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return err(labelsFileMessage(source, `invalid JSON (${reason})`));
    }
    if (!isRecord(parsed)) {
        return err(labelsFileMessage(source, 'expected an object keyed by slug'));
    }
    const entries: [string, LabelEntry][] = [];
    for (const [key, value] of Object.entries(parsed)) {
        if (!isRecord(value)) {
            return err(labelsFileMessage(source, `entry "${key}" is not an object`));
        }
        const { label, title } = value;
        if (!isOptionalString(label)) {
            return err(labelsFileMessage(source, `entry "${key}": "label" must be a string`));
        }
        if (!isOptionalString(title)) {
            return err(labelsFileMessage(source, `entry "${key}": "title" must be a string`));
        }
        entries.push([key, { label, title }]);
    }
    return ok(Object.fromEntries(entries));
};
