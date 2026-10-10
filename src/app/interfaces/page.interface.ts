export interface PageInterface {
    name: string;
    /** Page title when `name` is an internal id. */
    displayName?: string;
    id: string;
    navTabs?: any[];
    filename?: string;
    context: string;
    path?: string;
    module?: any;
    pipe?: any;
    class?: any;
    interface?: any;
    directive?: any;
    injectable?: any;
    additionalPage?: any;
    files?: any;
    data?: any;
    depth?: number;
    pageType?: string;
    component?: any;
    /** Data of a feature page (`FeaturePageData`). */
    feature?: unknown;
    markdown?: string;
    childrenLength?: number;
    children?: any[];
    lastChild?: boolean;
}
