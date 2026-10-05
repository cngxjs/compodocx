import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { APP_ROUTES } from './app.routes';
import { HOME_ROUTES } from './home/home.routes';

/**
 * The application configuration
 */
export const appConfig: ApplicationConfig = {
    providers: [provideRouter([...HOME_ROUTES, ...APP_ROUTES])]
};
