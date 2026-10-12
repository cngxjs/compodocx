import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root component of the routing demo app: a primary outlet and an aside outlet.
 */
@Component({
    selector: 'rta-shell',
    imports: [RouterOutlet],
    template: `<router-outlet /><router-outlet name="aside" />`
})
export class RtaShell {}
