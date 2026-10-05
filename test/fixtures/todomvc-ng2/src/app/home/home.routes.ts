import { Routes } from '@angular/router';

import { HomeComponent } from './home.component';

import { PATHS } from './paths';

/**
 * Home routes
 */
export const HOME_ROUTES: Routes = [{ path: PATHS.home.url, component: HomeComponent }];
