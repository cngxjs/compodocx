import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * The main component
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: '<router-outlet></router-outlet>'
})
export class AppComponent {}
