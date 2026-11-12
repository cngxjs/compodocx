import { Directive } from '@angular/core';

/**
 * Opens a block that never closes:
 *
 * ```ts
 * const value = 1;
 *
 * @deprecated Use `ClosedBlock` instead.
 */
@Directive({ selector: '[unclosedBlock]' })
export class UnclosedBlock {}

/**
 * Comes right after the open block.
 *
 * @since 0.4.0
 */
@Directive({ selector: '[closedBlock]' })
export class ClosedBlock {}
