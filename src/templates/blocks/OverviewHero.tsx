import Html from '@kitajs/html';
import { IconProject } from '../components/Icons';
import { t } from '../helpers';

type OverviewHeroProps = {
    readonly projectName: string;
    readonly angularVersion?: string;
    readonly hasZoneless?: boolean;
    readonly generatedAt: string;
};

export const OverviewHero = (props: OverviewHeroProps): string => {
    const date = new Date(props.generatedAt);
    const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-primary)">
            <div class="cdx-entity-hero-watermark" aria-hidden="true">
                {IconProject()}
            </div>
            <nav aria-label="Breadcrumb">
                <ol class="cdx-breadcrumb">
                    <li aria-current="page">{t('overview')}</li>
                </ol>
            </nav>
            <h1 class="cdx-entity-hero-name cdx-overview-hero-name">
                {Html.escapeHtml(props.projectName) as string}
            </h1>
            <div class="cdx-entity-hero-badges">
                {props.angularVersion && (
                    <span class="cdx-badge cdx-badge--outline">Angular {props.angularVersion}</span>
                )}
                {props.hasZoneless && <span class="cdx-badge cdx-badge--zoneless">Zoneless</span>}
            </div>
            <p class="cdx-entity-hero-file" title="Generation time">
                <time datetime={props.generatedAt}>
                    {t('generated-at')} {formatted}
                </time>
            </p>
        </div>
    ) as string;
};
