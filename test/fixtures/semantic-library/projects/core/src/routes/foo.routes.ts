import { inject } from '@angular/core';
import type { CanActivateFn, ResolveFn } from '@angular/router';
import { FOO_LABEL } from '@sem/core/tokens';

/** Resolves the foo label for a route. */
export const fooLabelResolver: ResolveFn<string> = () => inject(FOO_LABEL)();

/** Lets a route through when the foo label is set. */
export function fooReadyGuard(required: boolean): CanActivateFn {
    return () => !required || inject(FOO_LABEL)() !== '';
}
