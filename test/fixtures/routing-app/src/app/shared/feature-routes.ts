import * as ng from '@angular/router';

import { RtaPartnerList } from './partner-list.component';

/**
 * Partner routes for apps that embed the partner list. The demo app does not mount them.
 */
export const PARTNER_ROUTES: ng.Route[] = [
    { path: 'partners', component: RtaPartnerList, title: 'Partners' }
];

/** Draft routes, not exported and not mounted. */
const DRAFT_ROUTES: ng.Route[] = [{ path: 'draft', component: RtaPartnerList }];

/** Number of draft routes. */
export const DRAFT_COUNT = DRAFT_ROUTES.length;
