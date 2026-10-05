import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { NoopInterceptor } from './interceptors/noop.interceptor';
import { NotAuthGuard } from './guards/not-auth.guard';
import { TodoStore } from './services/todo.store';

/**
 * The application configuration
 *
 * @deprecated This application configuration is deprecated
 */
export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter([
            {
                path: 'about',
                canMatch: [NotAuthGuard],
                loadComponent: () =>
                    import('./components/dumb.component').then(m => m.DumbComponent)
            }
        ]),
        provideHttpClient(withInterceptors([NoopInterceptor])),
        TodoStore
    ]
};
