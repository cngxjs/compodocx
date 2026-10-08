import Html from '@kitajs/html';
import type { SymbolKey } from '../../app/compiler/semantic/model';
import Configuration from '../../app/configuration';
import { hrefFor, hrefText, KIND_FOLDER, memberAnchor } from '../../app/links/layout';
import { placedLink } from '../../app/links/resolve';
import { symbolId } from '../../app/links/symbol-id';
import type { SymbolTable } from '../../app/links/symbol-table';
import { ImportStatement } from '../blocks/ImportStatement';
import { type ReferencedByEntry, ReferencedBySection } from '../blocks/ReferencedBySection';
import { DiBadges } from '../components/DiBadges';
import { IconFile, IconInjectable } from '../components/Icons';
import {
    functionSignature,
    linkTypeHtml,
    pagefindMetaBlock,
    parseDescription,
    t
} from '../helpers';
import { symbolFacts } from '../helpers/symbol-facts';
import { usedByEntries } from '../helpers/used-by';
import { collectExampleComments, type MiscTab, TabBar, TabPanels } from './MiscDetailPage';

/**
 * The page of a feature type (`providers/<FeatureType>.html`): its
 * definition, the providers that accept it and the feature functions that
 * return it, one section each, plus the tokens the providers provide.
 *
 * Override name: `di-cluster`, props `{ ...mainData, cluster, depth }`.
 */

export interface ClusterPageData {
    /** The feature type: an interface or type alias engine object. */
    readonly featureType: any;
    /** Engine objects of the providers, sorted by name. */
    readonly providers: readonly any[];
    /** Engine objects of the feature functions, sorted by name. */
    readonly features: readonly any[];
    /** Engine objects of the tokens the providers provide, sorted by name. */
    readonly tokens: readonly any[];
}

const isTypealias = (item: any): boolean => item?.subtype === 'typealias';

/** The engine kind of a member: functions and constants. */
const memberKind = (item: any): 'function' | 'variable' =>
    item?.subtype === 'variable' ? 'variable' : 'function';

/** A constant's declared type, or its initializer when it has none (an arrow function). */
const constantShape = (item: any, depth: number): string => {
    const typed = typeof item.type === 'string' && item.type !== '' && item.type !== 'unknown';
    return typed || !item.defaultValue
        ? linkTypeHtml(item.type ?? '', { depth })
        : Html.escapeHtml(String(item.defaultValue));
};

const Heading = (props: { id: string; title: string }): string =>
    (
        <h2 class="cdx-section-heading" id={props.id}>
            {props.title}
            <a class="cdx-member-permalink" href={`#${props.id}`}>
                #
            </a>
        </h2>
    ) as string;

