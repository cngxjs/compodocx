/** Member roles whose place in the feature sidebar is configurable (`menuFeatureSections`). */
export type MenuRole = 'configuration' | 'utilities' | 'constants' | 'types';

/** Own node, inside "More", flat at the feature's top level, or not in the sidebar. */
export type MenuPlacement = 'own' | 'more' | 'top' | 'hidden';

export type MenuFeatureSections = Readonly<Record<MenuRole, MenuPlacement>>;

export const MENU_ROLES: readonly MenuRole[] = ['configuration', 'utilities', 'constants', 'types'];

const PLACEMENTS: readonly MenuPlacement[] = ['own', 'more', 'top', 'hidden'];

export const DEFAULT_MENU_FEATURE_SECTIONS: MenuFeatureSections = {
    configuration: 'own',
    utilities: 'more',
    constants: 'more',
    types: 'more'
};

const isRole = (key: string): key is MenuRole => (MENU_ROLES as readonly string[]).includes(key);

const isPlacement = (value: unknown): value is MenuPlacement =>
    typeof value === 'string' && (PLACEMENTS as readonly string[]).includes(value);

/**
 * `menuFeatureSections` from the config file over the defaults. An unknown
 * role or value is dropped with one warning each; missing roles keep their
 * default. Anything but an object is dropped as a whole.
 */
export const parseMenuFeatureSections = (
    value: unknown
): { readonly sections: MenuFeatureSections; readonly warnings: readonly string[] } => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {
            sections: DEFAULT_MENU_FEATURE_SECTIONS,
            warnings: ['menuFeatureSections: expected an object of role -> placement; ignored']
        };
    }
    const sections: Record<MenuRole, MenuPlacement> = { ...DEFAULT_MENU_FEATURE_SECTIONS };
    const warnings: string[] = [];
    for (const [role, placement] of Object.entries(value)) {
        if (!isRole(role)) {
            warnings.push(
                `menuFeatureSections: unknown role "${role}" ignored (expected ${MENU_ROLES.join(', ')})`
            );
            continue;
        }
        if (!isPlacement(placement)) {
            warnings.push(
                `menuFeatureSections.${role}: unknown value "${String(placement)}" ignored (expected ${PLACEMENTS.join(', ')})`
            );
            continue;
        }
        sections[role] = placement;
    }
    return { sections, warnings };
};
