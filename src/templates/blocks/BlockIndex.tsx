import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { memberAnchor } from '../../app/links/layout';
import { t } from '../helpers';

type IndexItem = {
    readonly name: string;
    readonly deprecated?: boolean;
    readonly optional?: boolean;
    readonly modifierKind?: number[];
};

type BlockIndexProps = {
    readonly properties?: IndexItem[];
    readonly methods?: IndexItem[];
    readonly inputs?: IndexItem[];
    readonly outputs?: IndexItem[];
    readonly derivedState?: IndexItem[];
    readonly effects?: IndexItem[];
    readonly hostBindings?: IndexItem[];
    readonly hostListeners?: IndexItem[];
    readonly accessors?: Record<string, any>;
    readonly indexSignatures?: IndexItem[];
};

type IndicatorKind =
    | 'property'
    | 'method'
    | 'input'
    | 'output'
    | 'derived'
    | 'effect'
    | 'accessor'
    | 'constructor'
    | 'hostbinding'
    | 'hostlistener'
    | 'indexsignature';

const INDICATOR_LETTERS: Record<IndicatorKind, string> = {
    property: 'P',
    method: 'M',
    input: 'I',
    output: 'O',
    derived: 'D',
    effect: 'E',
    accessor: 'A',
    constructor: 'C',
    hostbinding: 'H',
    hostlistener: 'L',
    indexsignature: 'S'
};

const IndexGroup = (props: { title: string; items: IndexItem[]; kind: IndicatorKind }): string => {
    if (!props.items?.length) {
        return '';
    }
    const letter = INDICATOR_LETTERS[props.kind];
    return (
        <div class="cdx-index-group">
            <h4 class="cdx-index-group-label">{t(props.title)}</h4>
            <div class="cdx-index-entries">
                {props.items.map(item => (
                    <a
                        href={`#${memberAnchor(item.name)}`}
                        class={`cdx-index-entry${item.deprecated ? ' cdx-index-entry--deprecated' : ''}`}
                    >
                        <span
                            class={`cdx-index-indicator cdx-index-indicator--${props.kind}`}
                            aria-hidden="true"
                        >
                            {letter}
                        </span>
                        <span class="cdx-index-name">{item.name}</span>
                    </a>
                ))}
            </div>
        </div>
    ) as string;
};

export const BlockIndex = (props: BlockIndexProps): string => {
    const custom = renderCustomTemplate('block-index', props);
    if (custom !== null) {
        return custom;
    }
    const accessorEntries = props.accessors ? Object.entries(props.accessors) : [];

    const hasContent =
        (props.properties?.length ?? 0) > 0 ||
        (props.methods?.length ?? 0) > 0 ||
        (props.inputs?.length ?? 0) > 0 ||
        (props.outputs?.length ?? 0) > 0 ||
        (props.derivedState?.length ?? 0) > 0 ||
        (props.effects?.length ?? 0) > 0 ||
        (props.hostBindings?.length ?? 0) > 0 ||
        (props.hostListeners?.length ?? 0) > 0 ||
        accessorEntries.length > 0 ||
        (props.indexSignatures?.length ?? 0) > 0;

    if (!hasContent) {
        return '';
    }

    return (
        <section class="cdx-content-section" data-compodoc="block-index">
            <h3 class="cdx-section-heading" id="index">
                {t('index')}
                <a class="cdx-member-permalink" href="#index">
                    #
                </a>
            </h3>
            <div class="cdx-index">
                {IndexGroup({
                    title: 'properties',
                    items: props.properties ?? [],
                    kind: 'property'
                })}
                {IndexGroup({ title: 'methods', items: props.methods ?? [], kind: 'method' })}
                {IndexGroup({ title: 'inputs', items: props.inputs ?? [], kind: 'input' })}
                {IndexGroup({ title: 'outputs', items: props.outputs ?? [], kind: 'output' })}
                {IndexGroup({
                    title: 'derived-state',
                    items: props.derivedState ?? [],
                    kind: 'derived'
                })}
                {IndexGroup({
                    title: 'effects',
                    items: props.effects ?? [],
                    kind: 'effect'
                })}
                {IndexGroup({
                    title: 'hostbindings',
                    items: props.hostBindings ?? [],
                    kind: 'hostbinding'
                })}
                {IndexGroup({
                    title: 'hostlisteners',
                    items: props.hostListeners ?? [],
                    kind: 'hostlistener'
                })}
                {IndexGroup({
                    title: 'index-signatures',
                    items: props.indexSignatures ?? [],
                    kind: 'indexsignature'
                })}
                {accessorEntries.length > 0 && (
                    <div class="cdx-index-group">
                        <h4 class="cdx-index-group-label">{t('accessors')}</h4>
                        <div class="cdx-index-entries">
                            {accessorEntries.map(([key, acc]) => {
                                const isDeprecated = !!(
                                    acc.getSignature?.deprecated || acc.setSignature?.deprecated
                                );
                                return (
                                    <a
                                        href={`#${memberAnchor(key)}`}
                                        class={`cdx-index-entry${isDeprecated ? ' cdx-index-entry--deprecated' : ''}`}
                                    >
                                        <span
                                            class="cdx-index-indicator cdx-index-indicator--accessor"
                                            aria-hidden="true"
                                        >
                                            A
                                        </span>
                                        <span class="cdx-index-name">{key}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </section>
    ) as string;
};
