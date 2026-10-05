import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * The main component
 */
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [RouterOutlet, RouterLink, RouterLinkActive]
})
export class AppComponent {
    public getOrganizations(): Observable<Todo[]> {
        console.log('yo');
    }

    public getProperty<T, K extends keyof T>(obj: T, key: K) {
        return obj[key];
    }

    public openSomeDialog(model, grid, callback: ({ index }) => {}): void {}
}
