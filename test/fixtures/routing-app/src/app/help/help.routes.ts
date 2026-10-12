import { Routes } from '@angular/router';

import { RtaFaq } from './faq.component';

/**
 * Help pages, spread into the help section.
 */
export const HELP_ROUTES: Routes = [{ path: 'faq', component: RtaFaq }];
