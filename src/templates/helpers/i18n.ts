import I18nEngine from '../../app/engines/i18n.engine';

/**
 * Translate a key using the i18n engine. Equivalent to {{t "key"}} in Handlebars.
 * The key is looked up as given, then lowercased (locale keys are lowercase,
 * labels such as `'DOM Tree'` are not); a key with neither is returned unchanged.
 */
export const t = (key: string, params?: Record<string, string>): string => {
    if (I18nEngine.exists(key)) {
        return I18nEngine.translate(key, params);
    }
    const lower = key.toLowerCase();
    return I18nEngine.exists(lower) ? I18nEngine.translate(lower, params) : key;
};
