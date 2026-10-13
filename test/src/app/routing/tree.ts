import type {
    RouteNode,
    RouteRef,
    RouteTarget,
    RouteValue,
    RoutingModel
} from '../../../../src/app/routing';
import { GUARD_KEYS } from '../../../../src/app/routing';

const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();
const ref = (r: RouteRef): string => flat(r.source);
const isRef = (v: RouteValue | RouteRef): v is RouteRef => 'call' in v;

const target = (t: RouteTarget | undefined, children: boolean): string => {
    if (!t) {
        return '';
    }
    const lazy = t.lazy ? ' (lazy)' : '';
    const pre = children ? 'children ' : '';
    if (t.kind === 'symbol' || t.kind === 'routes') {
        return `${pre}${t.name}${lazy}`;
    }
    if (t.kind === 'external') {
        return `${pre}external ${t.specifier}#${t.name}${lazy}`;
    }
    return `${pre}unresolved {${flat(t.source)}}${lazy}`;
};

const valueText = (v: RouteValue | RouteRef): string =>
    isRef(v) ? `{${ref(v)}}` : v.kind === 'literal' ? v.text : `{${flat(v.source)}}`;

const line = (r: RouteNode): string => {
    const targets = [target(r.component, false), target(r.childrenFrom, true)].filter(Boolean);
    if (r.builtBy) {
        targets.push(`built by {${ref(r.builtBy)}}`);
    }
    if (r.redirectTo) {
        targets.push(`redirect ${valueText(r.redirectTo)}`);
    }
    const parts = [r.fullPath, '->', targets.join(' + ') || '(none)'];
    if (r.pathMatch) {
        parts.push(`pathMatch=${r.pathMatch}`);
    }
    if (r.outlet) {
        parts.push(`outlet=${r.outlet}`);
    }
    if (r.matcher) {
        parts.push(`matcher={${ref(r.matcher)}}`);
    }
    for (const key of GUARD_KEYS) {
        if (r.guards[key].length) {
            parts.push(`${key}=[${r.guards[key].map(ref).join(', ')}]`);
        }
    }
    if (r.resolve.length) {
        parts.push(`resolve={${r.resolve.map(e => `${e.key}: ${ref(e.ref)}`).join(', ')}}`);
    }
    if (r.title) {
        parts.push(`title=${valueText(r.title)}`);
    }
    if (r.providers.length) {
        parts.push(`providers=[${r.providers.map(ref).join(', ')}]`);
    }
    if (r.data !== undefined) {
        parts.push(`data={${flat(r.data)}}`);
    }
    if (r.runGuardsAndResolvers !== undefined) {
        parts.push(`runGuardsAndResolvers={${flat(r.runGuardsAndResolvers)}}`);
    }
    return parts.join(' ');
};

/** The model as an indented text tree (the format of the expected trees). */
export const routeTree = (model: RoutingModel): string => {
    const out: string[] = [];
    const walk = (nodes: readonly RouteNode[], depth: number): void => {
        for (const node of nodes) {
            out.push('  '.repeat(depth) + line(node));
            walk(node.children, depth + 1);
        }
    };
    for (const root of model.roots) {
        const head: string[] = [root.kind];
        for (const b of root.bootstraps) {
            head.push(`bootstrap=${b.file}${b.componentName ? `(${b.componentName})` : ''}`);
        }
        if (root.configName) {
            head.push(`config=${root.configName}`);
        }
        if (root.arrayName) {
            head.push(`array=${root.arrayName}`);
        }
        if (root.features.length) {
            head.push(`features=[${root.features.map(ref).join(', ')}]`);
        }
        out.push(head.join(' '));
        walk(root.routes, 1);
    }
    return out.join('\n');
};
