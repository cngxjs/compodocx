import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';

import { APP_ROUTES } from './app.routes';
import { provideRtaSession } from './shared/session';

const ROUTER_PROVIDERS = [provideRouter(APP_ROUTES, withComponentInputBinding(), withHashLocation())];

/**
 * Router and core providers of the routing demo app.
 */
export const baseConfig: ApplicationConfig = {
    providers: [...ROUTER_PROVIDERS]
};

/**
 * Feature providers merged into {@link baseConfig} at bootstrap.
 */
export const featureConfig: ApplicationConfig = {
    providers: [provideRtaSession()]
};
