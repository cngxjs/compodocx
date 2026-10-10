import Html from '@kitajs/html';
import type { SymbolKey } from '../../app/compiler/semantic/model';
import Configuration from '../../app/configuration';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { ExternalLinks } from '../blocks/ExternalLinks';
import { ReferencedBySection, SymbolChips } from '../blocks/ReferencedBySection';
import { RelatedSection } from '../blocks/RelatedSection';
import { entityFeature, FeatureCrumbs } from '../components/FeatureCrumbs';
import { IconToken } from '../components/Icons';
import { WcagBadge } from '../components/WcagBadge';
import {
    codeWrap,
    deriveLibFromBucket,
    formatProvidedIn,
    pagefindFilterBlock,
    pagefindMetaBlock,
    parseDescription,
    t
} from '../helpers';
import { symbolFacts } from '../helpers/symbol-facts';
import { factKeyEntries, usedByEntries } from '../helpers/used-by';

/**
 * Dedicated detail page for InjectionToken / HttpContextToken
 * declarations. Tokens are DI keys, semantically distinct from
 * `@Injectable()` service classes, so they ship a leaner page than
 * `EntityPage`: no methods, no inputs/outputs, no API tab. Hero, then
 * description, type with its shape, default (`factory`), providedIn, the
 * symbols that provide and inject the token, Used by and Related. Lives at
 * `tokens/<name>.html`.
 *
 * The page consumes the same `cdx-content-section` / `cdx-section-heading`
 * pattern as entity Info tabs and misc detail pages, so the
 * visual rhythm is consistent across the catalogue.
 *
 * Override name: `token`.
 */

interface SectionProps {
    readonly title: string;
    readonly id?: string;
    readonly children: string | string[];
}

const Section = (props: SectionProps): string => {
    const id = props.id ?? props.title.toLowerCase().replace(/\s+/g, '-');
    return (
        <section class="cdx-content-section" id={id}>
            <h3 class="cdx-section-heading">
                {props.title}
                <a
                    class="cdx-member-permalink"
                    href={`#${id}`}
                    aria-label={`Link to ${props.title}`}
                >
                    #
                </a>
            </h3>
            {props.children}
        </section>
    ) as string;
};

/** `InjectionToken<T>` or `HttpContextToken<T>`, depending on the constructor. */
const tokenSignature = (item: any, tokenType: string): string =>
    `${item.tokenClass ?? 'InjectionToken'}<${tokenType}>`;

const Hero = (item: any, depth: number): string => {
    const feature = entityFeature('token', item);
    const breadcrumbLabel = t('tokens');
    const lib = deriveLibFromBucket(item.file) ?? '';
    const meta = pagefindMetaBlock({
        kind: 'token',
        feature: feature?.feature.label,
        description: item.description
    });
    const filter = pagefindFilterBlock({
        kind: 'token',
        lib,
        feature: feature?.feature.label,
        entryPoint: feature?.feature.entryPoint
    });
    const tokenType = (item.tokenType as string | undefined)?.trim();
    return (
        <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-entity-service)">
            {meta}
            {filter}
            <div class="cdx-entity-hero-watermark" aria-hidden="true">
                {IconToken()}
            </div>
            <nav aria-label="Breadcrumb">
                <ol class="cdx-breadcrumb">
                    {FeatureCrumbs(feature, depth) ?? (
                        <li aria-current="page">{breadcrumbLabel}</li>
                    )}
                    <li aria-current="page">{item.name}</li>
                </ol>
            </nav>
            <h1 class="cdx-entity-hero-name">
                <span>{item.name}</span>
            </h1>
            <div class="cdx-entity-hero-badges">
                <span class="cdx-badge cdx-badge--entity-token" title={t('token')}>
                    {t('token')}
                </span>
                {item.deprecated ? (
                    <span class="cdx-badge cdx-badge--deprecated">{t('deprecated')}</span>
                ) : (
                    ''
                )}
                {item.beta ? <span class="cdx-badge cdx-badge--beta">Experimental</span> : ''}
                {item.since ? <span class="cdx-badge cdx-badge--since">v{item.since}</span> : ''}
                {WcagBadge({ wcagLevel: item.wcagLevel })}
            </div>
            {item.taggedSelector ? (
                <p class="cdx-entity-hero-selector">
                    <code>{item.taggedSelector}</code>
                </p>
            ) : (
                ''
            )}
            {tokenType ? (
                <p class="cdx-entity-hero-context">
                    <code>{Html.escapeHtml(tokenSignature(item, tokenType)) as string}</code>
                </p>
            ) : (
                ''
            )}
            {ExternalLinks({
                storybookUrl: item.storybookUrl,
                figmaUrl: item.figmaUrl,
                stackblitzUrl: item.stackblitzUrl,
                githubUrl: item.githubUrl,
                docsUrl: item.docsUrl
            })}
        </div>
    ) as string;
};

/** Chip entries for the symbols behind fact keys, or none without the semantic stage. */
const factEntries = (keys: readonly SymbolKey[] | undefined) =>
    factKeyEntries(Configuration.mainData, keys ?? []);

export const TokenPage = (data: any): string => {
    const custom = renderCustomTemplate('token', data);
    if (custom !== null) {
        return custom;
    }
    const item = data.token ?? data.injectable;
    if (!item) {
        return '';
    }
    const depth = data.depth ?? 1;
    const tokenType = (item.tokenType as string | undefined)?.trim();
    const providedIn = (item.providedIn as string | undefined)?.trim();
    const factory = (item.factory as string | undefined)?.trim();
    const facts = symbolFacts(Configuration.mainData, 'token', item)?.token;
    return (
        <>
            {Hero(item, depth)}

            {item.description
                ? Section({
                      title: t('description'),
                      children: parseDescription(item.description, depth)
                  })
                : ''}

            {tokenType
                ? Section({
                      title: t('type'),
                      children: [
                          facts
                              ? ((
                                    <span class="cdx-badge cdx-badge--outline">
                                        {t(`token-shape-${facts.shape}`)}
                                    </span>
                                ) as string)
                              : '',
                          (
                              <pre class="cdx-derived-body">
                                  <code>
                                      {Html.escapeHtml(tokenSignature(item, tokenType)) as string}
                                  </code>
                              </pre>
                          ) as string
                      ]
                  })
                : ''}

            {factory
                ? Section({
                      title: t('default-value'),
                      children: (
                          <pre class="cdx-derived-body">
                              <code>{Html.escapeHtml(factory) as string}</code>
                          </pre>
                      ) as string
                  })
                : ''}

            {providedIn
                ? Section({
                      title: t('provided-in') ?? 'Provided in',
                      children: codeWrap(formatProvidedIn(providedIn))
                  })
                : ''}

            {SymbolChips({
                entries: factEntries(facts?.providedBy),
                depth,
                id: 'provided-by',
                title: t('provided-by')
            })}

            {SymbolChips({
                entries: factEntries(facts?.injectedBy),
                depth,
                id: 'injected-by',
                title: t('injected-by')
            })}

            {ReferencedBySection({
                entries: usedByEntries(Configuration.mainData, 'token', item),
                depth
            })}

            {RelatedSection({
                entityName: item.name,
                relatedTo: item.relatedTo,
                depth
            })}
        </>
    ) as string;
};
