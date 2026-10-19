import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { UnsavedChangesGuard } from './core/guards/unsaved-changes.guard';

/**
 * Application routes demonstrating guards, lazy loading, and nested routes.
 */
const routes: Routes = [
    {
        path: '',
        redirectTo: 'about',
        pathMatch: 'full',
    },
    {
        path: 'about',
        loadChildren: () =>
            import('./about/about.module').then((m) => m.AboutModule),
        canActivate: [AuthGuard, RoleGuard],
        canDeactivate: [UnsavedChangesGuard],
    },
    {
        path: '**',
        redirectTo: 'about',
    },
];

/**
 * Routing module that configures all top-level routes.
 */
@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
})
export class AppRoutingModule {}
