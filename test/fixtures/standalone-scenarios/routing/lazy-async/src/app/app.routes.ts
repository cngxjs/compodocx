import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
    { path: 'about', loadChildren: async () => (await import('./about/about.routes')).ABOUT_ROUTES },
    { path: 'toto', loadChildren: async () => (await import(`./toto/toto.routes`)).TOTO_ROUTES },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home', pathMatch: 'full' }
];
