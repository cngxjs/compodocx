import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import type { SymbolEntry } from '../../app/links/symbol-table';
import type { StylePageData, StyleThemeLink } from '../../app/page-generator/style-page-generator';
import { markedAcl } from '../../utils/marked.acl';
import { BlockTheming, tokenAnchors } from '../blocks/BlockTheming';
import { RelatedSection } from '../blocks/RelatedSection';
import { FeatureCrumbs } from '../components/FeatureCrumbs';
import { isThemingSection, pagefindFilterBlock, pagefindMetaBlock, t } from '../helpers';
import { featureInfoOf } from '../helpers/feature-info';
import { themingProse } from '../helpers/theming-prose';

const Section = (id: string, title: string, body: string): string =>
    body
        ? ((
              <section class="cdx-content-section" id={id}>
                  <h2 class="cdx-section-heading">
                      {title}
                      <a class="cdx-member-permalink" href={`#${id}`}>
                          #
                      </a>
                  </h2>
                  {body}
              </section>
          ) as string)
        : '';

const ThemesList = (themes: readonly StyleThemeLink[]): string =>
    themes.length === 0
        ? ''
        : ((
              <ul class="cdx-related-pills">
                  {themes.map(theme =>
                      theme.href ? (
                          <li>
                              <a class="cdx-related-pill" href={theme.href}>
                                  {theme.name}
                              </a>
                          </li>
                      ) : (
                          <li>
                              <code>{theme.name}</code>
                          </li>
                      )
                  )}
              </ul>
          ) as string);

/**
 * The page of a free-standing style file (`<feature folder>/<file>.html`):
 * overview, the symbols it themes, its tokens and mixins, its source.
 * Override name: `style` (props: the page data under `style`, `depth`).
 */
export const StylePage = (data: any): string => {
    const style = data.style as StylePageData;
    const entry = data.styleEntry as SymbolEntry;
    const depth = data.depth as number;
    const feature = featureInfoOf(Configuration.mainData.semantic, entry);
    const tokens = style.groups.flatMap(group => group.tokens);
    const overviewHtml =
        isThemingSection('overview') && style.overview
            ? `<div class="cdx-theming-overview cdx-prose">${themingProse(
                  style.overview,
                  depth,
                  tokenAnchors(tokens)
              )}</div>`
            : '';
    const tokensHtml =
        tokens.length > 0 && isThemingSection('tokens') ? BlockTheming({ tokens, depth }) : '';
    const mixinsHtml =
        style.mixins.length > 0 && isThemingSection('mixins')
            ? BlockTheming({ tokens: [], mixins: style.mixins, linkTokens: tokens, depth })
            : '';
    const sourceHtml =
        style.sources.length > 0
            ? BlockTheming({ tokens: [], styleSources: [...style.sources] })
            : '';
    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-entity-style)">
                {pagefindMetaBlock({
                    kind: 'style',
                    feature: feature?.feature.label,
                    description: style.overview ? (markedAcl(style.overview) as string) : undefined
                })}
                {pagefindFilterBlock({
                    kind: 'style',
                    feature: feature?.feature.label,
                    entryPoint: feature?.feature.entryPoint
                })}
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        {FeatureCrumbs(feature, depth) ?? ((<li>{t('style-file')}</li>) as string)}
                        <li aria-current="page">{style.name}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span>{style.name}</span>
                </h1>
                <div class="cdx-entity-hero-badges">
                    <span class="cdx-badge cdx-badge--entity-style">
                        {style.language.toUpperCase()}
                    </span>
                </div>
                {style.importLine ? (
                    <p class="cdx-entity-hero-selector">
                        <code>{style.importLine}</code>
                    </p>
                ) : (
                    ''
                )}
                <p class="cdx-entity-hero-file" title="Source file">
                    <span>{style.file}</span>
                </p>
            </div>
            {Section('overview', t('overview'), overviewHtml)}
            {Section('themes', t('theming'), ThemesList(style.themes))}
            {Section('tokens', t('tokens'), tokensHtml)}
            {mixinsHtml}
            {Section('source', t('source'), sourceHtml)}
            {RelatedSection({ entityName: style.name, relatedTo: style.relatedTo, depth })}
        </>
    ) as string;
};
