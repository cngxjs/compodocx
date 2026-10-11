import Html from '@kitajs/html';
import {
    IconArrowLeft,
    IconArrowRight,
    IconClass,
    IconComponent,
    IconDirective,
    IconEntity,
    IconExternalLink,
    IconGuard,
    IconInjectable,
    IconInterceptor,
    IconInterface,
    IconModule,
    IconPipe
} from '../components/Icons';
import { t } from '../helpers';
import { resolveType } from '../helpers/link-type';

type RelationshipNode = {
    readonly name: string;
    readonly type: string;
    readonly description?: string;
    readonly subtype?: string;
};

type BlockRelationshipGraphProps = {
    readonly incoming: RelationshipNode[];
    readonly outgoing: RelationshipNode[];
    readonly entityName: string;
    readonly depth: number;
};

/** Normalise the compodoc entity type to the CSS token used by --color-cdx-entity-*. */
const normaliseType = (type: string): string => {
    const t = (type || '').toLowerCase();
    if (t === 'injectable' || t === 'service') {
        return 'service';
    }
    if (t.endsWith('s')) {
        return t.slice(0, -1);
    }
    return t;
};

/** Map an entity type to its Lucide-ish icon. */
const iconFor = (type: string): string => {
    switch (normaliseType(type)) {
        case 'component':
            return IconComponent();
        case 'directive':
            return IconDirective();
        case 'pipe':
            return IconPipe();
        case 'module':
            return IconModule();
        case 'class':
            return IconClass();
        case 'interface':
            return IconInterface();
        case 'guard':
            return IconGuard();
        case 'interceptor':
            return IconInterceptor();
        case 'service':
            return IconInjectable();
        case 'entity':
            return IconEntity();
        default:
            return IconClass();
    }
};

/** Resolve an entity name to its generated docs URL, falling back to '#'. */
const linkFor = (name: string, depth: number): { href: string; target: string } => {
    const resolved = resolveType(name, undefined, depth);
    if (resolved) {
        return { href: resolved.href, target: resolved.target };
    }
    return { href: '#', target: '_self' };
};

/** Row rendered inside the "Used By" container — tall, description-friendly. */
const IncomingRow = (node: RelationshipNode, depth: number): string => {
    const kind = normaliseType(node.type);
    const link = linkFor(node.name, depth);
    const label = node.subtype ?? kind;
    return (
        <a
            href={link.href}
            target={link.target}
            class={`cdx-rel-row cdx-rel-row--incoming cdx-rel-row--${kind}`}
            title={node.description || node.name}
        >
            <div class="cdx-rel-row-body">
                <span class="cdx-rel-row-label">{label}</span>
                <span class="cdx-rel-row-name">{node.name}</span>
                {node.description && <span class="cdx-rel-row-desc">{node.description}</span>}
            </div>
            <span class="cdx-rel-row-indicator" aria-hidden="true">
                {IconExternalLink()}
            </span>
        </a>
    ) as string;
};

/** Row rendered inside the "Depends On" container — icon box + name + subtype. */
const OutgoingRow = (node: RelationshipNode, depth: number): string => {
    const kind = normaliseType(node.type);
    const link = linkFor(node.name, depth);
    const label = node.subtype ?? kind;
    return (
        <a
            href={link.href}
            target={link.target}
            class={`cdx-rel-row cdx-rel-row--outgoing cdx-rel-row--${kind}`}
            title={node.description || node.name}
        >
            <span class="cdx-rel-row-icon" aria-hidden="true">
                {iconFor(node.type)}
            </span>
            <div class="cdx-rel-row-body">
                <span class="cdx-rel-row-name">{node.name}</span>
                <span class="cdx-rel-row-label">{label}</span>
            </div>
        </a>
    ) as string;
};

const RelationshipColumn = (props: {
    kind: 'incoming' | 'outgoing';
    title: string;
    items: RelationshipNode[];
    depth: number;
    icon: string;
}): string => {
    if (!props.items?.length) {
        return '';
    }
    return (
        <div class={`cdx-rel-column cdx-rel-column--${props.kind}`}>
            <h4 class="cdx-rel-column-title">
                <span class="cdx-rel-column-icon" aria-hidden="true">
                    {props.icon}
                </span>
                <span class="cdx-rel-column-label">{props.title}</span>
                <span class="cdx-rel-column-count">{props.items.length}</span>
            </h4>
            <div class={`cdx-rel-list cdx-rel-list--${props.kind}`}>
                {props.items.map(n =>
                    props.kind === 'incoming'
                        ? IncomingRow(n, props.depth)
                        : OutgoingRow(n, props.depth)
                )}
            </div>
        </div>
    ) as string;
};

export const BlockRelationshipGraph = (props: BlockRelationshipGraphProps): string => {
    if (!props.incoming?.length && !props.outgoing?.length) {
        return '';
    }

    return (
        <section class="cdx-content-section" data-compodoc="block-relationships">
            <h3 class="cdx-section-heading">{t('relationships') || 'Relationships'}</h3>
            <div class="cdx-relationships">
                {RelationshipColumn({
                    kind: 'incoming',
                    title: t('relationships-used-by') || 'Used by',
                    icon: IconArrowLeft(),
                    items: props.incoming,
                    depth: props.depth
                })}
                {RelationshipColumn({
                    kind: 'outgoing',
                    title: t('relationships-depends-on') || 'Depends on',
                    icon: IconArrowRight(),
                    items: props.outgoing,
                    depth: props.depth
                })}
            </div>
        </section>
    ) as string;
};
