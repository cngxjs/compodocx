import { Routes } from '@angular/router';

import { LOGIN } from './login.routes';

export const APP_ROUTES: Routes = [
    ...LOGIN,
    { path: 'about', loadChildren: () => import('./about/about.routes').then(m => m.ABOUT_ROUTES) },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home', pathMatch: 'full' }
];
