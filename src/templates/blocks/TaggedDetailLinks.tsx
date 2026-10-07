import Html from '@kitajs/html';
import { pageFile } from '../../app/links/layout';
import { t } from '../helpers';

interface TaggedItem {
    readonly name: string;
    readonly category?: string;
}

interface TaggedDetailLinksProps {
    readonly items: readonly TaggedItem[];
    readonly plural: 'functions' | 'variables' | 'typealiases' | 'enumerations';
}

/** Renders an "Open detail page" link for each `@category`-tagged miscellaneous
 * entry in a collection. Untagged entries are skipped so they continue to
 * render as inline anchors below. */
export const TaggedDetailLinks = (props: TaggedDetailLinksProps): string => {
    const tagged = props.items.filter(
        item => typeof item.category === 'string' && item.category.trim() !== ''
    );
    if (tagged.length === 0) {
        return '';
    }
    return (
        <ul class="cdx-tagged-detail-links">
            {tagged.map(item => (
                <li>
                    <a
                        href={pageFile(props.plural, item.name)}
                        data-cdx-tagged-detail-link
                        aria-label={`${t('open-detail-page')}: ${item.name}`}
                    >
                        <code>{item.name}</code>
                        <span class="cdx-tagged-detail-links__hint">{t('open-detail-page')}</span>
                    </a>
                </li>
            ))}
        </ul>
    ) as string;
};
