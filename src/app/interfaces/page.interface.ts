export interface PageInterface {
    name: string;
    /** Page title when `name` is an internal id. */
    displayName?: string;
    /** Heading rendered before the markdown of an additional page. */
    pageHeading?: string;
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
    service?: any;
    additionalPage?: any;
    files?: any;
    data?: any;
    depth?: number;
    pageType?: string;
    component?: any;
    /** Data of a feature page (`FeaturePageData`). */
    feature?: unknown;
    /** Data of a style page (`StylePageData`) and its table entry. */
    style?: unknown;
    styleEntry?: unknown;
    /** Token groups of the design tokens page. */
    groups?: unknown;
    markdown?: string;
    /** `@aiGenerated` marker of a markdown page (`true`, or the detail text). */
    aiGenerated?: string | boolean;
    childrenLength?: number;
    children?: any[];
    lastChild?: boolean;
}
