import Configuration from '../../app/configuration';

/**
 * Check if a menu section should be initially expanded.
 *
 * `toggleMenuItems` is a whitelist of types that stay OPEN by default; the
 * special token `'all'` collapses everything (overrides any whitelisting).
 * Schema description: "Close by default items in the menu". Anything NOT
 * listed is closed by default; types listed (without `'all'`) are open.
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

/** Strip path prefix: 'images/' + 'foo/bar/logo.png' -> 'images/logo.png' */
export const stripUrl = (prefix: string, url: string): string => prefix + url.split('/').pop();
