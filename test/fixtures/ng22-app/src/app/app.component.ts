import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Application shell. Sets no change detection strategy, so Angular 22 runs it as OnPush.
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: '<router-outlet />'
})
export class AppComponent {}
