import { InjectionToken } from '@angular/core';

interface FooConfig {
    readonly label: string;
}
declare const FOO_CONFIG: InjectionToken<FooConfig>;

export { FOO_CONFIG };
export type { FooConfig };
