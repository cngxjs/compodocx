import Configuration from '../../app/configuration';
import DependenciesEngine from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText } from '../../app/links/layout';
import { placeTarget, targetOfData } from '../../app/links/resolve';
import BasicTypeUtil from '../../utils/basic-type.util';
import { escapeHtmlText } from './escape';

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

function resolveTypeLink(typeName: string, depth: number): string | null {
    const result = DependenciesEngine.find(typeName);
    if (result) {
        if (result.source === 'internal') {
            const href = buildHrefForInternalType(result.data, depth);
            if (href === null) {
                return null;
            }
            return `<a href="${href}" target="_self">${escapeHtmlText(typeName)}</a>`;
        }
        return `<a href="https://angular.dev/${result.data.path}" target="_blank">${escapeHtmlText(typeName)}</a>`;
    }
    //TODO: go awai from mdn
    if (BasicTypeUtil.isKnownType(typeName)) {
        const url = BasicTypeUtil.getTypeUrl(typeName);
        return `<a href="${url}" target="_blank">${escapeHtmlText(typeName)}</a>`;
    }
    return null;
}

function getOptionalString(arg: { readonly optional?: boolean }): string {
    return arg.optional ? '?' : '';
}

function handleFunction(arg: SignatureArg, depth: number): string {
    if (arg.function.length === 0) {
        return `${arg.name}${getOptionalString(arg)}: () => void`;
    }
    const argums = arg.function.map(argu => {
        const link = resolveTypeLink(argu.type, depth);
        if (link) {
            return `${argu.name}${getOptionalString(arg)}: ${link}`;
        }
        if (argu.name && argu.type) {
            return `${argu.name}${getOptionalString(arg)}: ${argu.type}`;
        }
        return (argu.name as { readonly text?: string })?.text ?? '';
    });
    return `${arg.name}${getOptionalString(arg)}: (${argums.join(', ')}) => void`;
}

/**
 * Render a method's full signature as HTML string with type links.
 * `depth` is the directory depth of the page the signature is rendered on.
 */
export const functionSignature = (method: SignatureSource, depth: number): string => {
    let args = '';
    let destructuredCounterInitial = 0;
    let destructuredCounterReal = 0;

    if (method.args) {
        method.args.forEach(arg => {
            if (arg.destructuredParameter) {
                destructuredCounterInitial += 1;
            }
        });

        method.args.forEach((arg, index) => {
            if (arg.destructuredParameter) {
                if (destructuredCounterReal === 0) {
                    args += '__namedParameters: {';
                }
                destructuredCounterReal += 1;
            }

            const link = resolveTypeLink(arg.type, depth);
            if (link) {
                const rest = arg.dotDotDotToken ? '...' : '';
                args += `${rest}${arg.name}${getOptionalString(arg)}: ${link}`;
            } else if (arg.dotDotDotToken) {
                args += `...${arg.name}: ${arg.type}`;
            } else if (arg.function) {
                args += handleFunction(arg, depth);
            } else if (arg.type) {
                args += `${arg.name}${getOptionalString(arg)}: ${arg.type}`;
            } else {
                args += `${arg.name}${getOptionalString(arg)}`;
            }

            if (
                arg.destructuredParameter &&
                destructuredCounterReal === destructuredCounterInitial
            ) {
                args += '}';
            }
            if (index < method.args.length - 1) {
                args += ', ';
            }
        });
    }

    return method.name ? `${method.name}(${args})` : `(${args})`;
};
