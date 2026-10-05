import { InjectionToken, Provider } from '@angular/core';
import { getDefaultApiRoot } from './utils';

export interface DataConfig {
    apiRoot: string;
}

export const DATA_CONFIG = new InjectionToken<DataConfig>('DataConfig');

export function provideData(): Provider[] {
    return [{ provide: DATA_CONFIG, useValue: { apiRoot: getDefaultApiRoot() } }];
}
