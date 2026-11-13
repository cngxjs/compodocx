import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import type { SymbolEntry } from '../../app/links/symbol-table';
import type {
    NamespaceMemberRow,
    NamespacePageData
} from '../../app/page-generator/namespace-page-generator';
import { FeatureCrumbs } from '../components/FeatureCrumbs';
import { IconFile, IconNamespace } from '../components/Icons';
import { KindIcon } from '../components/KindIcon';
import { NamespaceLine } from '../components/NamespaceLine';
import {
    pagefindFilterBlock,
    pagefindMetaBlock,
    pageSummary,
    parseDescription,
    t
} from '../helpers';
import { featureInfoOf } from '../helpers/feature-info';
import { KIND_LABELS } from '../helpers/pagefind-meta';

const Section = (id: string, title: string, body: string): string =>
    (
        <section class="cdx-content-section" id={id}>
            <h2 class="cdx-section-heading">
                {title}
                <a class="cdx-member-permalink" href={`#${id}`}>
                    #
                </a>
            </h2>
            {body}
        </section>
    ) as string;

/** An alias names its target after the arrow, muted. */
const aliasTarget = (member: NamespaceMemberRow): string =>
    member.aliasOf === undefined
        ? ''
        : ((
              <span class="cdx-namespace-alias-of" safe>
                  {` -> ${member.aliasOf}`}
              </span>
          ) as string);

/** The kind icon (the kind in text for screen readers), a blank of its width without a kind. */
const KindOf = (member: NamespaceMemberRow): string => {
    if (!member.kind) {
        return (<span class="cdx-namespace-kind-blank" aria-hidden="true" />) as string;
    }
    const label = KIND_LABELS[member.kind];
    return `${KindIcon(member.kind, label)}${(<span class="sr-only">{`${label} `}</span>) as string}`;
};

const MemberRow = (member: NamespaceMemberRow): string => {
    const name = <code>{member.name}</code>;
    return (
        <tr
            data-cdx-namespace-member={member.kind ?? 'alias'}
            data-cdx-namespace-alias={member.aliasOf}
        >
            <td class="cdx-namespace-member-name">
                {KindOf(member)}
                {member.href ? <a href={member.href}>{name}</a> : name}
                {aliasTarget(member)}
            </td>
            <td>{pageSummary(member.description) ?? ''}</td>
        </tr>
    ) as string;
};

const Members = (members: readonly NamespaceMemberRow[]): string =>
    members.length === 0
        ? ''
        : Section(
              'members',
              t('members'),
              (
                  <table class="cdx-table">
                      <thead>
                          <tr>
                              <th scope="col">{t('name')}</th>
                              <th scope="col">{t('description')}</th>
                          </tr>
                      </thead>
                      <tbody>{members.map(MemberRow)}</tbody>
                  </table>
              ) as string
          );

/**
 * The page of a TypeScript namespace (`<feature folder>/<Ns>.html`): the
 * entry point it is imported from, its description and its direct members
 * (inner namespaces included), each linked to its own page.
 * Override name: `namespace` (props: the page data under `namespace`,
 * `namespaceEntry`, `depth`).
 */
export const NamespacePage = (data: any): string => {
    const custom = renderCustomTemplate('namespace', data);
    if (custom !== null) {
        return custom;
    }
    const ns = data.namespace as NamespacePageData | undefined;
    const entry = data.namespaceEntry as SymbolEntry | undefined;
    if (!ns) {
        return '';
    }
    const depth = data.depth as number;
    const feature = featureInfoOf(Configuration.mainData.semantic, entry);
    const outermost = ns.name.split('.')[0];
    return (
        <>
            <div
                class="cdx-entity-hero"
                style="--cdx-hero-color: var(--color-cdx-entity-namespace)"
            >
                {pagefindMetaBlock({
                    kind: 'namespace',
                    feature: feature?.feature.label,
                    description: ns.description
                })}
                {pagefindFilterBlock({
                    kind: 'namespace',
                    feature: feature?.feature.label,
                    entryPoint: feature?.feature.entryPoint
                })}
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconNamespace()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        {FeatureCrumbs(feature, depth) ?? ((<li>{t('namespaces')}</li>) as string)}
                        <li aria-current="page">{ns.name}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span>{ns.name}</span>
                </h1>
                <div class="cdx-entity-hero-badges">
                    <span class="cdx-badge cdx-badge--entity-namespace">
                        {KIND_LABELS.namespace}
                    </span>
                </div>
                {ns.entryPoint ? (
                    <p class="cdx-entity-hero-selector">
                        <code>{`import { ${outermost} } from '${ns.entryPoint}';`}</code>
                    </p>
                ) : (
                    ''
                )}
                {NamespaceLine({ item: ns, depth })}
                {!data.disableFilePath && ns.file ? (
                    <p class="cdx-entity-hero-file" title="Source file">
                        {IconFile()}
                        <span>{ns.file}</span>
                    </p>
                ) : (
                    ''
                )}
            </div>
            {ns.description
                ? Section('description', t('description'), parseDescription(ns.description, depth))
                : ''}
            {Members(ns.members)}
        </>
    ) as string;
};
