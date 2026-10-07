/** Configuration shared by the foo providers. */
export interface FooConfig {
    readonly label: string;
}

/** Builds a label. */
export type LabelFn = (value: string) => string;

/** Shared helper exported by the tokens barrel and by the core barrel. */
export function normalizeLabel(value: string): string {
    return value.trim();
}
