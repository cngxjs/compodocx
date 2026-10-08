import Html from '@kitajs/html';
import type { SemanticModel } from '../../app/compiler/semantic/model';
import type { DiView } from '../../app/di/model';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { hrefFor, hrefText } from '../../app/links/layout';
import { placedLink } from '../../app/links/resolve';
import type { SymbolId } from '../../app/links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';
import { type ReferencedByEntry, referencedByHref } from '../blocks/ReferencedBySection';
import { DiBadges } from '../components/DiBadges';
import { IconInjectable } from '../components/Icons';
import { firstSentence, t } from '../helpers';
import { entryFacts } from '../helpers/symbol-facts';
import { factKeyEntries } from '../helpers/used-by';

/**
 * The Dependency Injection landing page (`dependency-injection.html`): the
 * feature types with their providers and feature functions, the providers
 * without a feature type, and the tokens with their shape and providers.
 *
 * Override name: `dependency-injection`.
 */

interface Context {
    readonly table: SymbolTable;
    readonly view: DiView;
    readonly semantic?: SemanticModel;
    readonly depth: number;
}

const Heading = (id: string, title: string, count: number): string =>
    (
        <h2 class="cdx-section-heading" id={id}>
            {title}
            <span class="cdx-badge cdx-badge--count">{String(count)}</span>
            <a class="cdx-member-permalink" href={`#${id}`}>
                #
            </a>
        </h2>
    ) as string;

const entryLink = (ctx: Context, entry: SymbolEntry | undefined): string => {
    const link = entry && placedLink(ctx.table, entry, ctx.view, { duplicate: true });
    return entry && link
        ? ((
              <a href={hrefText(hrefFor(link.target, ctx.depth, link.anchor))}>
                  <code>{entry.ref.name}</code>
              </a>
          ) as string)
        : '';
};

const links = (ctx: Context, ids: readonly SymbolId[]): string =>
    ids.map(id => entryLink(ctx, ctx.table.byId.get(id))).join(', ');

const chipLinks = (entries: readonly ReferencedByEntry[], depth: number): string =>
    entries
        .map(
            entry =>
                (
                    <a href={referencedByHref(entry, depth)}>
                        <code>{entry.name}</code>
                    </a>
                ) as string
        )
        .join(', ');

const Clusters = (ctx: Context): string =>
    ctx.view.clusters.length === 0
        ? ''
        : ((
              <section class="cdx-content-section">
                  {Heading('providers', t('providers'), ctx.view.clusters.length)}
                  <table class="cdx-table">
                      <thead>
                          <tr>
                              <th scope="col">{t('feature-type')}</th>
                              <th scope="col">{t('providers')}</th>
                              <th scope="col">{t('features')}</th>
                          </tr>
                      </thead>
                      <tbody>
                          {ctx.view.clusters.map(cluster => (
                              <tr>
                                  <td>{entryLink(ctx, ctx.table.byId.get(cluster.owner))}</td>
                                  <td>{links(ctx, cluster.providers)}</td>
                                  <td>{links(ctx, cluster.features)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </section>
          ) as string);

const PlainProviders = (ctx: Context): string =>
    ctx.view.plainProviders.length === 0
        ? ''
        : ((
              <section class="cdx-content-section">
                  {Heading('other-providers', t('other-providers'), ctx.view.plainProviders.length)}
                  <table class="cdx-table">
                      <thead>
                          <tr>
                              <th scope="col">{t('name')}</th>
                              <th scope="col">{t('description')}</th>
                          </tr>
                      </thead>
                      <tbody>
                          {ctx.view.plainProviders.map(id => {
                              const entry = ctx.table.byId.get(id);
                              const description = (entry?.data as { description?: unknown })
                                  ?.description;
                              return (
                                  <tr>
                                      <td>
                                          {entryLink(ctx, entry)}
                                          {DiBadges({ facts: entryFacts(ctx.semantic, entry) })}
                                      </td>
                                      <td>{firstSentence(description) ?? ''}</td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </section>
          ) as string);

const Tokens = (ctx: Context): string =>
    ctx.view.tokens.length === 0
        ? ''
        : ((
              <section class="cdx-content-section">
                  {Heading('tokens', t('tokens'), ctx.view.tokens.length)}
                  <table class="cdx-table">
                      <thead>
                          <tr>
                              <th scope="col">{t('name')}</th>
                              <th scope="col">{t('type')}</th>
                              <th scope="col">{t('provided-by')}</th>
                          </tr>
                      </thead>
                      <tbody>
                          {ctx.view.tokens.map(id => {
                              const entry = ctx.table.byId.get(id);
                              const facts = entryFacts(ctx.semantic, entry)?.token;
                              const providers = factKeyEntries(
                                  { symbols: ctx.table, semantic: ctx.semantic, di: ctx.view },
                                  facts?.providedBy ?? []
                              );
                              return (
                                  <tr>
                                      <td>{entryLink(ctx, entry)}</td>
                                      <td>{facts ? t(`token-shape-${facts.shape}`) : ''}</td>
                                      <td>{chipLinks(providers, ctx.depth)}</td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </section>
          ) as string);

export const DependencyInjectionPage = (data: any): string => {
    const custom = renderCustomTemplate('dependency-injection', data);
    if (custom !== null) {
        return custom;
    }
    const table: SymbolTable | undefined = data.symbols;
    const view: DiView | undefined = data.di;
    const ctx: Context | undefined =
        table && view
            ? { table, view, semantic: data.semantic, depth: data.depth ?? 0 }
            : undefined;
    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-entity-service)">
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconInjectable()}
                </div>
                <h1 class="cdx-entity-hero-name">
                    <span>{t('dependency-injection')}</span>
                </h1>
            </div>
            {ctx ? [Clusters(ctx), PlainProviders(ctx), Tokens(ctx)].join('') : ''}
        </>
    ) as string;
};
