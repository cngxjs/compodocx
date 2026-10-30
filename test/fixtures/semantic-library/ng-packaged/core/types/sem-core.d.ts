import { Provider } from '@angular/core';

interface FooFeature {
    readonly kind: string;
}
declare function provideFoo(...features: FooFeature[]): Provider[];
declare function formatFoo(value: string): string;
declare function normalizeLabel(label: string): string;

export { formatFoo, normalizeLabel, provideFoo };
export type { FooFeature };
