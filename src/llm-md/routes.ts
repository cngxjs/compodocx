/**
 * Routes section of the llm-md export: one block per router or unmounted
 * route array, then the routes as nested list items. `data` is left out;
 * providers are named, guards and resolvers keep their source text.
 */

import type {
    ExportRoute,
    ExportRouteRef,
    ExportRouteRoot,
    ExportRouteTarget
} from '../app/interfaces/export-data.interface';

const GUARD_KEYS = [
    'canActivate',
    'canActivateChild',
    'canDeactivate',
    'canMatch',
    'canLoad'
] as const;

const inline = (text: string): string => text.replace(/\s+/g, ' ').trim();

const refText = (ref: ExportRouteRef): string => inline(ref.source);

const valueText = (value: string | ExportRouteRef): string =>
    typeof value === 'string' ? value : `\`${refText(value)}\``;

const targetText = (target: ExportRouteTarget): string => {
    const lazy = target.lazy ? ' (lazy)' : '';
    if (target.kind === 'external') {
        return `\`${target.specifier}\` ${target.name}${lazy}`;
    }
    if (target.kind === 'unresolved') {
        return `\`${inline(target.source)}\`${lazy}`;
    }
    return `${target.name}${lazy}`;
};

const routeLine = (route: ExportRoute): string => {
    const targets: string[] = [];
    if (route.component) {
        targets.push(targetText(route.component));
    }
    if (route.loadChildren) {
        targets.push(`children of ${targetText(route.loadChildren)}`);
    }
    if (route.builtBy) {
        targets.push(`built by \`${refText(route.builtBy)}\``);
    }
    if (route.redirectTo !== undefined) {
        targets.push(`redirect ${valueText(route.redirectTo)}`);
    }
    const parts = [`\`${route.fullPath}\``];
    if (targets.length > 0) {
        parts.push(`-> ${targets.join(', ')}`);
    }
    if (route.outlet) {
        parts.push(`outlet: ${route.outlet}`);
    }
    for (const key of GUARD_KEYS) {
        const refs = route[key];
        if (refs?.length) {
            parts.push(`${key}: ${refs.map(r => `\`${refText(r)}\``).join(', ')}`);
        }
    }
    if (route.resolve) {
        const entries = Object.entries(route.resolve).map(([k, r]) => `${k} \`${refText(r)}\``);
        parts.push(`resolve: ${entries.join(', ')}`);
    }
    if (route.title !== undefined) {
        parts.push(`title: ${valueText(route.title)}`);
    }
    if (route.providers?.length) {
        parts.push(`providers: ${route.providers.map(p => p.name || refText(p)).join(', ')}`);
    }
    return parts.join(' ');
};

const routeLines = (routes: readonly ExportRoute[], depth: number): string[] =>
    routes.flatMap(route => [
        `${'  '.repeat(depth)}- ${routeLine(route)}`,
        ...routeLines(route.children ?? [], depth + 1)
    ]);

const rootHeading = (root: ExportRouteRoot): string => {
    if (root.kind === 'unmounted') {
        return `### Unmounted routes${root.array ? ` (${root.array})` : ''}`;
    }
    const where = [...new Set((root.bootstraps ?? []).map(b => b.file))];
    const parts = [...where, ...(root.config ? [root.config] : [])];
    return `### Router${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
};

/** The routes of every root as nested lists; '' without routes. */
export const emitRoutes = (roots: ReadonlyArray<ExportRouteRoot>): string =>
    roots
        .map(root => {
            const lines = [rootHeading(root), ''];
            if (root.features?.length) {
                lines.push(
                    `Router features: ${root.features.map(f => `\`${refText(f)}\``).join(', ')}`,
                    ''
                );
            }
            lines.push(...routeLines(root.routes, 0));
            return lines.join('\n');
        })
        .join('\n\n');
