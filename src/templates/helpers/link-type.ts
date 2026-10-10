import Configuration from '../../app/configuration';
import DependenciesEngine from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText, isUtilityKind, type PageKind } from '../../app/links/layout';
import { placeTarget, targetOfData } from '../../app/links/resolve';
import BasicTypeUtil from '../../utils/basic-type.util';
import ExtendsMerger from '../../utils/extends-merger.util';

export type ResolvedType = {
    readonly raw: string;
    readonly href: string;
    readonly target: string;
    readonly indexKey: string;
    /** The kind of the page an internal type links to (`provider` for a DI page). */
    readonly kind?: PageKind;
};

/**
 * Resolve a type name to a link target.
 * Returns null if the type is unknown (render as plain code).
 * `depth` is the directory depth of the page the link is rendered on.
 */
export const resolveType = (
    name: string,
    indexKey: string | undefined,
    depth: number
): ResolvedType | null => {
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
            const link = placeTarget(
                target,
                result.data,
                Configuration.mainData,
                anchor || undefined
            );
            if (!link) {
                return null;
            }
            const href = hrefText(hrefFor(link.target, depth, link.anchor));
            const kind = link.target.type === 'symbol' ? link.target.kind : 'provider';
            // `indexKey` is the indexed access shown next to the name, not the section anchor.
            return { ...resolved, href, indexKey: anchor ?? '', kind };
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
    options: { depth: number; withLine?: boolean; line?: number; indexKey?: string }
): string => {
    const resolved = resolveType(name, options.indexKey, options.depth);
    if (!resolved) {
        return `<code>${name}</code>`;
    }

    if (options.withLine && options.line) {
        const sourceHref = resolved.href.includes('#') ? resolved.href : `${resolved.href}#source`;
        return `<code><a href="${sourceHref}" target="${resolved.target}" >${resolved.raw}:${options.line}</a></code>`;
    }

    const suffix = resolved.indexKey ? `['${resolved.indexKey}']` : '';
    return `<code><a href="${resolved.href}" target="${resolved.target}" >${resolved.raw}${suffix}</a></code>`;
};
