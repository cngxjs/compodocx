import type { Route } from '@angular/router';

import { RtaAuditLog } from './audit-log.component';

/**
 * Audit pages of the admin section.
 */
export const AUDIT_ROUTES: Route[] = [
    { path: '', component: RtaAuditLog },
    {
        path: ':entry',
        loadChildren: () => import('./entry/entry.routes').then(({ ENTRY_ROUTES }) => ENTRY_ROUTES)
    }
];
