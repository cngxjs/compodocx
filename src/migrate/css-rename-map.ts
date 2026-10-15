/**
 * CSS class-rename rules for `compodocx migrate css`.
 *
 * Three rule kinds:
 *  - `never-touch`  - pattern that must NEVER be rewritten (e.g. `data-compodoc`
 *                     attributes are intentionally preserved per CLAUDE.md).
 *  - `exact`        - exact-match class name → replacement.
 *  - `prefix`       - class names with this prefix get the prefix replaced.
 *
 * Order matters: never-touch wins, then exact, then prefix. Encoded as an
 * ordered array so the rewriter can short-circuit on the first match.
 */

export type RenameRule =
    | { readonly kind: 'never-touch'; readonly match: RegExp; readonly reason: string }
    | { readonly kind: 'exact'; readonly from: string; readonly to: string }
    | { readonly kind: 'prefix'; readonly from: string; readonly to: string };

export const CSS_RENAME_RULES: readonly RenameRule[] = [
    // Never-touch - `data-compodoc="<block-name>"` attributes are emitted by
    // every section in src/templates/blocks/*.tsx and src/templates/pages/*.tsx
    // as a stable downstream-scraping contract. CLAUDE.md flags these as
    // "intentionally kept - do NOT rename".
    {
        kind: 'never-touch',
        match: /\bdata-compodoc\b/,
        reason: 'data-compodoc is the stable scraping selector, intentionally preserved'
    },

    // Bootstrap card → member-card (most common compodoc → compodocx rename).
    { kind: 'exact', from: 'card-block', to: 'cdx-member-body' },
    { kind: 'exact', from: 'card', to: 'cdx-member-card' },
    { kind: 'exact', from: 'panel', to: 'cdx-content-section' },

    // Bootstrap tabs.
    { kind: 'exact', from: 'nav-tabs', to: 'cdx-tab-bar' },
    { kind: 'exact', from: 'nav-link', to: 'cdx-tab' },
    { kind: 'exact', from: 'tab-content', to: 'cdx-tab-panel' },
    { kind: 'exact', from: 'tab-pane', to: 'cdx-tab-panel' },

    // Sidebar.
    { kind: 'exact', from: 'chapter', to: 'cdx-sidebar-chapter' },
    { kind: 'exact', from: 'link', to: 'cdx-sidebar-link' },

    // Bootstrap badges.
    { kind: 'exact', from: 'badge-primary', to: 'cdx-badge' },
    { kind: 'exact', from: 'badge', to: 'cdx-badge' },

    // Bootstrap alerts.
    { kind: 'exact', from: 'alert', to: 'cdx-callout' },

    // Bootstrap modals.
    { kind: 'exact', from: 'modal', to: 'cdx-cp-panel' },

    // Compodoc-prefixed icons → unified cdx-icon.
    { kind: 'prefix', from: 'compodoc-icon-', to: 'cdx-icon-' },

    // Coverage-* family.
    { kind: 'prefix', from: 'coverage-', to: 'cdx-coverage-' },

    // Generic compodoc-* prefix → cdx-*.
    { kind: 'prefix', from: 'compodoc-', to: 'cdx-' }
];

/** Names that cannot be auto-rewritten - emit an audit warning instead. */
export const AUDIT_ONLY_PATTERNS: readonly string[] = [
    // `.menu` and `.collapse` are emitted by compodocx but used by the legacy
    // accordion JS - context-dependent rename, user must check by hand.
    'menu',
    'collapse',
    // Bootstrap grid removed entirely; user must redesign these.
    'col-md-',
    'row'
];
