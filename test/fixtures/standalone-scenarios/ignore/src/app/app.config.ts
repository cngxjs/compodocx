import { ApplicationConfig } from '@angular/core';

import { TodoStore } from './shared/services/todo.store';

/**
 * The application configuration
 * @ignore
 */
export const appConfig: ApplicationConfig = {
    providers: [TodoStore]
};
