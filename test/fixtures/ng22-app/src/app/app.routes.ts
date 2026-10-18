import { Routes } from '@angular/router';
import { signedInGuard } from './core/signed-in.guard';
import { DashboardComponent } from './pages/dashboard.component';

export const routes: Routes = [
    { path: '', component: DashboardComponent },
    {
        path: 'reports',
        canActivate: [signedInGuard],
        loadComponent: () => import('./pages/reports.component').then(m => m.ReportsComponent)
    }
];
