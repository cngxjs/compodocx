import type { Routes as RtaRoutes } from '@angular/router';

import { HELP_ROUTES } from './help/help.routes';
import { RtaHelp } from './help/help.component';
import {
    rtaAdminMatch,
    rtaAuthGuard,
    rtaChildGuard,
    rtaHelpTitle,
    rtaLeaveGuard,
    rtaLegacyMatcher,
    rtaRoleGuard,
    rtaStartRedirect,
    rtaUserResolver
} from './guards';
import { RtaAccount } from './pages/account.component';
import { RtaHome } from './pages/home.component';
import { RtaLegacy } from './pages/legacy.component';
import { RtaPreview } from './pages/preview.component';
import { RtaProfile } from './pages/profile.component';
import { RtaSettings } from './pages/settings.component';
import { ACCOUNT_SEGMENT, PROFILE_SEGMENT, RtaSection, rtaPathFor } from './paths';
import { rtaReportRoutes } from './shared/report-routes';
import { provideRtaAccountScope } from './shared/session';

/**
 * Routes of the demo app, checked with `satisfies`.
 */
export const APP_ROUTES = [
    { path: '', redirectTo: RtaSection.Home, pathMatch: 'full' },
    { path: RtaSection.Home, component: RtaHome, title: 'Home' },
    { path: 'start', redirectTo: rtaStartRedirect },
    {
        path: RtaSection.Settings,
        loadComponent: () => import('./pages/settings.component').then(m => m.RtaSettings),
        canDeactivate: [rtaLeaveGuard]
    },
    {
        path: ACCOUNT_SEGMENT,
        component: RtaAccount,
        canActivate: [rtaAuthGuard],
        canActivateChild: [rtaChildGuard],
        providers: [provideRtaAccountScope()],
        runGuardsAndResolvers: 'always',
        children: [
            {
                path: `${PROFILE_SEGMENT}`,
                component: RtaProfile,
                resolve: { user: rtaUserResolver }
            }
        ]
    },
    {
        path: `${ACCOUNT_SEGMENT}/${PROFILE_SEGMENT}/edit`,
        component: RtaProfile,
        canActivate: [rtaRoleGuard('owner', 'admin')]
    },
    { path: 'help', component: RtaHelp, title: rtaHelpTitle, children: [...HELP_ROUTES] },
    { path: 'preview', outlet: 'aside', component: RtaPreview },
    { matcher: rtaLegacyMatcher, component: RtaLegacy },
    { path: rtaPathFor('reports'), children: rtaReportRoutes('reports') },
    {
        path: 'admin',
        canMatch: [rtaAdminMatch],
        loadChildren: () => import('./admin/admin.routes')
    },
    {
        path: 'remote',
        loadChildren: () => import('@rta/remote').then(m => m.REMOTE_ROUTES)
    },
    { path: '**', redirectTo: () => '/home' }
] satisfies RtaRoutes;
