import { InjectionToken, Provider } from '@angular/core';
import { getDefaultApiRoot } from './utils';

export const API_ROOT = new InjectionToken<string>('my-lib::API_ROOT', {
    providedIn: 'root',
    factory: () => '/api',
});

export function provideCore(): Provider[] {
    return [{ provide: API_ROOT, useValue: getDefaultApiRoot() }];
}
