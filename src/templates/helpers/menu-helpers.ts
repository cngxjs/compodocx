import Configuration from '../../app/configuration';

/**
 * Check if a menu section should be initially expanded.
 *
 * `toggleMenuItems` lists the chapters that start OPEN; the special token
 * `'all'` collapses everything (overrides any listed chapter). Anything not
 * listed starts collapsed.
 *
 * Default config has `toggleMenuItems: ['all']` → every section starts
 * collapsed, which matches compodoc's long-standing behaviour.
 */
export const isToggled = (type: string): boolean => {
    const items = Configuration.mainData.toggleMenuItems;
    if (items.indexOf('all') !== -1) {
        return false; // 'all' overrides → every section closed
    }
    return items.indexOf(type) !== -1; // open iff explicitly listed
};
