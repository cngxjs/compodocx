import { Routes } from '@angular/router';
import { 
    HOME_ROUTES, 
    ADMIN_ROUTES as AdminRoutes,
    USER_ROUTES 
} from './feature-routes';
import { RoutePaths } from './constants';
import { RouterUtils } from './utils';

// Test for cleanFileIdentifiers - identifiers in route arrays
const DYNAMIC_ROUTE_ID = 'user-profile';
const FALLBACK_COMPONENT = 'DefaultComponent';

// Test for cleanFileSpreads - spread elements with various import patterns
export const APP_ROUTES: Routes = [
    ...HOME_ROUTES,                    // Basic spread
    ...AdminRoutes,                    // Aliased spread
    {
        path: RoutePaths.DASHBOARD,    // Property access expressions
        loadChildren: RouterUtils.getLazyModule(),
        pathMatch: RouterUtils.config.pathMatch,
        data: { 
            title: RouterUtils.titles.dashboard,
            breadcrumb: RouterUtils.breadcrumbs.main
        }
    },
    { 
        path: DYNAMIC_ROUTE_ID,        // Identifier reference
        component: FALLBACK_COMPONENT,
        children: [...USER_ROUTES]     // Nested spread
    },
    { 
        path: '**', 
        redirectTo: RoutePaths.HOME,   // Property access
        pathMatch: RouterUtils.matcher.full  // Nested property access
    }
];
