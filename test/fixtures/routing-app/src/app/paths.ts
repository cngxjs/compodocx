/** Top-level sections of the app. */
export enum RtaSection {
    Home = 'home',
    Settings = 'settings'
}

/** First segment of the account pages. */
export const ACCOUNT_SEGMENT = 'account';

/** Second segment of the profile page. */
export const PROFILE_SEGMENT = 'profile';

/**
 * Builds a path at runtime; the documentation shows the call as written.
 *
 * @param name Section name
 */
export function rtaPathFor(name: string): string {
    return `section-${name}`;
}
