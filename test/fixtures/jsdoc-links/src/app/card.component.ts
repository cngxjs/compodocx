import { Component } from '@angular/core';

/**
 * A card with tag comments that carry links.
 *
 * @slot header - the {@link Foo} header
 * @since {@link Foo} 1.0
 * @relatedTo {@link Foo}
 */
@Component({
    selector: 'jl-card',
    template: '<ng-content select="[header]"></ng-content>'
})
export class CardComponent {}
