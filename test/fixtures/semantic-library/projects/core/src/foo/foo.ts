import { normalizeLabel } from '@sem/core/tokens';

/** Formats a value with the shared helper. */
export function formatFoo(value: string): string {
    return normalizeLabel(value);
}
