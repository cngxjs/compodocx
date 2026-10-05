import { Routes } from '@angular/router';

export const HOME_ROUTES: Routes = [
    { path: 'home', component: 'HomeComponent' },
    { path: 'welcome', component: 'WelcomeComponent' }
];

export const ADMIN_ROUTES: Routes = [
    { path: 'admin', component: 'AdminComponent' },
    { path: 'dashboard', component: 'DashboardComponent' }
];

export const USER_ROUTES: Routes = [
    { path: 'profile', component: 'ProfileComponent' },
    { path: 'settings', component: 'SettingsComponent' }
];
