import type { Route } from '@angular/router';

import { RtaReport } from '../pages/report.component';

/**
 * Builds the report routes at runtime.
 *
 * @param prefix Path prefix of every report
 */
export function rtaReportRoutes(prefix: string): Route[] {
    return [{ path: `${prefix}-daily`, component: RtaReport }];
}
