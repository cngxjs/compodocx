import Html from '@kitajs/html';
import type { SymbolFacts } from '../../app/compiler/semantic/model';
import { t } from '../helpers';

/**
 * Chip for a function or constant that must run in an injection context
 * (it calls `inject()`, directly or through another such function).
 */
export const InjectionContextBadge = (props: { readonly facts?: SymbolFacts }): string =>
    props.facts?.di?.usesInjectionContext
        ? ((
              <span
                  class="cdx-badge cdx-badge--injection-context"
                  title={t('injection-context-hint')}
              >
                  {t('injection-context')}
              </span>
          ) as string)
        : '';

/** Chip for the dependency injection role from the facts: provider or feature function. */
export const DiRoleBadge = (props: { readonly facts?: SymbolFacts }): string => {
    const role = props.facts?.di?.role;
    return role
        ? ((<span class="cdx-badge cdx-badge--factory">{t(`role-${role}`)}</span>) as string)
        : '';
};

/** Both chips, role first. */
export const DiBadges = (props: { readonly facts?: SymbolFacts }): string =>
    DiRoleBadge(props) + InjectionContextBadge(props);
