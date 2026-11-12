import { Directive } from '@angular/core';

/**
 * Uses a tilde fence with a longer closing line:
 *
 *   ~~~html
 *   @switch (mode) {
 *     @case ('a') { <b>a</b> }
 *   }
 *   ~~~~
 *
 * Inline ```@ignored``` stays text.
 *
 * @since 0.5.0
 */
@Directive({ selector: '[tildeNode]' })
export class TildeNode {}
