import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
    { path: 'about', loadComponent: () => import('./about/about.component').then(m => m.AboutComponent) },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home', pathMatch: 'full' }
];
