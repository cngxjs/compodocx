// `commitFailedRetry`'s `@deprecated` block has an inline `{@link X}`. TS
// parses such comments as a NodeArray rather than a string, which used to
// blow up the page renderer.
export interface TabsI18n {
    readonly tabsLabel: string;
    /**
     * @deprecated for tabs commit rollback - superseded by
     * {@link commitRolledBackTo}. Retained as the defensive
     * fallback in the announcement priority chain.
     */
    readonly commitFailedRetry: string;
    readonly commitRolledBackTo: (originLabel: string) => string;
}
