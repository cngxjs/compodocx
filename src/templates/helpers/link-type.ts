import DependenciesEngine from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText, isUtilityKind } from '../../app/links/layout';
import { targetOfData } from '../../app/links/resolve';
import BasicTypeUtil from '../../utils/basic-type.util';
import ExtendsMerger from '../../utils/extends-merger.util';

export type ResolvedType = {
    readonly raw: string;
    readonly href: string;
    readonly target: string;
    readonly indexKey: string;
};

/**
 * Resolve a type name to a link target.
 * Returns null if the type is unknown (render as plain code).
 * `depth` is the directory depth of the page the link is rendered on.
 */
export const resolveType = (name: string, indexKey?: string, depth = 1): ResolvedType | null => {
    let result = DependenciesEngine.find(name);
    if (!result) {
        const alias = ExtendsMerger.findInAliases(name);
        if (alias) {
            result = DependenciesEngine.find(alias);
        }
    }

    if (result) {
        const resolved: ResolvedType = { raw: name, indexKey: '', href: '', target: '_self' };

        if (result.source === 'internal') {
            const target = targetOfData(result.data);
            if (!target) {
                return null;
            }
            const anchor =
                target.type === 'symbol' && isUtilityKind(target.kind) ? undefined : indexKey;
            const href = hrefText(hrefFor(target, depth, anchor || undefined));
            return { ...resolved, href, indexKey: anchor ?? '' };
        }

        return {
            ...resolved,
            href: `https://angular.dev/${result.data.path}`,
            target: '_blank'
        };
    }

    if (BasicTypeUtil.isKnownType(name)) {
        return {
            raw: name,
            href: BasicTypeUtil.getTypeUrl(name),
            target: '_blank',
            indexKey: ''
        };
    }

    return null;
};

/** Render a type as an HTML link string (or plain code if unresolvable). */
export const linkTypeHtml = (
    name: string,
    options?: { withLine?: boolean; line?: number; indexKey?: string; depth?: number }
): string => {
    const resolved = resolveType(name, options?.indexKey, options?.depth);
    if (!resolved) {
        return `<code>${name}</code>`;
    }

    if (options?.withLine && options.line) {
        const sourceHref = resolved.href.includes('#') ? resolved.href : `${resolved.href}#source`;
        return `<code><a href="${sourceHref}" target="${resolved.target}" >${resolved.raw}:${options.line}</a></code>`;
    }

    const suffix = resolved.indexKey ? `['${resolved.indexKey}']` : '';
    return `<code><a href="${resolved.href}" target="${resolved.target}" >${resolved.raw}${suffix}</a></code>`;
};
