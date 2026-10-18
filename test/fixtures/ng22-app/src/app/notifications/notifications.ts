import {
    EnvironmentProviders,
    InjectionToken,
    Provider,
    inject,
    makeEnvironmentProviders
} from '@angular/core';

/** Notification settings. */
export interface NotificationsConfig {
    /** Display time in milliseconds. */
    timeout: number;
    /** Whether a sound plays. */
    sound?: boolean;
}

/** Notification settings token. */
export const NOTIFICATIONS_CONFIG = new InjectionToken<NotificationsConfig>('NOTIFICATIONS_CONFIG');

/** One optional notifications feature. */
export interface NotificationsFeature {
    providers: Provider[];
}

/** Plays a sound with each notification. */
export function withSound(): NotificationsFeature {
    return { providers: [{ provide: NOTIFICATIONS_CONFIG, useValue: { timeout: 4000, sound: true } }] };
}

/** Provides notifications for the application. */
export function provideNotifications(
    config: NotificationsConfig,
    ...features: NotificationsFeature[]
): EnvironmentProviders {
    return makeEnvironmentProviders([
        { provide: NOTIFICATIONS_CONFIG, useValue: config },
        ...features.flatMap(feature => feature.providers)
    ]);
}

/** Reads the notification settings. */
export const injectNotificationsConfig = () => inject(NOTIFICATIONS_CONFIG);