const TypeDefinition = (item: any, depth: number): string => {
    if (isTypealias(item)) {
        return (
            <pre class="cdx-derived-body">
                <code>{linkTypeHtml(item.rawtype ?? '', { depth })}</code>
            </pre>
        ) as string;
    }
    const properties = (item.properties ?? []) as any[];
    const methods = (item.methods ?? []) as any[];
    if (properties.length === 0 && methods.length === 0) {
        return '';
    }
    return (
        <table class="cdx-table">
            <thead>
                <tr>
                    <th scope="col">{t('name')}</th>
                    <th scope="col">{t('type')}</th>
                    <th scope="col">{t('description')}</th>
                </tr>
            </thead>
            <tbody>
                {properties.map(property => (
                    <tr>
                        <td>
                            <code>
                                {property.name}
                                {property.optional ? '?' : ''}
                            </code>
                        </td>
                        <td>{linkTypeHtml(property.type ?? '', { depth })}</td>
                        <td>{parseDescription(property.description ?? '', depth)}</td>
                    </tr>
                ))}
                {methods.map(method => (
                    <tr>
                        <td>
                            <code>{method.name}</code>
                        </td>
                        <td>
                            <code>{functionSignature(method, depth)}</code>
                        </td>
                        <td>{parseDescription(method.description ?? '', depth)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    ) as string;
};

/** Links to the token pages a provider provides. */
const ProvidedTokens = (keys: readonly SymbolKey[], table: SymbolTable, depth: number): string => {
    const links = keys
        .map(key => table.byId.get(symbolId({ kind: 'token', file: key.file, name: key.name })))
        .flatMap(entry => {
            const link = entry && placedLink(table, entry, Configuration.mainData.di);
            return entry && link
                ? [
                      (
                          <a href={hrefText(hrefFor(link.target, depth, link.anchor))}>
                              <code>{entry.ref.name}</code>
                          </a>
                      ) as string
                  ]
                : [];
        });
    return links.length > 0
        ? ((
              <p class="cdx-di-provided-tokens">
                  {t('tokens')}: {links.join(', ')}
              </p>
          ) as string)
        : '';
};

const MemberSection = (item: any, owner: string, depth: number): string => {
    const kind = memberKind(item);
    const facts = symbolFacts(Configuration.mainData, kind, item);
    const id = memberAnchor(item.name, owner);
    const table: SymbolTable | undefined = Configuration.mainData.symbols;
    return (
        <section class="cdx-content-section cdx-di-member" id={id}>
            <h3 class="cdx-section-heading">
                <code>{item.name}</code>
                {DiBadges({ facts })}
                <a class="cdx-member-permalink" href={`#${id}`}>
                    #
                </a>
            </h3>
            <pre class="cdx-derived-body">
                <code>
                    {kind === 'function'
                        ? functionSignature(item, depth)
                        : constantShape(item, depth)}
                </code>
            </pre>
            {item.description ? parseDescription(item.description, depth) : ''}
            {table ? ProvidedTokens(facts?.di?.providesTokens ?? [], table, depth) : ''}
            {item.file && (
                <p class="cdx-entity-hero-file" title={t('defined-in')}>
                    {IconFile()}
                    <span>{item.file}</span>
                </p>
            )}
        </section>
    ) as string;
};

const MemberGroup = (
    id: string,
    title: string,
    items: readonly any[],
    owner: string,
    depth: number
): string =>
    items.length > 0
        ? ((
              <section class="cdx-content-section">
                  {Heading({ id, title })}
                  {items.map(item => MemberSection(item, owner, depth))}
              </section>
          ) as string)
        : '';

const TokenList = (tokens: readonly any[], depth: number): string =>
    tokens.length > 0
        ? ((
              <section class="cdx-content-section">
                  {Heading({ id: 'tokens', title: t('tokens') })}
                  <ul>
                      {tokens.map(token => (
                          <li>
                              <a
                                  href={hrefText(
                                      hrefFor(
                                          { type: 'symbol', kind: 'token', name: token.name },
                                          depth
                                      )
                                  )}
                              >
                                  <code>{token.name}</code>
                              </a>
                          </li>
                      ))}
                  </ul>
              </section>
          ) as string)
        : '';

/** Users of the feature type or any member, without the ones on this page. */
const clusterUsedBy = (cluster: ClusterPageData): ReferencedByEntry[] => {
    const owner = cluster.featureType;
    const ownerKind = isTypealias(owner) ? 'typealias' : 'interface';
    const entries = [
        ...usedByEntries(Configuration.mainData, ownerKind, owner),
        ...[...cluster.providers, ...cluster.features].flatMap(item =>
            usedByEntries(Configuration.mainData, memberKind(item), item)
        )
    ];
    const onThisPage = (entry: ReferencedByEntry) =>
        entry.hrefPrefix === KIND_FOLDER.provider && (entry.pageName ?? entry.name) === owner.name;
    const seen = new Set<string>();
    return entries
        .filter(entry => !onThisPage(entry))
        .filter(entry => {
            const key = `${entry.hrefPrefix}/${entry.pageName ?? entry.name}#${entry.anchor ?? ''}`;
            const first = !seen.has(key);
            seen.add(key);
            return first;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
};

const InfoContent = (cluster: ClusterPageData, depth: number): string => {
    const owner = cluster.featureType;
    return [
        ReferencedBySection({ entries: clusterUsedBy(cluster), depth }),
        owner.file ? ImportStatement({ name: owner.name, file: owner.file }) : '',
        owner.description
            ? ((
                  <section class="cdx-content-section">
                      {Heading({ id: 'description', title: t('description') })}
                      {parseDescription(owner.description, depth)}
                  </section>
              ) as string)
            : '',
        (
            <section class="cdx-content-section">
                {Heading({ id: 'type', title: t('type') })}
                {TypeDefinition(owner, depth)}
            </section>
        ) as string,
        MemberGroup('providers', t('providers'), cluster.providers, owner.name, depth),
        MemberGroup('features', t('features'), cluster.features, owner.name, depth),
        TokenList(cluster.tokens, depth)
    ].join('');
};

const ExamplesContent = (cluster: ClusterPageData): string => {
    const examples = [cluster.featureType, ...cluster.providers, ...cluster.features].flatMap(
        collectExampleComments
    );
    return examples.length > 0
        ? ((
              <section class="cdx-content-section">
                  <h3 class="cdx-section-heading">{t('example')}</h3>
                  <div class="cdx-member-description">
                      {examples.map(html => (<div>{html}</div>) as string).join('')}
                  </div>
              </section>
          ) as string)
        : '';
};

export const ClusterPage = (data: any): string => {
    const cluster: ClusterPageData = data.cluster;
    const depth: number = data.depth ?? 1;
    const owner = cluster.featureType;
    const examples = ExamplesContent(cluster);
    const tabs: MiscTab[] = [
        { id: 'info', label: 'Info', content: InfoContent(cluster, depth) },
        ...(examples ? [{ id: 'example' as const, label: 'Examples', content: examples }] : [])
    ];
    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-entity-function)">
                {pagefindMetaBlock({ description: owner.description })}
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconInjectable()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        <li>{t('providers')}</li>
                        <li aria-current="page">{owner.name}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span>{owner.name}</span>
                </h1>
                <div class="cdx-entity-hero-badges">
                    <span
                        class={`cdx-badge ${isTypealias(owner) ? 'cdx-badge--entity-typealias' : 'cdx-badge--entity-interface'}`}
                    >
                        {isTypealias(owner) ? 'Type Alias' : t('interface')}
                    </span>
                </div>
                {owner.file && (
                    <p class="cdx-entity-hero-file" title="Source file">
                        {IconFile()}
                        <span>{owner.file}</span>
                    </p>
                )}
            </div>
            {TabBar(tabs)}
            {TabPanels(tabs)}
        </>
    ) as string;
};
