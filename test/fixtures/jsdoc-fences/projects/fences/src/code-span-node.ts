import { Directive } from '@angular/core';

/**
 * Install it with `ng add @fences/lib` and move imports `@fences/a -> @fences/b`.
 *
 * @example Run ``ng add @fences/lib`` once.
 * @since 0.7.0
 */
@Directive({ selector: '[codeSpanNode]' })
export class CodeSpanNode {}
