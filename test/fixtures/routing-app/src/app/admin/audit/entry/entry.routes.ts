import type { Route } from '@angular/router';

import { RtaAuditEntry } from './audit-entry.component';

/**
 * One audit entry.
 */
export const ENTRY_ROUTES: Array<Route> = [{ path: '', component: RtaAuditEntry }];
