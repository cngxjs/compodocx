import { normalizeLabel } from '@sem/core/tokens';

/** Formats a value with the shared helper. */
export function formatFoo(value: string): string {
    return normalizeLabel(value);
}

/** Display modes of a foo. */
export const FooMode = { Compact: 'compact', Wide: 'wide' } as const;

/** One of the display modes. */
export type FooMode = (typeof FooMode)[keyof typeof FooMode];

/** Picks a display mode. */
export function fooModeOf(wide: boolean): FooMode {
    return wide ? FooMode.Wide : FooMode.Compact;
}

/** Describes a display mode. */
export function describeFooMode(mode: FooMode): string {
    return `mode ${mode}`;
}
