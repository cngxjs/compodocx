import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { ExternalLinks } from '../blocks/ExternalLinks';
import { ReferencedBySection } from '../blocks/ReferencedBySection';
import { RelatedSection } from '../blocks/RelatedSection';
import { IconToken } from '../components/Icons';
import { PrimaryBadge } from '../components/PrimaryBadge';
import { WcagBadge } from '../components/WcagBadge';
import {
    codeWrap,
    deriveLibFromBucket,
    formatProvidedIn,
    pagefindFilterBlock,
    pagefindMetaBlock,
    parseDescription,
    resolveBucketSegments,
    t
} from '../helpers';

/**
 * Dedicated detail page for InjectionToken / HttpContextToken
 * declarations. Tokens are DI keys — semantically distinct from
 * `@Injectable()` service classes — so they ship a leaner page than
 * `EntityPage`: no methods, no inputs/outputs, no API tab. Just hero
 * + type signature + providedIn + description + reverse-index
 * backlinks. Lives at `tokens/<name>.html`.
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

const Hero = (item: any, _depth: number): string => {
    const segments = resolveBucketSegments(item);
    const breadcrumbLabel = item.category || segments?.[0] || t('tokens');
    const lib = deriveLibFromBucket(item.file) ?? '';
    const meta = pagefindMetaBlock({
        kind: 'token',
        category: item.category,
        description: item.description
    });
    const filter = pagefindFilterBlock({
        kind: 'token',
        lib,
        bucket: item.category || undefined,
        docsKind: 'primary'
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
                    {segments
                        ? segments.map((s, i) =>
                              i === segments.length - 1 ? (
                                  <li aria-current="page">{s}</li>
                              ) : (
                                  <li>{s}</li>
                              )
                          )
                        : [<li aria-current="page">{breadcrumbLabel}</li>]}
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
                {PrimaryBadge({ docsKind: item.docsKind })}
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
                    <code>{Html.escapeHtml(`InjectionToken<${tokenType}>`) as string}</code>
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
    return (
        <>
            {Hero(item, depth)}

            {ReferencedBySection({ entries: item.referencedBy, depth })}

            {item.description
                ? Section({
                      title: t('description'),
                      children: parseDescription(item.description, depth)
                  })
                : ''}

            {RelatedSection({
                entityName: item.name,
                relatedTo: item.relatedTo,
                depth
            })}

            {tokenType
                ? Section({
                      title: t('type'),
                      children: (
                          <pre class="cdx-derived-body">
                              <code>
                                  {Html.escapeHtml(`InjectionToken<${tokenType}>`) as string}
                              </code>
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
        </>
    ) as string;
};
