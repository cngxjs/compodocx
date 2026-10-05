import { Routes } from '@angular/router';

import { APP_ENUMS } from './app-routes.enum';

enum APP_ENUM {
    home = 'homeenuminfile'
}

const DEFAULT: Routes = [
    { path: '', redirectTo: APP_ENUMS.home, pathMatch: 'full' },
    { path: '**', redirectTo: APP_ENUM.home, pathMatch: 'full' }
];

/**
 * Main application routes
 *
 * Link to about routes with lazy-loading, home routes are registered first in {@link appConfig}
 */
export const APP_ROUTES: Routes = [
    {
        path: 'about',
        loadChildren: () => import('./about/about.routes').then(m => m.ABOUT_ROUTES)
    },
    ...DEFAULT
];
