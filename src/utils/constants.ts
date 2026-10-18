export const COMPODOC_CONSTANTS = {
    navTabDefinitions: [
        {
            id: 'readme',
            href: '#readme',
            'data-link': 'readme',
            label: 'README',
            depTypes: ['all']
        },
        {
            id: 'info',
            href: '#info',
            'data-link': 'info',
            label: 'Info',
            depTypes: ['all']
        },
        {
            id: 'api',
            href: '#api',
            'data-link': 'api',
            label: 'API',
            depTypes: [
                'component',
                'directive',
                'injectable',
                'service',
                'pipe',
                'class',
                'interface',
                'guard',
                'interceptor',
                'entity'
            ]
        },

        {
            id: 'source',
            href: '#source',
            'data-link': 'source',
            label: 'Source',
            depTypes: ['all']
        },
        {
            id: 'templateData',
            href: '#templateData',
            'data-link': 'template',
            label: 'Template',
            depTypes: ['component']
        },
        {
            id: 'styleData',
            href: '#styleData',
            'data-link': 'style',
            label: 'Styles',
            depTypes: ['component']
        },
        {
            id: 'theming',
            href: '#theming',
            'data-link': 'theming',
            label: 'Theming',
            depTypes: ['all']
        },
        {
            id: 'tree',
            href: '#tree',
            'data-link': 'dom-tree',
            label: 'DOM Tree',
            depTypes: ['component']
        },
        {
            id: 'example',
            href: '#example',
            'data-link': 'example',
            label: 'Examples',
            depTypes: ['component', 'directive', 'injectable', 'service', 'pipe']
        },
        {
            id: 'playground',
            href: '#playground',
            'data-link': 'playground',
            label: 'playground',
            depTypes: ['component', 'directive']
        }
    ]
};

/**
 * Default section buckets for the Info / API tab split.
 *
 * `DEFAULT_INFO_SECTIONS` → overview-style sections (description, metadata,
 * relationships, examples …) that sit on the Info tab.
 * `DEFAULT_API_SECTIONS`  → member-surface sections (index, constructor, inputs,
 * outputs, methods, properties …) that sit on the API tab.
 *
 * These defaults are applied by `isInfoSection()` / `isApiSection()` when the
 * user hasn't explicitly configured `infoTabSections` / `apiTabSections`.
 */
export const DEFAULT_INFO_SECTIONS: ReadonlyArray<string> = [
    'import',
    'deprecated',
    'description',
    'examples',
    'metadata',
    'extends',
    'host',
    'dependencies',
    'providers',
    'viewProviders',
    'relationships'
];

export const DEFAULT_API_SECTIONS: ReadonlyArray<string> = [
    'index',
    'inputs',
    'outputs',
    'derivedState',
    'effects',
    'properties',
    'methods',
    'accessors',
    'indexSignatures',
    'hostBindings',
    'hostListeners'
];

/**
 * Default section buckets for the **Theming** tab. Each ID maps to a region
 * inside `BlockTheming.tsx`:
 * - `overview` → markdown intro harvested from `@overview` doc blocks
 * - `index`    → navigable list of every documented token (mirror of API index)
 * - `tokens`   → the actual `cdx-io-member` rows, grouped by `@group`
 * - `mixins`   → documented SCSS mixins and functions
 * - `source`   → collapsible `<details>` panel listing the raw style files
 *
 * Override with `themingTabSections` in the config file to drop or reorder
 * regions per project.
 */
export const DEFAULT_THEMING_SECTIONS: ReadonlyArray<string> = [
    'overview',
    'index',
    'tokens',
    'mixins',
    'source'
];

/**
 * Max length for the string of a file during Lunr search engine indexing.
 * Prevent stack size exceeded
 */
/**
 * Sidebar chapter keys `toggleMenuItems` accepts. A listed chapter starts
 * open; `'all'` anywhere in the list keeps every chapter collapsed. Single
 * source for the CLI help; the schema title and the docs row are checked
 * against it by a spec.
 */
export const MENU_TOGGLE_KEYS: ReadonlyArray<string> = [
    'components',
    'directives',
    'entities',
    'classes',
    'injectables',
    'services',
    'dependency-injection',
    'guards',
    'interfaces',
    'interceptors',
    'pipes',
    'resolvers',
    'utilities',
    'styles',
    'additionalPages',
    'features'
];
