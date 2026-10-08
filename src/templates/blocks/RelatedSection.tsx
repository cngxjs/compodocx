import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import DependenciesEngine from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText } from '../../app/links/layout';
import { targetOfData } from '../../app/links/resolve';
import { logger } from '../../utils/logger';
import { t } from '../helpers';

/**
 * Renders the `@relatedTo` JSDoc tag as a Related section: chip-list of
 * cross-links to the named symbols. Resolved via
 * `DependenciesEngine.findInCompodoc()` plus a fallback lookup against
 * `tokens` (not included in the merged-data list there). Unresolved
 * symbols still render as an inactive grey chip — and emit a build-time
 * warn so the docs author can see the typo.
 *
 * Override name: `related`.
 */

type RelatedEntry = { name: string; href?: string };

const resolveEntry = (name: string, depth: number): RelatedEntry => {
    const hit = DependenciesEngine.findInCompodoc(name);
    if (hit && typeof hit !== 'boolean') {
        const target = targetOfData(hit);
        if (target?.type !== 'symbol') {
            return { name };
        }
        return { name, href: hrefText(hrefFor({ ...target, name }, depth)) };
    }
    // Tokens aren't included in findInCompodoc's merged-data list.
    const tokens = (DependenciesEngine as any).tokens as any[] | undefined;
    const token = tokens?.find((tk: any) => tk.name === name);
    if (token) {
        return { name, href: hrefText(hrefFor({ type: 'symbol', kind: 'token', name }, depth)) };
    }
    return { name };
};

type RelatedSectionProps = {
    readonly entityName: string;
    readonly relatedTo?: readonly string[];
    readonly depth: number;
};

export const RelatedSection = (props: RelatedSectionProps): string => {
    const custom = renderCustomTemplate('related', props);
    if (custom !== null) {
        return custom;
    }
    if (!props.relatedTo || props.relatedTo.length === 0) {
        return '';
    }
    const entries = props.relatedTo.map(n => resolveEntry(n, props.depth));
    for (const e of entries) {
        if (!e.href) {
            logger.warn(
                `@relatedTo target "${e.name}" not found in entity index for "${props.entityName}".`
            );
        }
    }
    return (
        <section class="cdx-content-section cdx-related-section" id="related">
            <h3 class="cdx-section-heading">
                {t('related')}
                <a class="cdx-member-permalink" href="#related">
                    #
                </a>
            </h3>
            <ul class="cdx-related-pills">
                {entries.map(e =>
                    e.href ? (
                        <li>
                            <a class="cdx-related-pill" href={e.href}>
                                {e.name}
                            </a>
                        </li>
                    ) : (
                        <li>
                            <span
                                class="cdx-related-pill cdx-related-pill--unresolved"
                                title={t('related-unresolved')}
                            >
                                {e.name}
                            </span>
                        </li>
                    )
                )}
            </ul>
        </section>
    ) as string;
};
