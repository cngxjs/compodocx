import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { hrefFor, hrefText, type MiscKind } from '../../app/links/layout';
import { entryInFile } from '../../app/links/symbol-table';
import { t } from '../helpers';

interface TaggedItem {
    readonly name: string;
    readonly file?: string;
}

interface TaggedDetailLinksProps {
    readonly items: readonly TaggedItem[];
    readonly kind: MiscKind;
    /** Depth of the collection page the links are rendered on. */
    readonly depth: number;
}

/** Renders an "Open detail page" link for each entry of a collection. */
export const TaggedDetailLinks = (props: TaggedDetailLinksProps): string => {
    if (props.items.length === 0) {
        return '';
    }
    const table = Configuration.mainData.symbols;
    const href = (item: TaggedItem): string => {
        const shared = (table?.byName.get(item.name)?.length ?? 0) > 1;
        const entry =
            shared && table ? entryInFile(table, props.kind, item.name, item.file) : undefined;
        const target = {
            type: 'symbol',
            kind: props.kind,
            name: item.name,
            duplicateName: entry?.duplicateName
        } as const;
        return hrefText(hrefFor(target, props.depth));
    };
    return (
        <ul class="cdx-tagged-detail-links">
            {props.items.map(item => (
                <li>
                    <a
                        href={href(item)}
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
