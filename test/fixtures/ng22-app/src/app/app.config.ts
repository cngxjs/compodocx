import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideNotifications, withSound } from './notifications/notifications';

export const appConfig: ApplicationConfig = {
    providers: [provideRouter(routes), provideNotifications({ timeout: 4000 }, withSound())]
};
