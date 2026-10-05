import { BarDirective } from './bar.directive';
import { BarComponent } from './bar.component';

/**
 * BAR_IMPORTS description
 *
 * The bar declarables, imported together by standalone components.
 */
export const BAR_IMPORTS = [BarDirective, BarComponent] as const;
