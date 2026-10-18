import Configuration from '../../app/configuration';
import {
    DEFAULT_API_SECTIONS,
    DEFAULT_INFO_SECTIONS,
    DEFAULT_THEMING_SECTIONS
} from '../../utils/constants';

type Tab = { readonly id: string; [key: string]: unknown };

/** Check if a tab is present in the navTabs array. */
export const isTabEnabled = (tabs: Tab[] | undefined, tabId: string): boolean =>
    Array.isArray(tabs) && tabs.findIndex(tab => tab.id === tabId) !== -1;

/** Check if a tab is the first (initially active) tab. */
export const isInitialTab = (tabs: Tab[] | undefined, tabId: string): boolean =>
    Array.isArray(tabs) && tabs.length > 0 && tabs[0].id === tabId;

/** Each tab uses the configured section list when there is one, else its default list. */
const hasExplicit = (sections: string[] | undefined): boolean =>
    Array.isArray(sections) && sections.length > 0;

/** Check if a section belongs to the **Info** tab. */
export const isInfoSection = (sectionId: string): boolean => {
    const info = Configuration.mainData.infoTabSections;
    if (hasExplicit(info)) {
        return info.includes(sectionId);
    }
    return DEFAULT_INFO_SECTIONS.includes(sectionId);
};

/** Check if a section belongs to the **API** tab. */
export const isApiSection = (sectionId: string): boolean => {
    const api = Configuration.mainData.apiTabSections;
    if (hasExplicit(api)) {
        return api.includes(sectionId);
    }
    return DEFAULT_API_SECTIONS.includes(sectionId);
};

/** Check if a section belongs to the **Theming** tab. */
export const isThemingSection = (sectionId: string): boolean => {
    const theming = Configuration.mainData.themingTabSections;
    if (hasExplicit(theming)) {
        return theming.includes(sectionId);
    }
    return DEFAULT_THEMING_SECTIONS.includes(sectionId);
};
