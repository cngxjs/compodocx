import Configuration from '../../app/configuration';
import DependenciesEngine from '../../app/engines/dependencies.engine';

const escapeHtml = (str: string): string =>
    String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

import { hrefFor, hrefText } from '../../app/links/layout';
import { placeTarget, targetOfData } from '../../app/links/resolve';
import BasicTypeUtil from '../../utils/basic-type.util';

// TODO: Refactor this helper to be more modular and testable, and to handle more complex type scenarios (e.g., generics, unions, intersections).
/** Link from a page at `depth` to the page of an engine object, or null without one. */
function buildHrefForInternalType(data: any, depth: number): string | null {
    const target = targetOfData(data);
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
            return `<a href="${href}" target="_self">${escapeHtml(typeName)}</a>`;
        }
        return `<a href="https://angular.dev/${result.data.path}" target="_blank">${escapeHtml(typeName)}</a>`;
    }
    //TODO: go awai from mdn
    if (BasicTypeUtil.isKnownType(typeName)) {
        const url = BasicTypeUtil.getTypeUrl(typeName);
        return `<a href="${url}" target="_blank">${escapeHtml(typeName)}</a>`;
    }
    return null;
}

function getOptionalString(arg: any): string {
    return arg.optional ? '?' : '';
}

function handleFunction(arg: any, depth: number): string {
    if (arg.function.length === 0) {
        return `${arg.name}${getOptionalString(arg)}: () => void`;
    }
    const argums = arg.function.map((argu: any) => {
        const link = resolveTypeLink(argu.type, depth);
        if (link) {
            return `${argu.name}${getOptionalString(arg)}: ${link}`;
        }
        if (argu.name && argu.type) {
            return `${argu.name}${getOptionalString(arg)}: ${argu.type}`;
        }
        return argu.name?.text ?? '';
    });
    return `${arg.name}${getOptionalString(arg)}: (${argums.join(', ')}) => void`;
}

/**
 * Render a method's full signature as HTML string with type links.
 * `depth` is the directory depth of the page the signature is rendered on.
 */
export const functionSignature = (method: any, depth = 1): string => {
    let args = '';
    let destructuredCounterInitial = 0;
    let destructuredCounterReal = 0;

    if (method.args) {
        method.args.forEach((arg: any) => {
            if (arg.destructuredParameter) {
                destructuredCounterInitial += 1;
            }
        });

        method.args.forEach((arg: any, index: number) => {
            if (arg.destructuredParameter) {
                if (destructuredCounterReal === 0) {
                    args += '__namedParameters: {';
                }
                destructuredCounterReal += 1;
            }

            const link = resolveTypeLink(arg.type, depth);
            if (link) {
                args += `${arg.name}${getOptionalString(arg)}: ${link}`;
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
