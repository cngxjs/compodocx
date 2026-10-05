import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FooService } from './foo.service';

/**
 * AppConfig description
 *
 * See {@link BarComponent}
 */
export const appConfig: ApplicationConfig = {
    providers: [provideRouter([]), FooService]
};
