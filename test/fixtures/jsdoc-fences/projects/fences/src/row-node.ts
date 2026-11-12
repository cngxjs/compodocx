import { Directive } from '@angular/core';

/**
 * Renders one row. Wire it like this:
 *
 * ```html
 * <li rowNode>
 *   @if (hasChildren) {
 *     <button type="button">toggle</button>
 *   } @else {
 *     <span>leaf</span>
 *   }
 * </li>
 * ```
 *
 * @since 0.2.0
 */
@Directive({ selector: '[rowNode]' })
export class RowNode {}
