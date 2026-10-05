import DependenciesEngine from '../../app/engines/dependencies.engine';
import BasicTypeUtil from '../../utils/basic-type.util';
import ExtendsMerger from '../../utils/extends-merger.util';
import { relativeUrl } from './relative-url';

export type ResolvedType = {
    readonly raw: string;
    readonly href: string;
    readonly target: string;
    readonly indexKey: string;
};

const miscSubtypeToPage: Record<string, string> = {
    enum: 'enumerations',
    function: 'functions',
    typealias: 'typealiases',
    variable: 'variables'
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
            const data = result.data;
            if (data.type === 'miscellaneous' || (data.ctype && data.ctype === 'miscellaneous')) {
                const page = miscSubtypeToPage[data.subtype] ?? '';
                let href = relativeUrl(depth, `${data.ctype || data.type}/${page}.html`);
                if (data.name) {
                    href += `#${data.name}`;
                }
                return { ...resolved, href };
            }

            const typePath = data.type === 'class' ? 'classe' : data.type;
            let href = relativeUrl(depth, `${typePath}s/${data.name}.html`);
            if (indexKey) {
                href += `#${indexKey}`;
            }
            return { ...resolved, href, indexKey: indexKey ?? '' };
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
        return `<code><a href="${resolved.href}#source" target="${resolved.target}" >${resolved.raw}:${options.line}</a></code>`;
    }

    const suffix = resolved.indexKey ? `['${resolved.indexKey}']` : '';
    return `<code><a href="${resolved.href}" target="${resolved.target}" >${resolved.raw}${suffix}</a></code>`;
};
