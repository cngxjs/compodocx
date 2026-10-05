import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { TodoStore } from './shared/services/todo.store';

import { NoopInterceptor } from './shared/interceptors/noopinterceptor.interceptor';

import { APP_ROUTES } from './app.routes';
import { HOME_ROUTES } from './home/home.routes';

/**
 * The bootstrapper configuration
 */
export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter([...HOME_ROUTES, ...APP_ROUTES]),
        provideHttpClient(withInterceptors([NoopInterceptor])),
        TodoStore
    ]
};
