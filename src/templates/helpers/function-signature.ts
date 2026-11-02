import Configuration from '../../app/configuration';
import DependenciesEngine from '../../app/engines/dependencies.engine';
import { highlightCode } from '../../app/engines/syntax-highlight.engine';
import { hrefFor, hrefText } from '../../app/links/layout';
import { placeTarget, targetOfData } from '../../app/links/resolve';
import BasicTypeUtil from '../../utils/basic-type.util';
import { escapeHtmlText } from './escape';
import { dropLeadingText, linkHighlightedTokens, type TextLink } from './linked-highlight';

/** One parameter of a function-typed argument (`arg.function`). */
type SignatureFunctionParam = {
    readonly name?: string | { readonly text?: string };
    readonly type?: string;
};

/** One argument of a rendered signature, as the fields this helper reads. */
type SignatureArg = {
    readonly name?: string;
    readonly type?: string;
    readonly optional?: boolean;
    readonly destructuredParameter?: boolean;
    readonly dotDotDotToken?: boolean;
    readonly function?: readonly SignatureFunctionParam[];
};

/** A method, accessor signature, constructor or function with its arguments. */
type SignatureSource = {
    readonly name?: string;
    readonly args?: readonly SignatureArg[];
};

// TODO: Refactor this helper to be more modular and testable, and to handle more complex type scenarios (e.g., generics, unions, intersections).
/** Link from a page at `depth` to the page of an engine object, or null without one. */
function buildHrefForInternalType(
    data: { readonly name?: unknown; readonly file?: unknown },
    depth: number
): string | null {
    const target = targetOfData(data, Configuration.mainData.symbols);
    const link = target && placeTarget(target, data, Configuration.mainData);
    return link ? hrefText(hrefFor(link.target, depth, link.anchor)) : null;
}

/** A type name in a signature that links to its page or reference. */
type TypeLink = { readonly text: string; readonly href: string; readonly target: string };

/** A piece of a signature: plain text or a linked type name. */
type Segment = string | TypeLink;

function resolveTypeLink(typeName: string, depth: number): TypeLink | null {
    const result = DependenciesEngine.find(typeName);
    if (result) {
        if (result.source === 'internal') {
            const href = buildHrefForInternalType(result.data, depth);
            if (href === null) {
                return null;
            }
            return { text: typeName, href, target: '_self' };
        }
        return {
            text: typeName,
            href: `https://angular.dev/${result.data.path}`,
            target: '_blank'
        };
    }
    //TODO: go awai from mdn
    if (BasicTypeUtil.isKnownType(typeName)) {
        return { text: typeName, href: BasicTypeUtil.getTypeUrl(typeName), target: '_blank' };
    }
    return null;
}

function getOptionalString(arg: { readonly optional?: boolean }): string {
    return arg.optional ? '?' : '';
}

function handleFunction(arg: SignatureArg, depth: number): Segment[] {
    if (arg.function.length === 0) {
        return [`${arg.name}${getOptionalString(arg)}: () => void`];
    }
    const argums = arg.function.map((argu, i): Segment[] => {
        const separator = i > 0 ? ', ' : '';
        const link = resolveTypeLink(argu.type, depth);
        if (link) {
            return [`${separator}${argu.name}${getOptionalString(arg)}: `, link];
        }
        if (argu.name && argu.type) {
            return [`${separator}${argu.name}${getOptionalString(arg)}: ${argu.type}`];
        }
        return [`${separator}${(argu.name as { readonly text?: string })?.text ?? ''}`];
    });
    return [`${arg.name}${getOptionalString(arg)}: (`, ...argums.flat(), ') => void'];
}

function argSegments(arg: SignatureArg, depth: number): Segment[] {
    const link = resolveTypeLink(arg.type, depth);
    if (link) {
        const rest = arg.dotDotDotToken ? '...' : '';
        return [`${rest}${arg.name}${getOptionalString(arg)}: `, link];
    }
    if (arg.dotDotDotToken) {
        return [`...${arg.name}: ${arg.type}`];
    }
    if (arg.function) {
        return handleFunction(arg, depth);
    }
    if (arg.type) {
        return [`${arg.name}${getOptionalString(arg)}: ${arg.type}`];
    }
    return [`${arg.name}${getOptionalString(arg)}`];
}

/** The signature as plain text and linked type names, in order. */
function signatureSegments(method: SignatureSource, depth: number): Segment[] {
    const args = method.args ?? [];
    const destructuredCount = args.filter(arg => arg.destructuredParameter).length;
    let destructuredSeen = 0;

    const argParts = args.flatMap((arg, index): Segment[] => {
        const parts: Segment[] = [];
        if (arg.destructuredParameter) {
            if (destructuredSeen === 0) {
                parts.push('__namedParameters: {');
            }
            destructuredSeen += 1;
        }
        parts.push(...argSegments(arg, depth));
        if (arg.destructuredParameter && destructuredSeen === destructuredCount) {
            parts.push('}');
        }
        if (index < args.length - 1) {
            parts.push(', ');
        }
        return parts;
    });

    return [`${method.name ?? ''}(`, ...argParts, ')'];
}

const linkHtml = (link: TypeLink): string =>
    `<a href="${link.href}" target="${link.target}">${escapeHtmlText(link.text)}</a>`;

/**
 * Render a method's full signature as HTML string with type links.
 * `depth` is the directory depth of the page the signature is rendered on.
 */
export const functionSignature = (method: SignatureSource, depth: number): string =>
    signatureSegments(method, depth)
        .map(segment => (typeof segment === 'string' ? segment : linkHtml(segment)))
        .join('');

/**
 * Shiki reads a bare `name(args)` as one expression and leaves the
 * parameters uncoloured; as a function declaration it sees names and types.
 */
const GRAMMAR_PREFIX = 'function ';

/**
 * The signature syntax-highlighted by Shiki with the type links kept: Shiki
 * colours the plain text, the links are laid over its tokens afterwards.
 * Falls back to `functionSignature` while no highlighter is initialised.
 */
export const highlightedSignature = (method: SignatureSource, depth: number): string => {
    const segments = signatureSegments(method, depth);
    let offset = GRAMMAR_PREFIX.length;
    const links: TextLink[] = [];
    const text = segments
        .map(segment => {
            const piece = typeof segment === 'string' ? segment : segment.text;
            if (typeof segment !== 'string') {
                links.push({
                    start: offset,
                    end: offset + piece.length,
                    href: segment.href,
                    target: segment.target
                });
            }
            offset += piece.length;
            return piece;
        })
        .join('');
    const highlighted = highlightCode(`${GRAMMAR_PREFIX}${text}`, { mode: 'snippet' });
    const inner = /<code>([\s\S]*?)<\/code>/.exec(highlighted);
    if (!inner) {
        return functionSignature(method, depth);
    }
    return dropLeadingText(linkHighlightedTokens(inner[1], links), GRAMMAR_PREFIX.length);
};
