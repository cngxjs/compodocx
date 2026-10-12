import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

/**
 * Session providers of the app.
 */
export function provideRtaSession(): EnvironmentProviders {
    return makeEnvironmentProviders([]);
}

/**
 * Providers scoped to the account routes.
 */
export function provideRtaAccountScope(): EnvironmentProviders {
    return makeEnvironmentProviders([]);
}
