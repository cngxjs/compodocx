import type { Route } from '@angular/router';

/**
 * Admin section, loaded lazily as the default export of this file.
 */
export default [
    { path: '', loadComponent: () => import('./admin-dashboard.component') },
    {
        path: 'users',
        loadComponent: async () => (await import('./admin-users.component')).RtaAdminUsers
    },
    {
        path: 'audit',
        loadChildren: () => import('./audit/audit.routes').then(m => m.AUDIT_ROUTES)
    }
] as Route[];
