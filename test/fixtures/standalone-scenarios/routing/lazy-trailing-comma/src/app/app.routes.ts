import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
    {
        path: 'about',
        loadChildren: (): Promise<Routes> =>
            // Trailing comma is added intentionally to test
            // route parsing specifically for this case.
            import('./about/about.routes').then(m => m.ABOUT_ROUTES,)
    },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home', pathMatch: 'full' }
];
