import Html from '@kitajs/html';
import { linkTypeHtml, parseDescription, t } from '../helpers';

/** Parse inject() modifiers from the defaultValue string. */
const parseInjectModifiers = (defaultValue: string): string[] => {
    const mods: string[] = [];
    if (!defaultValue) {
        return mods;
    }
    if (/optional\s*:\s*true/.test(defaultValue)) {
        mods.push('optional');
    }
    if (/skipSelf\s*:\s*true/.test(defaultValue)) {
        mods.push('skipSelf');
    }
    if (/self\s*:\s*true/.test(defaultValue)) {
        mods.push('self');
    }
    if (/host\s*:\s*true/.test(defaultValue)) {
        mods.push('host');
    }
    return mods;
};

type DependencySource = 'inject' | 'inject-async' | 'constructor';

const BADGE: Readonly<Record<DependencySource, { modifier: string; label: string }>> = {
    inject: { modifier: 'inject', label: 'inject()' },
    'inject-async': { modifier: 'inject-async', label: 'injectAsync()' },
    constructor: { modifier: 'constructor-di', label: 'constructor' }
};

/** Whether a member is an `inject()` or `injectAsync()` field, listed under Dependencies. */
export const isDependencyMember = (p: any): boolean =>
    p.signalKind === 'inject' || p.signalKind === 'inject-async';

/** Dependencies section merging inject()/injectAsync() properties and constructor params. */
export const DependenciesSection = (props: {
    injectProps: any[];
    constructorArgs: any[];
    constructorDescription?: string;
    depth: number;
}): string => {
    const items: Array<{
        name: string;
        type: string;
        source: DependencySource;
        modifiers: string[];
        description?: string;
    }> = [];

    for (const p of props.injectProps) {
        items.push({
            name: p.name,
            type: p.type ?? '',
            source: p.signalKind === 'inject-async' ? 'inject-async' : 'inject',
            modifiers: parseInjectModifiers(p.defaultValue ?? ''),
            description: p.description
        });
    }

    for (const arg of props.constructorArgs) {
        items.push({
            name: arg.name,
            type: arg.type ?? '',
            source: 'constructor',
            modifiers: arg.optional ? ['optional'] : [],
            description: arg.description
        });
    }

    if (items.length === 0) {
        return '';
    }

    return (
        <section class="cdx-content-section" data-compodoc="block-dependencies">
            <h3 class="cdx-section-heading" id="section-dependencies">
                {t('dependencies')}
                <a class="cdx-member-permalink" href="#section-dependencies">
                    #
                </a>
            </h3>
            {props.constructorDescription && (
                <div class="cdx-deps-constructor-desc">
                    {parseDescription(props.constructorDescription, props.depth)}
                </div>
            )}
            <div class="cdx-deps-list">
                {items.map(item => (
                    <div class="cdx-deps-item">
                        <span class="cdx-deps-name">
                            {item.type
                                ? linkTypeHtml(item.type, { depth: props.depth })
                                : item.name}
                        </span>
                        <span class="cdx-deps-badges">
                            <span class={`cdx-badge cdx-badge--${BADGE[item.source].modifier}`}>
                                {BADGE[item.source].label}
                            </span>
                            {item.modifiers.map(mod => (
                                <span class="cdx-member-modifier">{mod}</span>
                            ))}
                        </span>
                        {item.source !== 'constructor' && item.name && (
                            <span class="cdx-deps-alias">{item.name}</span>
                        )}
                        {item.description && (
                            <div class="cdx-deps-desc">
                                {parseDescription(item.description, props.depth)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    ) as string;
};
